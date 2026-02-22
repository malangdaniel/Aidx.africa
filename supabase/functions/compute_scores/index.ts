// Supabase Edge Function: compute_scores
// Computes daily health indices from last 24h of normalized vitals,
// applies safety threshold checks, and creates elite_alerts when triggered.
// Deploy: supabase functions deploy compute_scores

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

        const body = await req.json().catch(() => ({}));
        const targetUserId: string = body.userId ?? user.id;

        const serviceClient = createClient(supabaseUrl, serviceKey);
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Fetch recent vitals
        const { data: vitals, error: vitErr } = await serviceClient
            .from('elite_vitals_normalized')
            .select('metric, normalized_value, timestamp')
            .eq('user_id', targetUserId)
            .gte('timestamp', since);

        if (vitErr) throw new Error(`fetch vitals: ${vitErr.message}`);
        if (!vitals || vitals.length === 0) {
            return new Response(JSON.stringify({ message: 'Insufficient data to compute scores.' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Fetch baselines
        const { data: baselines } = await serviceClient
            .from('elite_baselines')
            .select('metric, baseline_mean, baseline_sd')
            .eq('user_id', targetUserId);

        const baselineMap: Record<string, { mean: number; sd: number }> = {};
        for (const b of (baselines ?? [])) {
            baselineMap[b.metric] = { mean: b.baseline_mean, sd: b.baseline_sd };
        }

        // Group vitals by metric
        const grouped: Record<string, number[]> = {};
        for (const v of vitals) {
            if (!grouped[v.metric]) grouped[v.metric] = [];
            grouped[v.metric].push(v.normalized_value);
        }

        const avg = (vals: number[]) =>
            vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

        const getVals = (m: string) => grouped[m] ?? [];

        // Deviation score helper (returns 0-100 adverse deviation)
        const devScore = (metric: string, ideal: number, range: number): number => {
            const vals = getVals(metric);
            if (!vals.length) return 50;
            const mean = avg(vals)!;
            const ref = baselineMap[metric]?.mean ?? ideal;
            return Math.min(100, Math.round((Math.abs(mean - ref) / range) * 100));
        };

        const hrVals = getVals('heart_rate');
        const spo2Vals = getVals('spo2');
        const tempVals = getVals('temperature');
        const bpSysVals = getVals('systolic_bp');
        const hrvVals = getVals('hrv');
        const sleepVals = getVals('sleep_hours');
        const fatVals = getVals('fatigue');

        const avgHR = avg(hrVals);
        const avgSpO2 = avg(spo2Vals);
        const avgTemp = avg(tempVals);

        const physio = Math.max(0, 100 - Math.round(devScore('heart_rate', 72, 40) * 0.4 + devScore('spo2', 98, 8) * 0.4 + devScore('temperature', 37, 2) * 0.2));
        const immune = Math.min(100, Math.round(devScore('temperature', 37, 2) * 0.5 + devScore('heart_rate', 72, 40) * 0.3 + (fatVals.length ? (avg(fatVals)! / 10) * 20 : 0)));
        const cardio = Math.min(100, Math.round(devScore('heart_rate', 72, 40) * 0.35 + devScore('systolic_bp', 120, 60) * 0.35 + (hrvVals.length ? Math.max(0, 30 - (avg(hrvVals)! / 100) * 30) : 0)));
        const recovery = Math.max(0, Math.min(100, 100 - Math.round(
            (sleepVals.length ? Math.max(0, (8 - avg(sleepVals)!) * 12.5) : 25) +
            (fatVals.length ? avg(fatVals)! * 5 : 25) -
            (hrvVals.length ? Math.min(25, avg(hrvVals)! / 4) : 0))));

        const confidenceJson = {
            physiological_stability: hrVals.length && spo2Vals.length ? 0.85 : 0.5,
            immune_activation: tempVals.length ? 0.80 : 0.45,
            cardiovascular_strain: hrVals.length && bpSysVals.length ? 0.85 : 0.55,
            recovery_efficiency: sleepVals.length ? 0.80 : 0.50,
        };

        const scoreDate = new Date().toISOString().slice(0, 10);

        const { data: scoreRow, error: scoreErr } = await serviceClient
            .from('elite_scores')
            .upsert({
                user_id: targetUserId,
                score_date: scoreDate,
                physiological_stability: physio,
                immune_activation: immune,
                cardiovascular_strain: cardio,
                recovery_efficiency: recovery,
                confidence_json: confidenceJson,
                computed_at: new Date().toISOString(),
            }, { onConflict: 'user_id,score_date' })
            .select()
            .single();

        if (scoreErr) throw new Error(`upsert scores: ${scoreErr.message}`);

        // Safety alert checks
        const alertsToInsert: any[] = [];

        if (avgSpO2 !== null && avgSpO2 < 92) {
            alertsToInsert.push({
                user_id: targetUserId,
                score_id: scoreRow.id,
                alert_level: 'critical',
                metric: 'spo2',
                reason: `SpO₂ averaged ${avgSpO2.toFixed(1)}% — below safe threshold of 92%.`,
                payload: { avgSpO2, scores: scoreRow },
            });
        }
        if (avgTemp !== null && avgTemp >= 39) {
            alertsToInsert.push({
                user_id: targetUserId,
                score_id: scoreRow.id,
                alert_level: 'high',
                metric: 'temperature',
                reason: `Temperature averaged ${avgTemp.toFixed(1)}°C — possible fever.`,
                payload: { avgTemp, scores: scoreRow },
            });
        }
        if (avgHR !== null && avgHR > 130) {
            alertsToInsert.push({
                user_id: targetUserId,
                score_id: scoreRow.id,
                alert_level: 'high',
                metric: 'heart_rate',
                reason: `Heart rate averaged ${avgHR.toFixed(0)} bpm — sustained elevation detected.`,
                payload: { avgHR, scores: scoreRow },
            });
        }

        if (alertsToInsert.length > 0) {
            await serviceClient.from('elite_alerts').insert(alertsToInsert);
        }

        return new Response(JSON.stringify({ scores: scoreRow, alertsCreated: alertsToInsert.length }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error('compute_scores error:', err);
        return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});
