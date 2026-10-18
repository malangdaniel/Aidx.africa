import { supabase } from '@/integrations/supabase/client';

export interface AdminOverviewData {
    period_days?: number;
    users?: {
        total?: number;
        new_in_period?: number;
        pending_verification?: number;
        by_role?: Record<string, number>;
    };
    consultations?: {
        total?: number;
        completed?: number;
        scheduled?: number;
        ongoing?: number;
        cancelled?: number;
        overdue_not_started?: number;
        by_status?: Record<string, number>;
    };
    orders?: {
        total?: number;
        delivered?: number;
        average_delivery_hours?: number;
        by_tracking_status?: Record<string, number>;
    };
    money?: {
        total_wallet_balances?: number;
        escrow_held?: number;
        platform_revenue_period?: number;
        platform_revenue_all_time?: number;
        deposits_period?: number;
        failed_deposits_period?: number;
        pending_withdrawals_count?: number;
        pending_withdrawals_amount?: number;
        wallets_out_of_sync_with_ledger?: number;
    };
    ai?: {
        diagnoses_period?: number;
        flagged_unreviewed?: number;
        doctor_agreement_rate?: number;
        by_severity?: Record<string, number>;
    };
    support?: {
        open?: number;
        urgent?: number;
    };
    low_rated_doctors?: Array<{ id: string; name: string; rating: number; review_count: number }>;
    low_stock_items?: Array<{ id: string; name: string; pharmacy_name: string; stock: number }>;
    [key: string]: any;
}

export interface AdminUserRow {
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    verification_status: string;
    license_number?: string | null;
    business_name?: string | null;
    created_at: string;
}

export interface AdminConsultationRow {
    id: string;
    scheduled_at: string;
    status: string;
    payment_status: string;
    price: number;
    patient_name: string;
    doctor_name: string;
    created_at: string;
}

export interface AdminOrderRow {
    child_order_id: string;
    order_id: string;
    buyer_name: string;
    pharmacy_name: string;
    total_amount: number;
    tracking_status: string;
    status: string;
    settlement_status: string;
    has_rx_items: boolean;
    created_at: string;
}

export interface AdminWithdrawalRow {
    id: string;
    user_id: string;
    name: string;
    role: string;
    amount: number;
    bank_name: string;
    account_number: string;
    account_name: string;
    status: string;
    requested_at: string;
    payment_reference?: string | null;
}

export interface AdminFlaggedDiagnosisRow {
    id: string;
    created_at: string;
    condition: string;
    severity: string;
    confidence_percentage: number;
    flag_reason: string;
    reviewed_at?: string | null;
    doctor_agreed?: boolean | null;
}

export interface SupportTicketRow {
    id: string;
    reporter_id: string;
    reporter_name?: string;
    reporter_email?: string;
    category: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    assigned_to?: string | null;
    resolution_note?: string | null;
    consultation_id?: string | null;
    order_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface AuditLogRow {
    id: string;
    user_id: string | null;
    user_email?: string | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    old_values?: any;
    new_values?: any;
    ip_address?: string | null;
    created_at: string;
}

export interface PlatformSettingRow {
    key: string;
    value: any;
    description?: string | null;
    updated_at?: string;
}

export class AdminRpcService {
    static async getOverview(days = 30): Promise<AdminOverviewData> {
        const { data, error } = await (supabase.rpc as any)('admin_overview', {
            p_days: days,
        });
        if (error) throw error;
        return (data || {}) as AdminOverviewData;
    }

    static async listUsers(params: {
        role?: string | null;
        status?: string | null;
        search?: string | null;
        limit?: number;
        offset?: number;
    }): Promise<AdminUserRow[]> {
        const { data, error } = await (supabase.rpc as any)('admin_list_users', {
            p_role: params.role || null,
            p_status: params.status || null,
            p_search: params.search || null,
            p_limit: params.limit ?? 50,
            p_offset: params.offset ?? 0,
        });
        if (error) throw error;
        return (data || []) as AdminUserRow[];
    }

