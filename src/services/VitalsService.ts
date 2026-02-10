export interface VitalRecord {
    id: string;
    user_id: string;
    systolic?: number;
    diastolic?: number;
    heart_rate?: number;
    weight?: number;
    temperature?: number;
    oxygen_saturation?: number;
    recorded_at: string;
}

// Stub: vitals table does not exist yet.
export const VitalsService = {
    getVitals: async (limit = 30): Promise<VitalRecord[]> => {
        console.warn("VitalsService.getVitals: vitals table not yet created.");
        return [];
    },

    logVitals: async (vitals: Partial<Omit<VitalRecord, 'id' | 'user_id' | 'recorded_at'>>) => {
        console.warn("VitalsService.logVitals: vitals table not yet created.");
        return null;
    },

    getPatientVitals: async (patientId: string, limit = 30): Promise<VitalRecord[]> => {
        console.warn("VitalsService.getPatientVitals: vitals table not yet created.");
        return [];
    }
};
