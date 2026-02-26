import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// Types
// =============================================================================

export type EliteMetric =
    | 'heart_rate' | 'hrv' | 'spo2' | 'temperature'
    | 'systolic_bp' | 'diastolic_bp' | 'weight'
    | 'blood_glucose' | 'steps' | 'sleep_hours'
    | 'mood' | 'fatigue';

export type VitalSource = 'manual' | 'healthkit' | 'google_fit' | 'device_estimate';

export interface RawVital {
    metric: EliteMetric;
    value: number;
    unit: string;
    timestamp?: string; // ISO; defaults to now
    source?: VitalSource;
    confidence?: number; // 0-1
    meta?: Record<string, unknown>;
}

export interface EliteVitalRaw {
    id: string;
    user_id: string;
    metric: string;
    value: number;
    unit: string;
    timestamp: string;
    source: string;
    confidence: number;
    meta: Record<string, unknown>;
    created_at: string;
}

export interface EliteVitalNormalized {
    id: string;
    raw_id: string;
    user_id: string;
    metric: string;
    normalized_value: number;
    normalized_unit: string;
    timestamp: string;
    rolling_mean_24h: number | null;
    rolling_sd_24h: number | null;
}

export interface EliteBaseline {
    id: string;
    user_id: string;
    metric: string;
    baseline_mean: number;
    baseline_sd: number;
    sample_count: number;
    last_updated: string;
}

export interface EliteScores {
    id: string;
    user_id: string;
    score_date: string;
    physiological_stability: number | null;
    immune_activation: number | null;
    cardiovascular_strain: number | null;
    recovery_efficiency: number | null;
    stability_index?: {
        score: number;
        raw_score: number;
        band: 'very_stable' | 'stable' | 'mild_instability' | 'attention' | 'high_risk';
        trend: 'improving' | 'declining' | 'stable';
    };
    confidence_json: {
        z_scores?: Record<string, number>;
        severity?: 'normal' | 'watch' | 'early_watch' | 'attention' | 'high' | 'critical';
        insight?: string;
        guidance?: string;
        top_driver?: string;
        early_warning?: {
            active: boolean;
            type: 'trend' | 'volatility' | 'sustained_shift' | null;
            metric: string | null;
            direction?: 'up' | 'down';
            message?: string;
        };
        [key: string]: any;
    };
    computed_at: string;
}

export interface EliteAlert {
    id: string;
    user_id: string;
    score_id: string | null;
    alert_level: 'low' | 'medium' | 'high' | 'critical';
    metric: string | null;
    reason: string;
    payload: Record<string, unknown>;
    created_at: string;
    resolved_at: string | null;
}

export interface AlertEvent {
    id: string;
    user_id: string;
    metric: string | null;
    severity: string;
    early_warning: boolean;
    confidence_score: number;
    triggered_at: string;
    resolved_at: string | null;
    acknowledged_at: string | null;
    feedback: 'helpful' | 'not_helpful' | null;
    meta: Record<string, unknown>;
}

export interface EliteClinicalPacket {
    userId: string;
    generatedAt: string;
    scoreId?: string;
    scores: EliteScores | null;
    recentVitals: EliteVitalNormalized[];
    baselines: EliteBaseline[];
    alerts: EliteAlert[];
    alertEvents?: AlertEvent[];
    geminiSummary?: string;
}

// =============================================================================
// Normalization helpers
// =============================================================================

/**
 * Convert raw value to a standard normalized unit.
 * e.g. temperature in °F → °C, weight in lbs → kg.
 */
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
        // mg/dL → mmol/L
        if (unit === 'mg/dL') return { value: value / 18.0182, unit: 'mmol/L' };
        return { value, unit: 'mmol/L' };
    }
    return { value, unit };
}

/**
 * Simple outlier check. Returns false if the value is physiologically impossible.
 */
function isOutlier(metric: string, value: number): boolean {
    const bounds: Record<string, [number, number]> = {
        heart_rate: [20, 300],
        hrv: [0, 300],
        spo2: [50, 100],
        temperature: [30, 45],    // °C
        systolic_bp: [50, 300],
        diastolic_bp: [30, 200],
        weight: [1, 700],    // kg
        blood_glucose: [0.5, 55],   // mmol/L
        steps: [0, 100_000],
        sleep_hours: [0, 24],
        mood: [1, 10],
        fatigue: [1, 10],
    };
    const [min, max] = bounds[metric] ?? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
    return value < min || value > max;
}

// =============================================================================
// EliteService
// =============================================================================

