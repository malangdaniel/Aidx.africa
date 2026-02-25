// Supabase Edge Function: compute_scores
// Upgraded to use z-score–based deviation scoring.
// Deploy: supabase functions deploy compute_scores

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------
const ScoringConstants = {
    DECAY_CONSTANT_K: 0.8,
    SAMPLE_THRESHOLD: 5,
    WEIGHTS: {
        heart_rate: 0.25,
        spo2: 0.30,
        blood_pressure: 0.25,
        temperature: 0.10,
        weight: 0.10,
    },
    SAFETY_LIMITS: {
        spo2: 92,
        heart_rate: 130,
        temperature: 39,
        systolic_bp: 180,
        diastolic_bp: 120,
    },
    SLOPE_THRESHOLDS: {
        heart_rate: 1.5,
        spo2: -0.5,
        systolic_bp: 2.0,
        diastolic_bp: 1.5,
        temperature: 0.2,
        weight: 0.3,
    }
};

const METRIC_LABELS: Record<string, string> = {
    heart_rate: "heart rate",
    spo2: "oxygen level",
    systolic_bp: "blood pressure",
    diastolic_bp: "blood pressure",
    temperature: "temperature",
    weight: "weight",
    blood_pressure: "blood pressure"
};

type SeverityLevel = 'normal' | 'watch' | 'early_watch' | 'attention' | 'high' | 'critical' | 'insufficient_data';
type MetricType = 'heart_rate' | 'spo2' | 'temperature' | 'systolic_bp' | 'diastolic_bp' | 'weight';

interface EarlyWarning {
    active: boolean;
    type: 'trend' | 'volatility' | 'sustained_shift' | null;
    metric: string | null;
    direction?: 'up' | 'down';
    message?: string;
}

interface ScoringOutput {
    metric_scores: {
        heart_rate: number | null;
        spo2: number | null;
        temperature: number | null;
        blood_pressure: number | null;
        weight: number | null;
    };
    composite_score: number | null;
    severity: SeverityLevel;
    top_driver: string | null;
    secondary_driver?: string | null;
    insight: string;
    guidance: string;
    requires_attention: boolean;
    early_warning?: EarlyWarning;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Calculates z-score: (x - μ) / σ
 */
function calculateZScore(value: number, mean: number, sd: number): number {
    if (sd === 0) return 0;
    return (value - mean) / sd;
}

/**
 * Calculates stability score using exponential decay: S = 100 * exp(-k * |z|)
 */
function calculateMetricScore(z: number): number {
    const score = 100 * Math.exp(-ScoringConstants.DECAY_CONSTANT_K * Math.abs(z));
    return Math.max(0, Math.min(100, score));
}

/**
 * Perform simple linear regression: y = mx + b
 * Returns the slope (m)
 */
function calculateSlope(values: number[]): number | null {
    const n = values.length;
    if (n < 5) return null;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
}

/**
 * Standard Deviation calculation
 */
function calculateSD(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (values.length - 1));
}

/**
 * Calculates weighted composite health index (H)
 */
function calculateCompositeScore(scores: Record<MetricType, number | null>): number | null {
    let totalWeight = 0;
    let weightedSum = 0;

    // heart_rate
    if (scores.heart_rate !== null) {
        weightedSum += scores.heart_rate * ScoringConstants.WEIGHTS.heart_rate;
        totalWeight += ScoringConstants.WEIGHTS.heart_rate;
    }

    // spo2
    if (scores.spo2 !== null) {
        weightedSum += scores.spo2 * ScoringConstants.WEIGHTS.spo2;
        totalWeight += ScoringConstants.WEIGHTS.spo2;
    }

    // blood_pressure (averaged first if both exist)
    if (scores.systolic_bp !== null || scores.diastolic_bp !== null) {
        let bpScore = 0;
        let bpCount = 0;
        if (scores.systolic_bp !== null) { bpScore += scores.systolic_bp; bpCount++; }
        if (scores.diastolic_bp !== null) { bpScore += scores.diastolic_bp; bpCount++; }

        weightedSum += (bpScore / bpCount) * ScoringConstants.WEIGHTS.blood_pressure;
        totalWeight += ScoringConstants.WEIGHTS.blood_pressure;
    }

    // temperature
    if (scores.temperature !== null) {
        weightedSum += scores.temperature * ScoringConstants.WEIGHTS.temperature;
        totalWeight += ScoringConstants.WEIGHTS.temperature;
    }

    // weight
    if (scores.weight !== null) {
        weightedSum += scores.weight * ScoringConstants.WEIGHTS.weight;
        totalWeight += ScoringConstants.WEIGHTS.weight;
    }

    if (totalWeight === 0) return null;

    // Normalize weight to 1 if some metrics are missing, but here we just return the weighted sum 
    // if we want to follow "Weights (must sum to 1)" literally. 
    // If we want to handle missing metrics gracefully, we re-normalize.
    return Math.round(weightedSum / totalWeight);
}

