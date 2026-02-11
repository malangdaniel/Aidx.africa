import { supabase } from '@/integrations/supabase/client';

export interface PatientRecord {
    id: string;
    user_id: string;
    allergies: string[];
    chronic_conditions: string[];
    family_history: string[];
    current_medications: { name: string; dosage: string; frequency: string }[];
    past_surgeries: { condition: string; details: string; year: string }[];
    social_history: { smoker: boolean; alcohol: boolean; details?: string };
}

export const PatientRecordService = {
    /**
     * Get patient medical record by user ID.
     */
    getRecord: async (patientId: string): Promise<PatientRecord | null> => {
        const { data, error } = await supabase
            .from('patient_records')
            .select('*')
            .eq('user_id', patientId)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Create or update patient medical record.
     */
    updateRecord: async (patientId: string, updates: Partial<PatientRecord>) => {
        // First check if exists
        const { data: existing } = await supabase
            .from('patient_records')
            .select('id')
            .eq('user_id', patientId)
            .maybeSingle();

        if (existing) {
            const { data, error } = await supabase
                .from('patient_records')
                .update(updates)
                .eq('user_id', patientId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('patient_records')
                .insert({ user_id: patientId, ...updates })
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    /**
     * Get patient profile including medical demographics.
     */
    getPatientProfile: async (patientId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('first_name, last_name, gender, date_of_birth, blood_group')
            .eq('user_id', patientId)
            .single();

        if (error) throw error;
        return data;
    }
};
