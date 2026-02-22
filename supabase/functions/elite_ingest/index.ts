// Supabase Edge Function: elite_ingest
// POST /functions/v1/elite_ingest
// Accepts a batch of raw vitals, validates JWT, inserts into elite tables.
// Deploy: supabase functions deploy elite_ingest

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RawVitalInput {
    metric: string;
    value: number;
    unit: string;
    timestamp?: string;
    source?: string;
    confidence?: number;
    meta?: Record<string, unknown>;
}

interface IngestRequest {
    vitals: RawVitalInput[];
}

// Normalization
function normalizeVital(metric: string, value: number, unit: string): { value: number; unit: string } {
    if (metric === 'temperature') {
        if (unit === '°F' || unit === 'F') return { value: (value - 32) * (5 / 9), unit: '°C' };
        return { value, unit: '°C' };
    }
    if (metric === 'weight') {
        if (unit === 'lbs' || unit === 'lb') return { value: value * 0.453592, unit: 'kg' };
        return { value, unit: 'kg' };
    }
    if (metric === 'blood_glucose') {
        if (unit === 'mg/dL') return { value: value / 18.0182, unit: 'mmol/L' };
        return { value, unit: 'mmol/L' };
    }
    return { value, unit };
}

const OUTLIER_BOUNDS: Record<string, [number, number]> = {
    heart_rate: [20, 300],
    hrv: [0, 300],
    spo2: [50, 100],
    temperature: [30, 45],
    systolic_bp: [50, 300],
    diastolic_bp: [30, 200],
    weight: [1, 700],
    blood_glucose: [0.5, 55],
    steps: [0, 100_000],
    sleep_hours: [0, 24],
    mood: [1, 10],
    fatigue: [1, 10],
};

function isOutlier(metric: string, normalizedValue: number): boolean {
    const bounds = OUTLIER_BOUNDS[metric];
    if (!bounds) return false;
    return normalizedValue < bounds[0] || normalizedValue > bounds[1];
}

Deno.serve(async (req: Request) => {
    // CORS preflight
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
        // JWT verification via Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }

        // Verify the user JWT
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }

        const body: IngestRequest = await req.json();
        if (!Array.isArray(body.vitals) || body.vitals.length === 0) {
            return new Response(JSON.stringify({ error: 'vitals array is required' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        const serviceClient = createClient(supabaseUrl, supabaseKey);
        const now = new Date().toISOString();

        // Filter + insert raw
        const validVitals = body.vitals.filter(v => {
            const norm = normalizeVital(v.metric, v.value, v.unit);
            return !isOutlier(v.metric, norm.value);
        });

        if (validVitals.length === 0) {
            return new Response(JSON.stringify({ inserted: 0, skipped: body.vitals.length }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const rawPayload = validVitals.map(v => ({
            user_id: user.id,
            metric: v.metric,
            value: v.value,
            unit: v.unit,
            timestamp: v.timestamp ?? now,
            source: v.source ?? 'manual',
            confidence: v.confidence ?? 1.0,
            meta: v.meta ?? {},
        }));

        const { data: rawRows, error: rawErr } = await serviceClient
            .from('elite_vitals_raw')
            .insert(rawPayload)
            .select();

        if (rawErr) throw new Error(`raw insert: ${rawErr.message}`);

        // Insert normalized
        const normPayload = rawRows.map((row: any) => {
            const norm = normalizeVital(row.metric, row.value, row.unit);
            return {
                raw_id: row.id,
                user_id: user.id,
                metric: row.metric,
                normalized_value: norm.value,
                normalized_unit: norm.unit,
                timestamp: row.timestamp,
            };
        });

        await serviceClient.from('elite_vitals_normalized').insert(normPayload);

        return new Response(JSON.stringify({
            inserted: rawRows.length,
            skipped: body.vitals.length - validVitals.length,
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error('elite_ingest error:', err);
        return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});
