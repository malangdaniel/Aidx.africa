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
    stability_index?: {
        score: number;
        raw_score: number;
        band: 'very_stable' | 'stable' | 'mild_instability' | 'attention' | 'high_risk';
        trend: 'improving' | 'declining' | 'stable';
        insight: string;
    };
    severity: SeverityLevel;
    top_driver: string | null;
    secondary_driver?: string | null;
    insight: string;
    guidance: string;
    requires_attention: boolean;
    early_warning?: EarlyWarning;
    confidence_score?: number; // Added for Calibration Layer
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
// CALIBRATION & SAFETY LAYER
// ---------------------------------------------------------------------------

class CalibrationService {
    private client: any;
    private userId: string;

    constructor(client: any, userId: string) {
        this.client = client;
        this.userId = userId;
    }

    /**
     * Compute internal confidence score ∈ [0,1]
     */
    calculateConfidence(params: {
        magnitude: number;        // Higher z-score -> higher magnitude
        duration: number;         // More consecutive abnormal readings -> higher factor
        consistency: number;      // Slope + sustained shift alignment
        volatility: number;       // High instability -> moderate increase
    }): number {
        const score = (0.35 * params.magnitude) + (0.25 * params.duration) + (0.20 * params.consistency) + (0.20 * params.volatility);
        return Math.min(1, Math.max(0, score));
    }

    /**
     * Rule 1: Alert Cooldown (24h/48h)
     */
    async checkCooldown(metric: string, severity: string): Promise<boolean> {
        // "Do NOT trigger more than 1 alert per metric per 24h (unless escalation)"
        // "Same metric, Same severity, Within last 48 hours -> Do NOT re-trigger (Unless severity escalates)"
        // We use 48h for same severity, and 24h as a hard floor.

        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        const { data: recentAlerts } = await this.client
            .from('alert_events')
            .select('severity')
            .eq('user_id', this.userId)
            .eq('metric', metric)
            .gte('triggered_at', fortyEightHoursAgo)
            .order('triggered_at', { ascending: false })
            .limit(1);

        if (!recentAlerts || recentAlerts.length === 0) return false;

        const lastSeverity = recentAlerts[0].severity as SeverityLevel;
        const severityOrder: Record<string, number> = { 'early_watch': 1, 'watch': 2, 'attention': 3, 'high': 4, 'critical': 5 };

        // Cooldown applies if severity is GEQ or same as last alert
        return severityOrder[severity] <= severityOrder[lastSeverity];
    }

    /**
     * Rule 2: Confirmation Rule (Noise Protection)
     */
    async isConfirmed(severity: string, metric: string, history: any[]): Promise<{ confirmed: boolean; durationFactor: number }> {
        // Critical alerts ("attention" and above) bypass this rule.
        if (severity !== 'watch' && severity !== 'early_watch' && severity !== 'normal') return { confirmed: true, durationFactor: 1.0 };

        // Require 2 consecutive abnormal readings OR sustained abnormal state for >= 12h
        const readings = history.filter(h => h.metric === metric).slice(-10);
        if (readings.length < 2) return { confirmed: false, durationFactor: 0.1 };

        const lastReadings = readings.slice(-2);
        // We simplified "abnormal" check here based on the fact we are already in scoring
        // Real implementation should probably check if previous was also > 1z
        const isConsecutive = lastReadings.length >= 2;

        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const readingsIn12h = readings.filter(r => new Date(r.timestamp) >= twelveHoursAgo);
        const isSustained = readingsIn12h.length >= 2;

        const durationFactor = Math.min(1.0, readingsIn12h.length / 5);

        return { confirmed: isConsecutive || isSustained, durationFactor };
    }

