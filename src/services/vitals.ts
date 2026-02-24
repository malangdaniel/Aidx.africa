import { supabase } from '@/integrations/supabase/client';
import { EliteService, RawVital, EliteBaseline } from './EliteService';

export interface VitalRecord {
    id: string;
    user_id: string;
    systolic?: number | null;
    diastolic?: number | null;
    heart_rate?: number | null;
    weight?: number | null;
    temperature?: number | null;
    oxygen_saturation?: number | null;
    recorded_at: string;
}

/**
 * Pivot helper to convert row-per-metric data into object-per-timestamp format.
 */
function pivotVitals(rows: any[]): VitalRecord[] {
    const pivoted: Record<string, VitalRecord> = {};

    rows.forEach(row => {
        // Round timestamp to nearest second or minute if they are slightly off, 
        // but typically they are exact if logged as a batch.
        const ts = row.timestamp;
        if (!pivoted[ts]) {
            pivoted[ts] = {
                id: row.id, // Note: This ID is from one of the metric rows
                user_id: row.user_id,
                recorded_at: ts,
            } as VitalRecord;
        }

        const value = Number(row.normalized_value);
        switch (row.metric) {
            case 'systolic_bp': pivoted[ts].systolic = value; break;
            case 'diastolic_bp': pivoted[ts].diastolic = value; break;
            case 'heart_rate': pivoted[ts].heart_rate = value; break;
            case 'weight': pivoted[ts].weight = value; break;
            case 'temperature': pivoted[ts].temperature = value; break;
            case 'spo2': pivoted[ts].oxygen_saturation = value; break;
        }
    });

    return Object.values(pivoted).sort((a, b) =>
        new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    );
}

export const vitalsService = {
    /**
     * Fetch vitals for the current user, pivoting normalized data from Elite engine.
     * @param limitDays Days of history to fetch (default 30)
     */
    getVitals: async (limitDays = 30): Promise<VitalRecord[]> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const normalizedRows = await EliteService.getRecentNormalizedVitals(user.id, limitDays);
        return pivotVitals(normalizedRows);
    },

    /**
     * Log a new set of vitals using the Elite ingestion pipeline.
     */
    logVitals: async (vitals: Partial<Omit<VitalRecord, 'id' | 'user_id' | 'recorded_at'>>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const batch: RawVital[] = [];
        const timestamp = new Date().toISOString();

        if (vitals.systolic) batch.push({ metric: 'systolic_bp', value: vitals.systolic, unit: 'mmHg', timestamp });
        if (vitals.diastolic) batch.push({ metric: 'diastolic_bp', value: vitals.diastolic, unit: 'mmHg', timestamp });
        if (vitals.heart_rate) batch.push({ metric: 'heart_rate', value: vitals.heart_rate, unit: 'bpm', timestamp });
        if (vitals.weight) batch.push({ metric: 'weight', value: vitals.weight, unit: 'kg', timestamp });
        if (vitals.temperature) batch.push({ metric: 'temperature', value: vitals.temperature, unit: '°C', timestamp });
        if (vitals.oxygen_saturation) batch.push({ metric: 'spo2', value: vitals.oxygen_saturation, unit: '%', timestamp });

        if (batch.length === 0) return null;

        return await EliteService.ingestVitals(user.id, batch);
    },

    /**
     * Fetch vitals for a specific patient (Doctor view)
     */
    getPatientVitals: async (patientId: string, limitDays = 30): Promise<VitalRecord[]> => {
        const normalizedRows = await EliteService.getRecentNormalizedVitals(patientId, limitDays);
        return pivotVitals(normalizedRows);
    },

    /**
     * Fetch persistent baselines for a user.
     */
    getBaselines: async (userId?: string): Promise<EliteBaseline[]> => {
        let targetId = userId;
        if (!targetId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];
            targetId = user.id;
        }
        return await EliteService.getBaseline(targetId);
    }
};

