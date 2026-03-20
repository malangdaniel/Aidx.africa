import { supabase } from '@/integrations/supabase/client';

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

export const vitalsService = {
    getVitals: async (limitDays = 30): Promise<VitalRecord[]> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const since = new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('vitals')
            .select('*')
            .eq('user_id', user.id)
            .gte('recorded_at', since)
            .order('recorded_at', { ascending: false });

        if (error) { console.error('getVitals error:', error); return []; }
        return (data || []).map(r => ({
            id: r.id,
            user_id: r.user_id,
            systolic: r.systolic,
            diastolic: r.diastolic,
            heart_rate: r.heart_rate,
            weight: r.weight,
            temperature: r.temperature,
            oxygen_saturation: r.oxygen_saturation,
            recorded_at: r.recorded_at || r.created_at || new Date().toISOString(),
        }));
    },

    logVitals: async (vitals: Partial<Omit<VitalRecord, 'id' | 'user_id' | 'recorded_at'>>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { error } = await supabase.from('vitals').insert({
            user_id: user.id,
            systolic: vitals.systolic ?? null,
            diastolic: vitals.diastolic ?? null,
            heart_rate: vitals.heart_rate ?? null,
            weight: vitals.weight ?? null,
            temperature: vitals.temperature ?? null,
            oxygen_saturation: vitals.oxygen_saturation ?? null,
            recorded_at: new Date().toISOString(),
        });

        if (error) throw error;
    },

    getPatientVitals: async (patientId: string, limitDays = 30): Promise<VitalRecord[]> => {
        const since = new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('vitals')
            .select('*')
            .eq('user_id', patientId)
            .gte('recorded_at', since)
            .order('recorded_at', { ascending: false });

        if (error) { console.error('getPatientVitals error:', error); return []; }
        return (data || []).map(r => ({
            id: r.id,
            user_id: r.user_id,
            systolic: r.systolic,
            diastolic: r.diastolic,
            heart_rate: r.heart_rate,
            weight: r.weight,
            temperature: r.temperature,
            oxygen_saturation: r.oxygen_saturation,
            recorded_at: r.recorded_at || r.created_at || new Date().toISOString(),
        }));
    },
};