    /**
     * Rule 5: Resolution Logic
     * Two consecutive "normal" readings close the alert.
     */
    async processResolutions(currentVitals: Record<string, number>, baselineMap: Record<string, { mean: number; sd: number }>, history: any[]) {
        const { data: activeAlerts } = await this.client
            .from('alert_events')
            .select('*')
            .eq('user_id', this.userId)
            .is('resolved_at', null);

        if (!activeAlerts || activeAlerts.length === 0) return;

        for (const alert of activeAlerts) {
            if (!alert.metric) continue;

            const metricHistory = history.filter(h => h.metric === alert.metric).slice(-2);
            if (metricHistory.length < 2) continue;

            const baseline = baselineMap[alert.metric];
            if (!baseline) continue;

            const isResolved = metricHistory.every(h => {
                const z = calculateZScore(h.normalized_value, baseline.mean, baseline.sd);
                return Math.abs(z) < 1.0; // Normal range
            });

            if (isResolved) {
                await this.client
                    .from('alert_events')
                    .update({ resolved_at: new Date().toISOString() })
                    .eq('id', alert.id);
            }
        }
    }

    async logAlert(alert: {
        metric: string | null;
        severity: string;
        early_warning: boolean;
        confidence: number;
        meta?: any;
    }) {
        await this.client.from('alert_events').insert({
            user_id: this.userId,
            metric: alert.metric,
            severity: alert.severity,
            early_warning: alert.early_warning,
            confidence_score: alert.confidence,
            triggered_at: new Date().toISOString(),
            meta: alert.meta ?? {}
        });
    }
}

// ---------------------------------------------------------------------------
// STABILITY INDEX SERVICE
// ---------------------------------------------------------------------------

class StabilityService {
    private client: any;
    private userId: string;

    constructor(client: any, userId: string) {
        this.client = client;
        this.userId = userId;
    }

    /**
     * Map Z-Score to Stability Metric (0-100)
     */
    private zToStability(z: number | null): number | null {
        if (z === null) return null;
        const absZ = Math.abs(z);
        if (absZ <= 0.5) return 100;
        if (absZ <= 1.0) return 90;
        if (absZ <= 2.0) return 75;
        if (absZ <= 3.0) return 50;
        return 25;
    }

    /**
     * Compute final stability index
     */
    async calculateStabilityIndex(params: {
        zScores: Record<string, number | null>;
        severity: SeverityLevel;
        earlyWarning: EarlyWarning;
        date: string;
    }): Promise<ScoringOutput['stability_index']> {
        const weights: Record<string, number> = {
            heart_rate: 0.25,
            systolic_bp: 0.20,
            diastolic_bp: 0.15,
            spo2: 0.20,
            temperature: 0.10,
            weight: 0.10
        };

        let weightedSum = 0;
        let totalWeight = 0;

        for (const [metric, weight] of Object.entries(weights)) {
            const z = params.zScores[metric];
            const stability = this.zToStability(z);
            if (stability !== null) {
                weightedSum += stability * weight;
                totalWeight += weight;
            }
        }

        if (totalWeight === 0) return undefined;

        let rawScore = Math.max(20, Math.round(weightedSum / totalWeight));

        // Penalties
        // 1. Volatility
        if (params.earlyWarning.active && params.earlyWarning.type === 'volatility') {
            rawScore -= 10;
        } else if (params.earlyWarning.active) {
            rawScore -= 5;
        }

        // 2. Active Alert
        const alertPenalties: Record<string, number> = {
            'early_watch': 5,
            'watch': 10,
            'attention': 20,
            'high': 20,
            'critical': 20
        };
        rawScore -= (alertPenalties[params.severity] ?? 0);

        rawScore = Math.max(20, rawScore);

        // EMA Smoothing (alpha = 0.4)
        const alpha = 0.4;
        const { data: history } = await this.client
            .from('daily_stability_scores')
            .select('smoothed_score')
            .eq('user_id', this.userId)
            .lt('date', params.date)
            .order('date', { ascending: false })
            .limit(3);

        const yesterday = history?.[0]?.smoothed_score;
        let smoothedScore = yesterday
            ? Math.round(alpha * rawScore + (1 - alpha) * yesterday)
            : rawScore;

        smoothedScore = Math.max(20, smoothedScore);

        // Band
        let band: any = 'high_risk';
        let insight = "Your health patterns are significantly outside your normal range. Please review your recent readings carefully.";

        if (smoothedScore >= 90) {
            band = 'very_stable';
            insight = "Your health patterns are steady and consistent. Everything looks well within your normal range.";
        } else if (smoothedScore >= 75) {
            band = 'stable';
            insight = "Your health is generally stable with minor fluctuations. Nothing concerning right now.";
        } else if (smoothedScore >= 60) {
            band = 'mild_instability';
            insight = "There are small shifts in your readings. It’s not urgent, but staying consistent with healthy habits would help.";
        } else if (smoothedScore >= 40) {
            band = 'attention';
            insight = "Your readings show noticeable changes from your usual pattern. Keep monitoring closely.";
        }

        // Trend (3-day)
        let trend: any = 'stable';
        if (history && history.length >= 2) {
            const lastThree = [smoothedScore, history[0].smoothed_score, history[1].smoothed_score];
            const diff = lastThree[0] - lastThree[2]; // compare today to day-before-yesterday
            if (diff > 3) trend = 'improving';
            else if (diff < -3) trend = 'declining';
        }

        // Persist
        await this.client.from('daily_stability_scores').upsert({
            user_id: this.userId,
            date: params.date,
            raw_score: rawScore,
            smoothed_score: smoothedScore,
            band,
            meta: { trend, z_scores: params.zScores, insight }
        }, { onConflict: 'user_id,date' });

        return {
            score: smoothedScore,
            raw_score: rawScore,
            band,
            trend,
            insight
        };
    }
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

