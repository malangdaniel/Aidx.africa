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

    static async bookConsultation(doctorId: string, patientId: string, scheduledAt: Date, price: number, notes?: string) {
        const { data, error } = await supabase
            .from('consultations')
            .insert({
                doctor_id: doctorId,
                patient_id: patientId,
                status: 'scheduled',
                scheduled_at: scheduledAt.toISOString(),
                price: price,
                notes: notes
            })
            .select()
            .single();

        if (error) throw error;
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
        console.log("Completing consultation:", consultationId);
        const { error: consultError } = await supabase
            .from('consultations')
            .update({
                status: 'completed',
                notes: notes,
                diagnosis: diagnosis,
                ended_at: new Date().toISOString()
            })
            .eq('id', consultationId);

        if (consultError) {
            console.error("Error updating consultation:", consultError);
            throw consultError;
        }

        // 2. Create Prescription Record (if any)
        if (prescriptions.length > 0) {
            console.log("Saving prescriptions:", prescriptions.length);
            const { error: rxError } = await supabase
                .from('prescriptions')
                .insert({
                    consultation_id: consultationId,
                    doctor_id: user.id,
                    patient_id: patientId,
                    prescription_data: { medications: prescriptions }
                });

            if (rxError) {
                console.error("Error saving prescriptions:", rxError);
                throw rxError;
            }
        }

        // 3. Save Lab Orders (if any)
        if (labOrders.length > 0) {
            console.log("Saving lab orders:", labOrders.length);
            await this.saveLabOrders(consultationId, patientId, labOrders);
        }
    }

    /**
     * openFromElite — pre-fills a consultation request with an Elite clinical packet.
     * Called by EliteDashboard when an alert warrants doctor review.
     * The packet is serialised into the consultation notes; doctor can view it during consult.
     */
    static async openFromElite(packet: {
        userId: string;
        generatedAt: string;
        scores?: Record<string, any> | null;
        alerts?: Array<{ alert_level: string; reason: string }>;
        geminiSummary?: string;
    }): Promise<{ consultationId: string | null }> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const packetNote = [
            '=== AiDx Elite Clinical Summary ===',
            `Generated At: ${packet.generatedAt}`,
            '',
            'Health Indices:',
            packet.scores ? JSON.stringify(packet.scores, null, 2) : 'N/A',
            '',
            'Active Alerts:',
            (packet.alerts ?? []).map(a => `  [${a.alert_level.toUpperCase()}] ${a.reason}`).join('\n') || '  None',
            '',
            'AI Interpretation:',
            packet.geminiSummary ?? 'Not generated.',
            '',
            '=== END ELITE PACKET ===',
        ].join('\n');

        // Insert a pending consultation record pre-filled with elite data
        const { data, error } = await supabase
            .from('consultations')
            .insert({
                patient_id: user.id,
                status: 'pending',
                notes: packetNote,
                scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // default: tomorrow
                price: 0,
            })
            .select('id')
            .single();

        if (error) {
            console.error('ConsultationService.openFromElite error:', error);
            // Non-fatal: return null and let caller handle (e.g., redirect to DoctorSearch)
            return { consultationId: null };
        }

        return { consultationId: data.id };
    }
}
