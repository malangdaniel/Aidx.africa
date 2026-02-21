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
     * Note: patient_records table doesn't exist yet — returns null.
     */
    getRecord: async (_patientId: string): Promise<PatientRecord | null> => {
        console.warn("PatientRecordService.getRecord: patient_records table not yet created.");
        return null;
    },

    /**
     * Create or update patient medical record.
     * Note: patient_records table doesn't exist yet — no-op.
     */
    updateRecord: async (_patientId: string, _updates: Partial<PatientRecord>) => {
        console.warn("PatientRecordService.updateRecord: patient_records table not yet created.");
        return null;
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
