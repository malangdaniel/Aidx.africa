import { supabase } from '@/integrations/supabase/client';

export interface VitalRecord {
    id: string;
    user_id: string;
    systolic?: number;
    diastolic?: number;
    heart_rate?: number;
    weight?: number; // kg
    temperature?: number; // Celsius
    oxygen_saturation?: number; // %
    recorded_at: string;
}

export const VitalsService = {
    /**
     * Fetch vitals for the current user, ordered by date descending.
     * @param limit Number of records to fetch (default 7 for weekly view)
     */
    getVitals: async (limit = 30): Promise<VitalRecord[]> => {
        const { data, error } = await supabase
            .from('vitals')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    /**
     * Log a new set of vitals.
     */
    logVitals: async (vitals: Partial<Omit<VitalRecord, 'id' | 'user_id' | 'recorded_at'>>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { data, error } = await supabase
            .from('vitals')
            .insert({
                user_id: user.id,
                ...vitals,
                recorded_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Fetch vitals for a specific patient (Doctor view)
     */
    getPatientVitals: async (patientId: string, limit = 30): Promise<VitalRecord[]> => {
        const { data, error } = await supabase
            .from('vitals')
            .select('*')
            .eq('user_id', patientId)
            .order('recorded_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }
};
