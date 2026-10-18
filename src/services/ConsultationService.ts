import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
    id: string;
    sender_id: string;
    sender_role?: 'doctor' | 'patient';
    message: string;
    created_at: string;
}

export interface LabOrder {
    test_name: string;
    urgency: 'routine' | 'urgent' | 'stat';
    reason: string;
}

export interface ClinicalFields {
    notes?: string;
    diagnosis?: string;
    chiefComplaint?: string;
    physicalExam?: string;
    differentialDiagnosis?: string;
    referral?: string;
    followUpPlan?: string;
    symptomChecklist?: string[];
    clinicalSummary?: string;
}

export interface PastReport {
    id: string;
    date: string;
    doctorName: string;
    diagnosis?: string | null;
    notes?: string | null;
    chiefComplaint?: string | null;
    physicalExam?: string | null;
    differentialDiagnosis?: string | null;
    referral?: string | null;
    followUpPlan?: string | null;
    symptomChecklist: string[];
    clinicalSummary?: string | null;
    medications: { name?: string; dosage?: string; frequency?: string; duration?: string }[];
}


export class ConsultationService {
    // --- CHAT ---
    // Note: consultation_chat_messages table doesn't exist yet.
    // Chat is handled via Supabase Realtime broadcast channels for now.

    static async sendMessage(_consultationId: string, _message: string) {
        console.warn("ConsultationService.sendMessage: consultation_chat_messages table not yet created. Using Realtime broadcast instead.");
    }

    static subscribeToMessages(_consultationId: string, _onMessage: (msg: ChatMessage) => void) {
        console.warn("ConsultationService.subscribeToMessages: consultation_chat_messages table not yet created. Using Realtime broadcast instead.");
        return null;
    }

    static async getChatHistory(_consultationId: string): Promise<ChatMessage[]> {
        console.warn("ConsultationService.getChatHistory: consultation_chat_messages table not yet created.");
        return [];
    }

    // --- ACTIONS ---

    static async bookConsultation(doctorId: string, _patientId: string, scheduledAt: Date, price: number, notes?: string) {
        const { data, error } = await (supabase.rpc as any)('charge_wallet_consultation', {
            p_doctor_id: doctorId,
            p_scheduled_at: scheduledAt.toISOString(),
            p_price: Number(price || 0),
            p_notes: notes || null,
        });

        if (error) {
            throw new Error(error.message || 'Failed to book consultation');
        }

        return data;
    }

    static async saveLabOrders(consultationId: string, patientId: string, orders: LabOrder[]) {
        if (orders.length === 0) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const payload = orders.map(o => ({
            consultation_id: consultationId,
            doctor_id: user.id,
            patient_id: patientId,
            test_name: o.test_name,
            urgency: o.urgency,
            reason: o.reason,
            status: 'pending'
        }));

        const { error } = await supabase
            .from('lab_orders')
            .insert(payload);

        if (error) throw error;
    }

    /** Persist in-progress clinical fields without finalizing the consultation. */
    static async saveDraft(consultationId: string, fields: ClinicalFields) {
        const { error } = await supabase
            .from('consultations')
            .update({
                notes: fields.notes ?? null,
                diagnosis: fields.diagnosis ?? null,
                chief_complaint: fields.chiefComplaint ?? null,
                physical_exam: fields.physicalExam ?? null,
                differential_diagnosis: fields.differentialDiagnosis ?? null,
                referral: fields.referral ?? null,
                follow_up_plan: fields.followUpPlan ?? null,
                symptom_checklist: fields.symptomChecklist ?? [],
                clinical_summary: fields.clinicalSummary ?? null,
            })
            .eq('id', consultationId);

        if (error) throw error;
    }