export const EliteService = {
    // ---------------------------------------------------------------------------
    // ingestVitals
    // Validates, normalizes, and stores a batch of raw vitals for the current user.
    // ---------------------------------------------------------------------------
    async ingestVitals(userId: string, vitalsBatch: RawVital[]): Promise<EliteVitalRaw[]> {
        const now = new Date().toISOString();

        // 1. Filter outliers & build raw insert payload
        const validVitals = vitalsBatch.filter(v => {
            const norm = normalizeVital(v.metric, v.value, v.unit);
            return !isOutlier(v.metric, norm.value);
        });

        if (validVitals.length === 0) return [];

        const rawPayload = validVitals.map(v => ({
            user_id: userId,
            metric: v.metric,
            value: v.value,
            unit: v.unit,
            timestamp: v.timestamp ?? now,
            source: v.source ?? 'manual',
            confidence: v.confidence ?? 1.0,
            meta: v.meta ?? {},
        }));

        const { data: rawRows, error: rawErr } = await supabase
            .from('elite_vitals_raw')
            .insert(rawPayload)
            .select();

        if (rawErr) throw new Error(`ingestVitals (raw): ${rawErr.message}`);
        if (!rawRows || rawRows.length === 0) return [];

        // 2. Build normalized payload
        const normPayload = rawRows.map((row: EliteVitalRaw, i) => {
            const srcVital = validVitals[i];
            const norm = normalizeVital(row.metric, row.value, row.unit);
            return {
                raw_id: row.id,
                user_id: userId,
                metric: row.metric,
                normalized_value: norm.value,
                normalized_unit: norm.unit,
                timestamp: row.timestamp,
                // rolling stats computed server-side; leave null here
                rolling_mean_24h: null,
                rolling_sd_24h: null,
            };
        });

        const { error: normErr } = await supabase
            .from('elite_vitals_normalized')
            .insert(normPayload);

        if (normErr) console.error('ingestVitals (normalized):', normErr.message);

        return rawRows;
    },

    // ---------------------------------------------------------------------------
    // getBaseline  — fetch all baselines for a user
    // ---------------------------------------------------------------------------
    async getBaseline(userId: string): Promise<EliteBaseline[]> {
        const { data, error } = await supabase
            .from('elite_baselines')
            .select('*')
            .eq('user_id', userId);

        if (error) throw new Error(`getBaseline: ${error.message}`);
        return (data ?? []) as EliteBaseline[];
    },

    // ---------------------------------------------------------------------------
    // computeAndStoreScores
    // Client-side scoring using normalized vitals from the last 24h.
    // For production, call the compute_scores edge function instead.
    // ---------------------------------------------------------------------------
    async computeAndStoreScores(userId: string): Promise<EliteScores | null> {
        const { data, error } = await supabase.functions.invoke('compute_scores', {
            body: { user_id: userId },
        });

        if (error) {
            console.error('computeAndStoreScores Edge Function error:', error);
            throw new Error(`Failed to compute scores: ${error.message}`);
        }

        // The Edge Function already stores the results in the database and returns the row
        return data as EliteScores;
    },

    // ---------------------------------------------------------------------------
    // _checkSafetyThresholds (internal)
    // ---------------------------------------------------------------------------
    async _checkSafetyThresholds(
        userId: string,
        scores: EliteScores,
        vitals: { avgHR: number | null; avgSpO2: number | null; avgTemp: number | null }
    ): Promise<void> {
        const alerts: Array<Omit<EliteAlert, 'id' | 'created_at' | 'resolved_at'>> = [];

        if (vitals.avgSpO2 !== null && vitals.avgSpO2 < 92) {
            alerts.push({
                user_id: userId,
                score_id: scores.id,
                alert_level: 'critical',
                metric: 'spo2',
                reason: `Blood oxygen saturation averaged ${vitals.avgSpO2.toFixed(1)}% — below safe threshold of 92%.`,
                payload: { vitals, scores },
            });
        }
        if (vitals.avgTemp !== null && vitals.avgTemp >= 39) {
            alerts.push({
                user_id: userId,
                score_id: scores.id,
                alert_level: 'high',
                metric: 'temperature',
                reason: `Temperature averaged ${vitals.avgTemp.toFixed(1)}°C — indicates possible fever.`,
                payload: { vitals, scores },
            });
        }
        if (vitals.avgHR !== null && vitals.avgHR > 130) {
            alerts.push({
                user_id: userId,
                score_id: scores.id,
                alert_level: 'high',
                metric: 'heart_rate',
                reason: `Heart rate averaged ${vitals.avgHR.toFixed(0)} bpm — sustained elevated rate detected.`,
                payload: { vitals, scores },
            });
        }

        // High score + high confidence → clinical packet alert
        const highScores = [
            scores.immune_activation,
            scores.cardiovascular_strain,
        ].filter((s): s is number => s !== null && s >= 85);

        if (highScores.length > 0) {
            const conf = scores.confidence_json;
            const highConf = Object.values(conf).some(c => c >= 0.8);
            if (highConf) {
                alerts.push({
                    user_id: userId,
                    score_id: scores.id,
                    alert_level: 'high',
                    metric: null,
                    reason: `Multiple health indices are significantly elevated with high confidence. Clinical review recommended.`,
                    payload: { vitals, scores },
                });
            }
        }

        if (alerts.length > 0) {
            const { error } = await supabase.from('elite_alerts').insert(alerts);
            if (error) console.error('_checkSafetyThresholds (insert alerts):', error.message);
        }
    },

    // ---------------------------------------------------------------------------
    // getLatestScores
    // ---------------------------------------------------------------------------
    async getLatestScores(userId: string, days = 7): Promise<EliteScores[]> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

        const { data, error } = await supabase
            .from('elite_scores')
            .select('*')
            .eq('user_id', userId)
            .gte('score_date', since)
            .order('score_date', { ascending: false });

        if (error) throw new Error(`getLatestScores: ${error.message}`);
        return (data ?? []) as EliteScores[];
    },

    // ---------------------------------------------------------------------------
    // getActiveAlerts
    // ---------------------------------------------------------------------------
    async getActiveAlerts(userId: string): Promise<EliteAlert[]> {
        const { data, error } = await supabase
            .from('elite_alerts')
            .select('*')
            .eq('user_id', userId)
            .is('resolved_at', null)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`getActiveAlerts: ${error.message}`);
        return (data ?? []) as EliteAlert[];
    },

    // ---------------------------------------------------------------------------
    // resolveAlert
    // ---------------------------------------------------------------------------
    async resolveAlert(alertId: string): Promise<void> {
        const { error } = await supabase
            .from('elite_alerts')
            .update({ resolved_at: new Date().toISOString() })
            .eq('id', alertId);

        if (error) throw new Error(`resolveAlert: ${error.message}`);
    },

    // ---------------------------------------------------------------------------
    // getRecentNormalizedVitals
    // ---------------------------------------------------------------------------
    async getRecentNormalizedVitals(userId: string, days = 7): Promise<EliteVitalNormalized[]> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('elite_vitals_normalized')
            .select('*')
            .eq('user_id', userId)
            .gte('timestamp', since)
            .order('timestamp', { ascending: false });

        if (error) throw new Error(`getRecentNormalizedVitals: ${error.message}`);
        return (data ?? []) as EliteVitalNormalized[];
    },

    // ---------------------------------------------------------------------------
    // generateClinicalPacket
    // Compiles a structured summary for handoff to ConsultationService.
    // ---------------------------------------------------------------------------
    async generateClinicalPacket(userId: string, scoreId?: string): Promise<EliteClinicalPacket> {
        const [scores, vitals, baselines, alerts] = await Promise.all([
            EliteService.getLatestScores(userId, 7),
            EliteService.getRecentNormalizedVitals(userId, 7),
            EliteService.getBaseline(userId),
            EliteService.getActiveAlerts(userId),
        ]);

        const targetScore = scoreId
            ? scores.find(s => s.id === scoreId) ?? scores[0] ?? null
            : scores[0] ?? null;

        const packet: EliteClinicalPacket = {
            userId,
            generatedAt: new Date().toISOString(),
            scoreId: targetScore?.id,
            scores: targetScore,
            recentVitals: vitals,
            baselines,
            alerts,
        };

        return packet;
    },

    // ---------------------------------------------------------------------------
    // getAlertEvents
    // ---------------------------------------------------------------------------
    async getAlertEvents(userId: string, days = 7): Promise<AlertEvent[]> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('alert_events')
            .select('*')
            .eq('user_id', userId)
            .gte('triggered_at', since)
            .order('triggered_at', { ascending: false });

        if (error) throw new Error(`getAlertEvents: ${error.message}`);
        return (data ?? []) as AlertEvent[];
    },

    // ---------------------------------------------------------------------------
    // submitAlertFeedback
    // ---------------------------------------------------------------------------
    async submitAlertFeedback(alertId: string, feedback: 'helpful' | 'not_helpful'): Promise<void> {
        const { error } = await supabase
            .from('alert_events')
            .update({ feedback })
            .eq('id', alertId);

        if (error) throw new Error(`submitAlertFeedback: ${error.message}`);
    },

    // ---------------------------------------------------------------------------
    // getActiveAlertEvents
    // ---------------------------------------------------------------------------
    async getActiveAlertEvents(userId: string): Promise<AlertEvent[]> {
        const { data, error } = await supabase
            .from('alert_events')
            .select('*')
            .eq('user_id', userId)
            .is('resolved_at', null)
            .order('triggered_at', { ascending: false });

        if (error) throw new Error(`getActiveAlertEvents: ${error.message}`);
        return (data ?? []) as AlertEvent[];
    },

    // ---------------------------------------------------------------------------
    // getStabilityHistory
    // ---------------------------------------------------------------------------
    async getStabilityHistory(userId: string, days = 7): Promise<any[]> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

        const { data, error } = await supabase
            .from('daily_stability_scores')
            .select('*')
            .eq('user_id', userId)
            .gte('date', since)
            .order('date', { ascending: true });

        if (error) throw new Error(`getStabilityHistory: ${error.message}`);
        return data ?? [];
    },
};