/**
 * Checks for hard safety overrides
 */
function checkSafetyOverrides(vitals: Record<string, number>): { isCritical: boolean; triggeredMetric: string | null } {
    if (vitals.spo2 !== undefined && vitals.spo2 < ScoringConstants.SAFETY_LIMITS.spo2) return { isCritical: true, triggeredMetric: 'spo2' };
    if (vitals.heart_rate !== undefined && vitals.heart_rate > ScoringConstants.SAFETY_LIMITS.heart_rate) return { isCritical: true, triggeredMetric: 'heart_rate' };
    if (vitals.temperature !== undefined && vitals.temperature > ScoringConstants.SAFETY_LIMITS.temperature) return { isCritical: true, triggeredMetric: 'temperature' };
    if (vitals.systolic_bp !== undefined && vitals.systolic_bp > ScoringConstants.SAFETY_LIMITS.systolic_bp) return { isCritical: true, triggeredMetric: 'systolic_bp' };
    if (vitals.diastolic_bp !== undefined && vitals.diastolic_bp > ScoringConstants.SAFETY_LIMITS.diastolic_bp) return { isCritical: true, triggeredMetric: 'diastolic_bp' };

    return { isCritical: false, triggeredMetric: null };
}

/**
 * Explainability Layer: Metric Contribution Ranking
 */
function getMetricContributionRanking(
    metricScores: Record<MetricType, number | null>,
    weights: typeof ScoringConstants.WEIGHTS
): { top: string | null; secondary: string | null } {
    const contributions: { key: string; val: number }[] = [];

    // Bundle BP together for ranking
    const bpScore = (metricScores.systolic_bp !== null || metricScores.diastolic_bp !== null)
        ? ((metricScores.systolic_bp ?? 0) + (metricScores.diastolic_bp ?? 0)) / ((metricScores.systolic_bp !== null ? 1 : 0) + (metricScores.diastolic_bp !== null ? 1 : 0))
        : null;

    if (metricScores.heart_rate !== null) contributions.push({ key: 'heart_rate', val: weights.heart_rate * (100 - metricScores.heart_rate) });
    if (metricScores.spo2 !== null) contributions.push({ key: 'spo2', val: weights.spo2 * (100 - metricScores.spo2) });
    if (bpScore !== null) contributions.push({ key: 'blood_pressure', val: weights.blood_pressure * (100 - bpScore) });
    if (metricScores.temperature !== null) contributions.push({ key: 'temperature', val: weights.temperature * (100 - metricScores.temperature) });
    if (metricScores.weight !== null) contributions.push({ key: 'weight', val: weights.weight * (100 - metricScores.weight) });

    // Check if all scores are >= 95
    const allStable = contributions.every(c => (100 - (c.val / (weights[c.key as keyof typeof weights] || 1))) >= 95);

    if (allStable) return { top: null, secondary: null };

    contributions.sort((a, b) => b.val - a.val);

    return {
        top: contributions[0]?.key || null,
        secondary: contributions[1]?.key || null
    };
}

/**
 * Explainability Layer: Tone-aware generation
 */
