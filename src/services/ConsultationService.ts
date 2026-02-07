import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
    id: string;
    sender_id: string;
    sender_role?: 'doctor' | 'patient'; // derived
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

    static async sendMessage(consultationId: string, message: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
            .from('consultation_chat_messages')
            .insert({
                consultation_id: consultationId,
                sender_id: user.id,
                message: message.trim()
            });

        if (error) throw error;
    }

    static subscribeToMessages(consultationId: string, onMessage: (msg: ChatMessage) => void) {
        // 1. Load existing history
        this.getChatHistory(consultationId).then(msgs => msgs.forEach(onMessage));

        // 2. Subscribe to new
        return supabase
            .channel(`consultation_chat:${consultationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'consultation_chat_messages',
                    filter: `consultation_id=eq.${consultationId}`
                },
                (payload) => {
                    onMessage(payload.new as ChatMessage);
                }
            )
            .subscribe();
    }

    static async getChatHistory(consultationId: string): Promise<ChatMessage[]> {
        const { data, error } = await supabase
            .from('consultation_chat_messages')
            .select('*')
            .eq('consultation_id', consultationId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    // --- ACTIONS ---

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

    static async completeConsultation(
        consultationId: string,
        patientId: string,
        notes: string,
        diagnosis: string,
        prescriptions: any[], // Type from PharmacyService logic or custom
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

        // 3. Save Lab Orders (if any, checks empty inside)
        await this.saveLabOrders(consultationId, patientId, labOrders);
    }
}
