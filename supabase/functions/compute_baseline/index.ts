// Supabase Edge Function: compute_baseline
// Computes/updates rolling 7-14 day personal baseline per metric per user.
// Can be called per-user or scheduled nightly.
// Deploy: supabase functions deploy compute_baseline

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            },
        });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        const targetUserId: string = body.userId ?? user.id;

        const serviceClient = createClient(supabaseUrl, serviceKey);

        // Fetch last 14 days of normalized vitals for the target user
        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: vitals, error: vitErr } = await serviceClient
            .from('elite_vitals_normalized')
            .select('metric, normalized_value')
            .eq('user_id', targetUserId)
            .gte('timestamp', since);

        if (vitErr) throw new Error(`fetch vitals: ${vitErr.message}`);
        if (!vitals || vitals.length === 0) {
            return new Response(JSON.stringify({ message: 'No data for baseline computation.' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Group by metric
        const grouped: Record<string, number[]> = {};
        for (const v of vitals) {
            if (!grouped[v.metric]) grouped[v.metric] = [];
            grouped[v.metric].push(v.normalized_value);
        }

        // Compute mean + SD per metric
        const upsertPayload = Object.entries(grouped).map(([metric, vals]) => {
            const n = vals.length;
            const mean = vals.reduce((a, b) => a + b, 0) / n;
            const variance = n > 1
                ? vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1)
                : 0;
            return {
                user_id: targetUserId,
                metric,
                baseline_mean: Math.round(mean * 1000) / 1000,
                baseline_sd: Math.round(Math.sqrt(variance) * 1000) / 1000,
                sample_count: n,
                last_updated: new Date().toISOString(),
            };
        });

        const { error: upsertErr } = await serviceClient
            .from('elite_baselines')
            .upsert(upsertPayload, { onConflict: 'user_id,metric' });

        if (upsertErr) throw new Error(`upsert baselines: ${upsertErr.message}`);

        return new Response(JSON.stringify({
            updated: upsertPayload.length,
            metrics: upsertPayload.map(p => p.metric),
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error('compute_baseline error:', err);
        return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});