function generateExplanations(severity: SeverityLevel, topMetricKey: string | null): { insight: string; guidance: string } {
    const label = topMetricKey ? METRIC_LABELS[topMetricKey] : "stats";

    const insights: Record<SeverityLevel, string> = {
        normal: "Everything looks within your usual range today. Keep up the good work.",
        watch: `Your ${label} is a little outside your usual range. It’s not concerning, but it’s worth keeping an eye on.`,
        early_watch: `We’ve noticed a slight shift in your ${label} recently. It’s still within range, but good to keep an eye on.`,
        attention: `Your ${label} is noticeably different from your recent pattern. It’s not urgent, but you may want to check again later.`,
        high: `Your ${label} is far from your normal readings today. Take it easy and consider checking again soon.`,
        critical: `Your ${label} is outside the safe range and needs attention. If you’re feeling unwell, please seek medical care.`,
        insufficient_data: "We need a few more readings to understand your normal range."
    };

    const guidance: Record<SeverityLevel, string> = {
        normal: "Keep following your usual routine.",
        watch: "Try resting, staying hydrated, and checking again later.",
        attention: "Slow down if needed and recheck soon.",
        high: "Monitor closely and consider speaking with a healthcare professional if this continues.",
        critical: "Please seek medical care if you have symptoms.",
        insufficient_data: "Please continue logging your vitals regularly."
    };

    return {
        insight: insights[severity] || insights.normal,
        guidance: guidance[severity] || guidance.normal
    };
}

