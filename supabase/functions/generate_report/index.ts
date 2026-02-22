// Supabase Edge Function: generate_report
// POST /functions/v1/generate_report
// Compiles 7-day vitals + scores and calls Gemini to produce a weekly executive summary.
// Deploy: supabase functions deploy generate_report

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';

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
        const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

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

        const serviceClient = createClient(supabaseUrl, serviceKey);
        const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Fetch 7-day data
        const [{ data: scores }, { data: vitals }, { data: alerts }] = await Promise.all([
            serviceClient.from('elite_scores').select('*').eq('user_id', user.id).gte('score_date', since7d.slice(0, 10)).order('score_date', { ascending: true }),
            serviceClient.from('elite_vitals_normalized').select('metric, normalized_value, timestamp').eq('user_id', user.id).gte('timestamp', since7d).order('timestamp', { ascending: true }).limit(200),
            serviceClient.from('elite_alerts').select('*').eq('user_id', user.id).gte('created_at', since7d),
        ]);

        // Aggregate vital stats for prompt
        const vitalStats: Record<string, { avg: number; min: number; max: number }> = {};
        for (const v of (vitals ?? [])) {
            if (!vitalStats[v.metric]) vitalStats[v.metric] = { avg: 0, min: v.normalized_value, max: v.normalized_value };
            const s = vitalStats[v.metric];
            s.avg += v.normalized_value;
            if (v.normalized_value < s.min) s.min = v.normalized_value;
            if (v.normalized_value > s.max) s.max = v.normalized_value;
        }
        const metricCounts: Record<string, number> = {};
        for (const v of (vitals ?? [])) metricCounts[v.metric] = (metricCounts[v.metric] ?? 0) + 1;
        for (const [m, stats] of Object.entries(vitalStats)) stats.avg = Math.round((stats.avg / metricCounts[m]) * 10) / 10;

        const latestScore = (scores ?? []).at(-1);

        const prompt = `
You are AiDx Elite, a premium AI health coach. Generate a warm, encouraging, and concise weekly health report.

IMPORTANT SAFETY RULES:
- Do NOT make any definitive medical diagnoses.
- Use non-alarming, supportive, coaching language.
- Always recommend consulting a healthcare provider for concerns.
- If any escalation criteria are met, advise seeking medical attention promptly.

WEEKLY DATA SUMMARY (last 7 days):
Latest Health Indices (0-100, higher = more adverse):
${latestScore ? `
- Physiological Stability: ${latestScore.physiological_stability ?? 'N/A'}
- Immune Activation: ${latestScore.immune_activation ?? 'N/A'}  
- Cardiovascular Strain: ${latestScore.cardiovascular_strain ?? 'N/A'}
- Recovery Efficiency: ${latestScore.recovery_efficiency ?? 'N/A'} (lower = better recovery)
` : '- No scores available yet.'}

Vital Sign Averages:
${Object.entries(vitalStats).map(([m, s]) => `- ${m}: avg ${s.avg}, min ${s.min}, max ${s.max}`).join('\n') || '- No vitals logged this week.'}

Active Alerts: ${(alerts ?? []).length} alert(s)
${(alerts ?? []).map((a: any) => `- [${a.alert_level.toUpperCase()}] ${a.reason}`).join('\n') || 'None.'}

Generate a weekly report with:
1. A warm, personalized greeting (2 sentences)
2. Executive Summary: 3-4 key health observations from this week (positive and constructive)
3. One Primary Focus Area for the coming week with 2-3 actionable coaching tips
4. A brief encouraging close (1 sentence)
5. Only if alerts are present: a gentle note to consider speaking with a healthcare provider

Keep the entire report under 350 words. Use encouraging, premium coaching tone.
`.trim();

        const genai = new GoogleGenerativeAI(geminiKey);
        const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const reportText = result.response.text();

        return new Response(JSON.stringify({
            report: reportText,
            generatedAt: new Date().toISOString(),
            dataRange: { from: since7d.slice(0, 10), to: new Date().toISOString().slice(0, 10) },
            scores: scores ?? [],
            alertCount: (alerts ?? []).length,
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error('generate_report error:', err);
        return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});