    static async completeConsultation(
        consultationId: string,
        patientId: string,
        fields: ClinicalFields,
        prescriptions: any[],
        labOrders: LabOrder[]
    ) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // 1. Update consultation with all clinical fields + finalize
        const { error: consultError } = await supabase
            .from('consultations')
            .update({
                status: 'completed',
                notes: fields.notes ?? null,
                diagnosis: fields.diagnosis ?? null,
                chief_complaint: fields.chiefComplaint ?? null,
                physical_exam: fields.physicalExam ?? null,
                differential_diagnosis: fields.differentialDiagnosis ?? null,
                referral: fields.referral ?? null,
                follow_up_plan: fields.followUpPlan ?? null,
                symptom_checklist: fields.symptomChecklist ?? [],
                clinical_summary: fields.clinicalSummary ?? null,
                ended_at: new Date().toISOString(),
                finalized_at: new Date().toISOString(),
            })
            .eq('id', consultationId);

        if (consultError) {
            console.error("Error updating consultation:", consultError);
            throw consultError;
        }

        // 2. Create Prescription Record (if any)
        if (prescriptions.length > 0) {
            const { error: rxError } = await supabase
                .from('prescriptions')
                .insert({
                    consultation_id: consultationId,
                    doctor_id: user.id,
                    patient_id: patientId,
                    prescription_data: { medications: prescriptions },
                    notes: fields.notes ?? null,
                });

            if (rxError) {
                console.error("Error saving prescriptions:", rxError);
                throw rxError;
            }
        }

        // 3. Save Lab Orders (if any)
        if (labOrders.length > 0) {
            await this.saveLabOrders(consultationId, patientId, labOrders);
        }
    }

    /** Load the saved clinical record for a consultation. */
    static async getConsultationRecord(consultationId: string) {
        const { data, error } = await supabase
            .from('consultations')
            .select('*')
            .eq('id', consultationId)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Read-only history of a patient's previous consultations (with prescriptions),
     * accessible to any doctor who is treating that patient.
     */
    static async getPatientHistory(patientId: string, excludeConsultationId?: string): Promise<PastReport[]> {
        const { data, error } = await supabase
            .from('consultations')
            .select('id, doctor_id, scheduled_at, ended_at, created_at, status, notes, diagnosis, chief_complaint, physical_exam, differential_diagnosis, referral, follow_up_plan, symptom_checklist, clinical_summary')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const rows = (data || []).filter(
            (c: any) => c.id !== excludeConsultationId && (c.status === 'completed' || c.diagnosis || c.notes)
        );
        if (rows.length === 0) return [];

        const consultIds = rows.map((r: any) => r.id);
        const doctorIds = [...new Set(rows.map((r: any) => r.doctor_id))];

        const [{ data: rxData }, { data: docs }] = await Promise.all([
            supabase
                .from('prescriptions')
                .select('consultation_id, prescription_data')
                .in('consultation_id', consultIds),
            supabase
                .from('profiles')
                .select('user_id, first_name, last_name')
                .in('user_id', doctorIds),
        ]);

        const docMap = new Map((docs || []).map((d: any) => [d.user_id, `Dr. ${d.first_name || ''} ${d.last_name || ''}`.trim()]));
        const rxMap = new Map<string, any[]>();
        (rxData || []).forEach((r: any) => {
            const meds = r.prescription_data?.medications || [];
            rxMap.set(r.consultation_id, [...(rxMap.get(r.consultation_id) || []), ...meds]);
        });

        return rows.map((r: any) => ({
            id: r.id,
            date: r.ended_at || r.scheduled_at || r.created_at,
            doctorName: docMap.get(r.doctor_id) || 'Doctor',
            diagnosis: r.diagnosis,
            notes: r.notes,
            chiefComplaint: r.chief_complaint,
            physicalExam: r.physical_exam,
            differentialDiagnosis: r.differential_diagnosis,
            referral: r.referral,
            followUpPlan: r.follow_up_plan,
            symptomChecklist: Array.isArray(r.symptom_checklist) ? r.symptom_checklist : [],
            clinicalSummary: r.clinical_summary,
            medications: rxMap.get(r.id) || [],
        }));
    }
}