        // 6. Database Persistence
        const scoreDate = new Date().toISOString().slice(0, 10);

        // --- CALIBRATION & STABILITY LAYER INTEGRATION ---
        const calibration = new CalibrationService(serviceClient, targetUserId);
        const stabilitySvc = new StabilityService(serviceClient, targetUserId);

        // Calculate Stability Index
        const stabilityIndex = await stabilitySvc.calculateStabilityIndex({
            zScores,
            severity,
            earlyWarning,
            date: scoreDate
        });

        output.stability_index = stabilityIndex;

        // Calculate Confidence components

        // Calculate Confidence components
        const magnitudeFactor = Math.min(1.0, maxZ / 4);
        const { confirmed, durationFactor } = await calibration.isConfirmed(severity, driver || 'composite', allVitals);

        const consistencyFactor = earlyWarning.active ? (earlyWarning.type === 'trend' ? 0.8 : 1.0) : 0.5;
        const volatilityFactor = earlyWarning.type === 'volatility' ? 0.7 : 0.4;

        const internalConfidence = calibration.calculateConfidence({
            magnitude: magnitudeFactor,
            duration: durationFactor,
            consistency: consistencyFactor,
            volatility: volatilityFactor
        });

        const { data: scoreRow, error: scoreErr } = await serviceClient
            .from('elite_scores')
            .upsert({
                user_id: targetUserId,
                score_date: scoreDate,
                physiological_stability: H,
                confidence_json: {
                    ...output.metric_scores,
                    z_scores: zScores,
                    severity: output.severity,
                    insight: output.insight,
                    guidance: output.guidance,
                    top_driver: output.top_driver,
                    early_warning: output.early_warning,
                    internal_confidence: internalConfidence
                },
                computed_at: new Date().toISOString(),
            }, { onConflict: 'user_id,score_date' })
            .select()
            .single();

        if (scoreErr) throw new Error(`upsert scores: ${scoreErr.message}`);

        // Resolution Logic
        await calibration.processResolutions(metricMeans, baselineMap, allVitals);

        // Alert Triggering with Guardrails
        const inCooldown = await calibration.checkCooldown(driver || 'composite', severity);
        const shouldAlert = confirmed && !inCooldown && severity !== 'normal';

        if (shouldAlert) {
            // Log to alert_events
            await calibration.logAlert({
                metric: driver,
                severity,
                early_warning: earlyWarning.active,
                confidence: internalConfidence,
                meta: { output }
            });

            // Legacy Notifications
            const title = severity === 'critical' ? "Important Health Alert" : "Health Update";
            await serviceClient.from('notifications').insert({
                user_id: targetUserId,
                severity: severity,
                title: title,
                message: output.insight,
                related_score_id: scoreRow.id,
                read: false
            });

            // Legacy elite_alerts (for critical only)
            if (isCritical) {
                await serviceClient.from('elite_alerts').insert({
                    user_id: targetUserId,
                    score_id: scoreRow.id,
                    alert_level: 'critical',
                    reason: `Critical safety threshold exceeded: ${driver}`,
                    payload: { vitals: metricMeans, output },
                });
            }
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
