import { supabase } from '@/integrations/supabase/client';

export interface WalletInfo {
    id: string;
    userId: string;
    balance: number;
    escrowBalance: number;
    currency: 'NGN';
    updatedAt: string;
}

export type WalletTransactionType =
    | 'deposit'
    | 'consultation_payment'
    | 'pharmacy_order'
    | 'refund'
    | 'escrow_hold'
    | 'escrow_release';

export type WalletTransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export interface WalletTransaction {
    id: string;
    userId: string;
    walletId: string;
    amount: number;
    amountKobo: number;
    balanceAfter: number;
    balanceAfterKobo: number;
    type: WalletTransactionType;
    status: WalletTransactionStatus;
    reference: string;
    description: string;
    metadata: Record<string, any>;
    createdAt: string;
}

export interface WalletDeposit {
    id: string;
    amount: number;
    amountKobo: number;
    fee: number;
    totalAmount: number;
    currency: 'NGN';
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    reference: string;
    provider: string;
    providerCheckoutUrl?: string;
    createdAt: string;
    completedAt?: string;
}

export interface DepositInitResponse {
    success: boolean;
    reference: string;
    amount: number;
    currency: string;
    isSandbox?: boolean;
    checkoutUrl?: string;
    accessCode?: string;
    sandboxNotice?: string;
    error?: string;
}

export interface DepositVerifyResponse {
    success: boolean;
    credited?: boolean;
    alreadyCredited?: boolean;
    isSandbox?: boolean;
    balance?: number;
    message?: string;
    error?: string;
}

export class WalletService {
    /**
     * Get the authenticated patient's current wallet balance and escrow
     */
    static async getWallet(): Promise<WalletInfo | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('wallets' as any)
            .select('id, user_id, balance, escrow_balance, updated_at')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            console.error('Failed to fetch wallet:', error);
            throw error;
        }

        if (!data) return null;

        return {
            id: (data as any).id,
            userId: (data as any).user_id,
            balance: Number((data as any).balance || 0),
            escrowBalance: Number((data as any).escrow_balance || 0),
            currency: 'NGN',
            updatedAt: (data as any).updated_at,
        };
    }

    /**
     * Get paginated ledger transactions for current patient
     */
    static async getTransactions(options?: {
        type?: WalletTransactionType | 'all';
        limit?: number;
        offset?: number;
    }): Promise<WalletTransaction[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        let query = supabase
            .from('wallet_transactions' as any)
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (options?.type && options.type !== 'all') {
            query = query.eq('type', options.type);
        }

        const limit = options?.limit ?? 30;
        const offset = options?.offset ?? 0;
        query = query.range(offset, offset + limit - 1);

        const { data, error } = await query;
        if (error) {
            console.error('Failed to fetch transactions:', error);
            throw error;
        }

        return (data || []).map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            walletId: row.wallet_id,
            amount: Number(row.amount),
            amountKobo: Number(row.amount_kobo),
            balanceAfter: Number(row.balance_after),
            balanceAfterKobo: Number(row.balance_after_kobo),
            type: row.type,
            status: row.status,
            reference: row.reference,
            description: row.description,
            metadata: row.metadata || {},
            createdAt: row.created_at,
        }));
    }

    /**
     * Initialize a wallet deposit (Paystack or Sandbox)
     */
    static async initializeDeposit(amount: number): Promise<DepositInitResponse> {
        const { data, error } = await supabase.functions.invoke('wallet-deposit', {
            body: {
                action: 'initialize',
                amount: Math.round(amount),
            },
        });

        if (error) {
            let message = error.message;
            const ctx = (error as any)?.context;
            if (ctx && typeof ctx.text === 'function') {
                try {
                    const raw = await ctx.text();
                    const parsed = JSON.parse(raw);
                    message = parsed.error || message;
                } catch {
                    /* keep message */
                }
            }
            throw new Error(message);
        }

        return data as DepositInitResponse;
    }

    /**
     * Verify a wallet deposit reference
     */
    static async verifyDeposit(reference: string): Promise<DepositVerifyResponse> {
        const { data, error } = await supabase.functions.invoke('wallet-deposit', {
            body: {
                action: 'verify',
                reference,
            },
        });

        if (error) {
            let message = error.message;
            const ctx = (error as any)?.context;
            if (ctx && typeof ctx.text === 'function') {
                try {
                    const raw = await ctx.text();
                    const parsed = JSON.parse(raw);
                    message = parsed.error || message;
                } catch {
                    /* keep message */
                }
            }
            throw new Error(message);
        }

        return data as DepositVerifyResponse;
    }

    /**
     * Refund an eligible consultation (releases escrow back to patient balance)
     */
    static async refundConsultation(consultationId: string, reason?: string) {
        const { data, error } = await supabase.rpc('refund_consultation_escrow' as any, {
            p_consultation_id: consultationId,
            p_reason: reason || 'Patient cancelled consultation',
        });

        if (error) {
            console.error('Consultation refund error:', error);
            throw error;
        }

        return data;
    }
}