    static async setVerification(userId: string, status: string, reason?: string | null) {
        const { data, error } = await (supabase.rpc as any)('admin_set_verification', {
            p_user_id: userId,
            p_status: status,
            p_reason: reason || null,
        });
        if (error) throw error;
        return data;
    }

    static async grantRole(userId: string, role: string) {
        const { data, error } = await (supabase.rpc as any)('admin_grant_role', {
            p_user_id: userId,
            p_role: role,
        });
        if (error) throw error;
        return data;
    }

    static async listConsultations(params: {
        status?: string | null;
        limit?: number;
        offset?: number;
    }): Promise<AdminConsultationRow[]> {
        const { data, error } = await (supabase.rpc as any)('admin_list_consultations', {
            p_status: params.status || null,
            p_limit: params.limit ?? 50,
            p_offset: params.offset ?? 0,
        });
        if (error) throw error;
        return (data || []) as AdminConsultationRow[];
    }

    static async listOrders(params: {
        status?: string | null;
        limit?: number;
        offset?: number;
    }): Promise<AdminOrderRow[]> {
        const { data, error } = await (supabase.rpc as any)('admin_list_orders', {
            p_status: params.status || null,
            p_limit: params.limit ?? 50,
            p_offset: params.offset ?? 0,
        });
        if (error) throw error;
        return (data || []) as AdminOrderRow[];
    }

    static async listWithdrawals(params: {
        status?: string | null;
        limit?: number;
        offset?: number;
    }): Promise<AdminWithdrawalRow[]> {
        const { data, error } = await (supabase.rpc as any)('admin_list_withdrawals', {
            p_status: params.status || null,
            p_limit: params.limit ?? 50,
            p_offset: params.offset ?? 0,
        });
        if (error) throw error;
        return (data || []) as AdminWithdrawalRow[];
    }

    static async processWithdrawal(params: {
        withdrawalId: string;
        action: 'approve' | 'mark_paid' | 'reject';
        reference?: string | null;
        reason?: string | null;
    }) {
        const { data, error } = await (supabase.rpc as any)('admin_process_withdrawal', {
            p_withdrawal_id: params.withdrawalId,
            p_action: params.action,
            p_reference: params.reference || null,
            p_reason: params.reason || null,
        });
        if (error) throw error;
        return data;
    }

    static async listFlaggedDiagnoses(params: {
        limit?: number;
        offset?: number;
    }): Promise<AdminFlaggedDiagnosisRow[]> {
        const { data, error } = await (supabase.rpc as any)('admin_list_flagged_diagnoses', {
            p_limit: params.limit ?? 50,
            p_offset: params.offset ?? 0,
        });
        if (error) throw error;
        return (data || []) as AdminFlaggedDiagnosisRow[];
    }

    static async updateTicket(params: {
        ticketId: string;
        status?: string | null;
        priority?: string | null;
        assignedTo?: string | null;
        note?: string | null;
    }) {
        const { data, error } = await (supabase.rpc as any)('admin_update_ticket', {
            p_ticket_id: params.ticketId,
            p_status: params.status ?? null,
            p_priority: params.priority ?? null,
            p_assigned_to: params.assignedTo ?? null,
            p_note: params.note ?? null,
        });
        if (error) throw error;
        return data;
    }

    static async updateSetting(key: string, value: any) {
        const { data, error } = await (supabase.rpc as any)('admin_update_setting', {
            p_key: key,
            p_value: value,
        });
        if (error) throw error;
        return data;
    }

    static async getPrivateIdSignedUrl(path: string): Promise<string | null> {
        try {
            const { data, error } = await supabase.storage.from('ids').createSignedUrl(path, 3600);
            if (error) throw error;
            return data?.signedUrl ?? null;
        } catch (err) {
            console.error('Error creating signed URL for ID:', err);
            return null;
        }
    }
}