// ---------------------------------------------------------------------------
// Main Edge Function Handler
// ---------------------------------------------------------------------------

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
        const window14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // 1. Fetch recent vitals (last 14 days for trend detection)
        const { data: allVitals, error: vitErr } = await serviceClient
            .from('elite_vitals_normalized')
            .select('metric, normalized_value, timestamp')
            .eq('user_id', targetUserId)
            .gte('timestamp', window14d)
            .order('timestamp', { ascending: true }); // Important for regression index

        if (vitErr) throw new Error(`fetch vitals: ${vitErr.message}`);

        // Edge Case: If less than 5 historical samples: Skip scoring
        if (!allVitals || allVitals.length < ScoringConstants.SAMPLE_THRESHOLD) {
            const insufficient = generateExplanations('insufficient_data', null);
            return new Response(JSON.stringify({
                composite_score: null,
                severity: 'insufficient_data',
                requires_attention: false,
                insight: insufficient.insight,
                guidance: insufficient.guidance,
                message: 'Minimum 5 samples required for scoring.'
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Filter last 24h for current scoring
        const vitals = allVitals.filter(v => v.timestamp >= since24h);

        // 2. Fetch baselines
        const { data: baselines, error: baseErr } = await serviceClient
            .from('elite_baselines')
            .select('metric, baseline_mean, baseline_sd')
            .eq('user_id', targetUserId);

        if (baseErr) throw new Error(`fetch baselines: ${baseErr.message}`);

        // Edge Case: If no baseline exists: Return composite_score = null
        if (!baselines || baselines.length === 0) {
            const insufficient = generateExplanations('insufficient_data', null);
            return new Response(JSON.stringify({
                composite_score: null,
                severity: 'insufficient_data',
                requires_attention: false,
                insight: insufficient.insight,
                guidance: insufficient.guidance,
                message: 'No baselines found for user.'
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        const baselineMap: Record<string, { mean: number; sd: number }> = {};
        for (const b of baselines) {
            baselineMap[b.metric] = { mean: b.baseline_mean, sd: b.baseline_sd };
        }

        // group vitals and calculate means for the last 24h
        const grouped: Record<string, number[]> = {};
        for (const v of vitals) {
            if (!grouped[v.metric]) grouped[v.metric] = [];
            grouped[v.metric].push(v.normalized_value);
        }

        const metricMeans: Record<string, number> = {};
        for (const [metric, values] of Object.entries(grouped)) {
            metricMeans[metric] = values.reduce((a, b) => a + b, 0) / values.length;
        }

        // 14-day history for trend analysis
        const historyGrouped: Record<string, { val: number; ts: string }[]> = {};
        for (const v of allVitals) {
            if (!historyGrouped[v.metric]) historyGrouped[v.metric] = [];
            historyGrouped[v.metric].push({ val: v.normalized_value, ts: v.timestamp });
        }

        // 3. Calculate Z-Scores and Stability Scores per metric
        const metricScores: Record<MetricType, number | null> = {
            heart_rate: null, spo2: null, temperature: null, systolic_bp: null, diastolic_bp: null, weight: null,
        };
        const zScores: Record<string, number> = {};

        const metricsToCompute: MetricType[] = ['heart_rate', 'spo2', 'temperature', 'systolic_bp', 'diastolic_bp', 'weight'];

        for (const m of metricsToCompute) {
            const val = metricMeans[m];
            const baseline = baselineMap[m];

            if (val !== undefined && baseline) {
                const z = calculateZScore(val, baseline.mean, baseline.sd);
                zScores[m] = z;
                metricScores[m] = calculateMetricScore(z);
            } else if (val !== undefined) {
                metricScores[m] = 100;
                zScores[m] = 0;
            }
        }

        // 4. Composite Health Stability Index (H)
        const H = calculateCompositeScore(metricScores);

        // 5. Hard Safety Overrides
        const { isCritical, triggeredMetric } = checkSafetyOverrides(metricMeans);

        // 6. Explainability Layer
        const maxZ = Math.max(...Object.values(zScores).map(Math.abs), 0);
        let severity: SeverityLevel = 'normal';
        if (isCritical) {
            severity = 'critical';
        } else {
            if (maxZ < 1) severity = 'normal';
            else if (maxZ < 2) severity = 'watch';
            else if (maxZ < 3) severity = 'attention';
            else severity = 'high';
        }

        const ranking = getMetricContributionRanking(metricScores, ScoringConstants.WEIGHTS);
        const driver = isCritical ? triggeredMetric : ranking.top;

        // 6. Early Warning Sub-Layer (Deterministic Modeling)
        let earlyWarning: EarlyWarning = { active: false, type: null, metric: null };
        const isLowSeverity = severity === 'normal' || severity === 'watch';

        if (isLowSeverity) {
            for (const m of metricsToCompute) {
                const history = historyGrouped[m] || [];
                const baseline = baselineMap[m];
                if (history.length < 5) continue;

                const values = history.map(h => h.val);

                // A. Trend Detection (Slope)
                const slope = calculateSlope(values);
                const threshold = ScoringConstants.SLOPE_THRESHOLDS[m as keyof typeof ScoringConstants.SLOPE_THRESHOLDS];

                if (slope !== null && threshold && Math.abs(slope) > threshold) {
                    // Check for sharp reversal (last 2 readings)
                    const lastTwo = values.slice(-2);
                    const reversal = (slope > 0 && lastTwo[1] < lastTwo[0] - threshold) || (slope < 0 && lastTwo[1] > lastTwo[0] + threshold);

                    if (!reversal) {
                        const direction = slope > 0 ? 'up' : 'down';
                        const label = METRIC_LABELS[m] || m;
                        earlyWarning = {
                            active: true,
                            type: 'trend',
                            metric: m,
                            direction,
                            message: direction === 'up'
                                ? `We’re noticing your ${label} has been gradually increasing over the past few days. It’s still within your usual range, but it’s worth keeping an eye on.`
                                : `Your ${label} has been slowly decreasing recently. It’s not concerning right now, but monitoring it would be a good idea.`
                        };
                        severity = 'early_watch';
                        break;
                    }
                }

                // B. Sustained Mild Deviation (|z| in [1, 2] for 3 samples)
                if (baseline) {
                    const zList = values.slice(-3).map(v => Math.abs(calculateZScore(v, baseline.mean, baseline.sd)));
                    if (zList.length === 3 && zList.every(z => z >= 1 && z < 2)) {
                        earlyWarning = {
                            active: true,
                            type: 'sustained_shift',
                            metric: m,
                            message: `Your ${METRIC_LABELS[m] || m} has been slightly outside your usual pattern for a few days now. It’s not urgent, but keep monitoring it.`
                        };
                        severity = 'early_watch';
                        break;
                    }
                }

                // C. Volatility Spike (Recent SD > 1.8x Baseline SD)
                if (baseline && baseline.sd > 0) {
                    const recentSD = calculateSD(values.slice(-5));
                    if (recentSD > 1.8 * baseline.sd) {
                        earlyWarning = {
                            active: true,
                            type: 'volatility',
                            metric: m,
                            message: `Your readings for ${METRIC_LABELS[m] || m} have been more variable than usual lately. Try keeping your routine steady and check again soon.`
                        };
                        severity = 'early_watch';
                        break;
                    }
                }
            }
        }

        const { insight, guidance } = generateExplanations(severity, driver);

        const output: ScoringOutput = {
            metric_scores: {
                heart_rate: metricScores.heart_rate,
                spo2: metricScores.spo2,
                temperature: metricScores.temperature,
                blood_pressure: (metricScores.systolic_bp !== null || metricScores.diastolic_bp !== null)
                    ? Math.round(((metricScores.systolic_bp ?? 0) + (metricScores.diastolic_bp ?? 0)) / ((metricScores.systolic_bp !== null ? 1 : 0) + (metricScores.diastolic_bp !== null ? 1 : 0)))
                    : null,
                weight: metricScores.weight,
            },
            composite_score: H,
            severity,
            top_driver: ranking.top,
            secondary_driver: ranking.secondary,
            insight: earlyWarning.active ? (earlyWarning.message || insight) : insight,
            guidance,
            requires_attention: isCritical || (H !== null && H < 70) || severity === 'high',
            early_warning: earlyWarning.active ? earlyWarning : undefined,
        };

        // 6. Database Persistence (Keep existing schema working)
        const scoreDate = new Date().toISOString().slice(0, 10);
        const { data: scoreRow, error: scoreErr } = await serviceClient
            .from('elite_scores')
            .upsert({
                user_id: targetUserId,
                score_date: scoreDate,
                physiological_stability: H, // Map H to physiological_stability
                confidence_json: {
                    ...output.metric_scores,
                    z_scores: zScores,
                    severity: output.severity,
                    insight: output.insight,
                    guidance: output.guidance,
                    top_driver: output.top_driver
                },
                computed_at: new Date().toISOString(),
            }, { onConflict: 'user_id,score_date' })
            .select()
            .single();

        if (scoreErr) throw new Error(`upsert scores: ${scoreErr.message}`);

        // 7. Notification Layer (Backend-driven)
        if (severity === 'attention' || severity === 'high' || severity === 'critical') {
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

            // Check for duplicates/escalation within last 6 hours
            const { data: recentNotifs } = await serviceClient
                .from('notifications')
                .select('severity')
                .eq('user_id', targetUserId)
                .gte('created_at', sixHoursAgo)
                .order('created_at', { ascending: false })
                .limit(1);

            const lastSeverity = recentNotifs?.[0]?.severity;
            const severityOrder = { attention: 1, high: 2, critical: 3 };

            // Create if no recent notif OR if severity escalated
            const shouldNotify = !lastSeverity ||
                (severityOrder[severity as keyof typeof severityOrder] > (severityOrder[lastSeverity as keyof typeof severityOrder] || 0));

            if (shouldNotify) {
                const title = severity === 'critical' ? "Important Health Alert" : "Health Update";
                await serviceClient.from('notifications').insert({
                    user_id: targetUserId,
                    severity: severity,
                    title: title,
                    message: output.insight,
                    related_score_id: scoreRow.id,
                    read: false
                });
            }
        }

        // Handle Alerts (Existing physiological alerts)
        if (isCritical) {
            await serviceClient.from('elite_alerts').insert({
                user_id: targetUserId,
                score_id: scoreRow.id,
                alert_level: 'critical',
                reason: `Critical safety threshold exceeded: ${driver}`,
                payload: { vitals: metricMeans, output },
            });
        }

        return new Response(JSON.stringify(output), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error('compute_scores error:', err);
        return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});
