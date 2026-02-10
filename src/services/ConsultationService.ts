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

export class ConsultationService {
    // --- CHAT ---
    // Note: consultation_chat_messages table does not exist yet.
    // These methods are stubs until the table is created.

    static async sendMessage(consultationId: string, message: string) {
        console.warn("ConsultationService.sendMessage: consultation_chat_messages table not yet created.");
    }

    static subscribeToMessages(consultationId: string, onMessage: (msg: ChatMessage) => void) {
        console.warn("ConsultationService.subscribeToMessages: consultation_chat_messages table not yet created.");
        return supabase.channel(`consultation_chat:${consultationId}`).subscribe();
    }

    static async getChatHistory(consultationId: string): Promise<ChatMessage[]> {
        console.warn("ConsultationService.getChatHistory: consultation_chat_messages table not yet created.");
        return [];
    }

    // --- ACTIONS ---

    static async saveLabOrders(consultationId: string, patientId: string, orders: LabOrder[]) {
        if (orders.length === 0) return;
        console.warn("ConsultationService.saveLabOrders: lab_orders table not yet created.");
    }

    static async completeConsultation(
        consultationId: string,
        patientId: string,
        notes: string,
        diagnosis: string,
        prescriptions: any[],
        labOrders: LabOrder[]
    ) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // 1. Update Consultation Status & Notes
        const { error: consultError } = await supabase
            .from('consultations')
            .update({
                status: 'completed',
                notes: notes,
                diagnosis: diagnosis,
                ended_at: new Date().toISOString()
            })
            .eq('id', consultationId);

        if (consultError) throw consultError;

        // 2. Create Prescription Record (if any)
        if (prescriptions.length > 0) {
            const { error: rxError } = await supabase
                .from('prescriptions')
                .insert({
                    consultation_id: consultationId,
                    doctor_id: user.id,
                    patient_id: patientId,
                    prescription_data: { medications: prescriptions }
                });

            if (rxError) throw rxError;
        }

        // 3. Save Lab Orders (stub)
        await this.saveLabOrders(consultationId, patientId, labOrders);
    }
}
