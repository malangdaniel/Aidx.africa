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

// Stub: patient_records table does not exist yet.
export const PatientRecordService = {
    getRecord: async (patientId: string): Promise<PatientRecord | null> => {
        console.warn("PatientRecordService.getRecord: patient_records table not yet created.");
        return null;
    },

    updateRecord: async (patientId: string, updates: Partial<PatientRecord>) => {
        console.warn("PatientRecordService.updateRecord: patient_records table not yet created.");
        return null;
    }
};
