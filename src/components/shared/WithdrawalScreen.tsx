import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    DollarSign,
    Building2,
    CreditCard,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    RefreshCw,
    Wallet,
    ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';

interface WithdrawalItem {
    id: string;
    amount: number;
    bank_name: string;
    account_number: string;
    account_name: string;
    status: string;
    requested_at: string;
    payment_reference?: string | null;
}

export default function WithdrawalScreen({ title = "Earnings & Withdrawals" }: { title?: string }) {
    const { user } = useAuth();
    const [balance, setBalance] = useState<number>(0);
    const [escrowBalance, setEscrowBalance] = useState<number>(0);
    const [minWithdrawal, setMinWithdrawal] = useState<number>(5000);
    const [pastWithdrawals, setPastWithdrawals] = useState<WithdrawalItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form inputs
    const [amount, setAmount] = useState<string>('');
    const [bankName, setBankName] = useState<string>('');
    const [accountNumber, setAccountNumber] = useState<string>('');
    const [accountName, setAccountName] = useState<string>('');

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [walletRes, settingsRes, withdrawalsRes] = await Promise.all([
                supabase.from('wallets').select('balance, escrow_balance').eq('user_id', user.id).maybeSingle(),
                supabase.from('platform_settings').select('value').eq('key', 'min_withdrawal_ngn').maybeSingle(),
                supabase.from('withdrawals').select('*').eq('user_id', user.id).order('requested_at', { ascending: false }),
            ]);

            if (walletRes.data) {
                setBalance(Number(walletRes.data.balance || 0));
                setEscrowBalance(Number(walletRes.data.escrow_balance || 0));
            }

            if (settingsRes.data?.value !== undefined) {
                setMinWithdrawal(Number(settingsRes.data.value) || 5000);
            }

            if (withdrawalsRes.data) {
                setPastWithdrawals(withdrawalsRes.data as WithdrawalItem[]);
            }
        } catch (err: any) {
            console.error('Error loading withdrawal data:', err);
            toast.error(err.message || 'Failed to load earnings and withdrawal history.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user]);

    const handleSubmitWithdrawal = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);

        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error('Please enter a valid withdrawal amount.');
            return;
        }

        if (numAmount < minWithdrawal) {
            toast.error(`Minimum withdrawal amount is ₦${minWithdrawal.toLocaleString()}.`);
            return;
        }

        if (numAmount > balance) {
            toast.error(`Insufficient available balance. You have ₦${balance.toLocaleString()} available.`);
            return;
        }

        if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
            toast.error('Please provide complete bank account details.');
            return;
        }

        if (accountNumber.trim().length < 10) {
            toast.error('Account number must be at least 10 digits.');
            return;
        }

        setSubmitting(true);
        try {
            const { data, error } = await (supabase.rpc as any)('request_withdrawal', {
                p_amount: numAmount,
                p_bank_name: bankName.trim(),
                p_account_number: accountNumber.trim(),
                p_account_name: accountName.trim(),
            });

            if (error) throw error;

            toast.success(`Withdrawal request of ₦${numAmount.toLocaleString()} submitted for processing.`);
            setAmount('');
            loadData();
        } catch (err: any) {
            console.error('Withdrawal error:', err);
            toast.error(err.message || 'Failed to submit withdrawal request.');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Paid</Badge>;
            case 'approved':
                return <Badge variant="outline" className="border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/30">Approved</Badge>;
            case 'pending':
                return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30">Pending</Badge>;
            case 'rejected':
                return <Badge variant="destructive">Rejected</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold">{title}</h2>
                    <p className="text-xs text-muted-foreground">
                        Withdraw earned funds directly into your Nigerian bank account
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5 self-start sm:self-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Wallet Balances Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary flex items-center justify-between">
                            Available Balance
                            <Wallet className="w-4 h-4" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tight text-primary">
                            ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Available for withdrawal (Min: ₦{minWithdrawal.toLocaleString()})
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                            Escrow Balance
                            <Clock className="w-4 h-4" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tight text-muted-foreground">
                            ₦{escrowBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Pending consultation completion or delivery confirmation
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Request Withdrawal Form */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-primary" />
                        Request Bank Payout
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Funds are disbursed via bank transfer after administrative verification
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="w-amount" className="text-xs font-semibold">Amount (₦)</Label>
                                <Input
                                    id="w-amount"
                                    type="number"
                                    placeholder={`Min. ₦${minWithdrawal.toLocaleString()}`}
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="text-xs font-mono"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="w-bank" className="text-xs font-semibold">Bank Name</Label>
                                <Input
                                    id="w-bank"
                                    placeholder="e.g. Zenith Bank, GTBank, First Bank..."
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    className="text-xs"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="w-acc-num" className="text-xs font-semibold">Account Number (10 digits)</Label>
                                <Input
                                    id="w-acc-num"
                                    placeholder="0123456789"
                                    maxLength={10}
                                    value={accountNumber}
                                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                                    className="text-xs font-mono"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="w-acc-name" className="text-xs font-semibold">Account Name (Matching Account)</Label>
                                <Input
                                    id="w-acc-name"
                                    placeholder="Account holder name"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    className="text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                type="submit"
                                disabled={submitting || balance < minWithdrawal}
                                className="text-xs gap-2"
                            >
                                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Submit Withdrawal Request
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Past Withdrawals List */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Withdrawal History
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : pastWithdrawals.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-xs">
                            No past withdrawal requests found.
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-muted/30 text-muted-foreground">
                                    <th className="p-3 font-semibold">Date</th>
                                    <th className="p-3 font-semibold">Amount</th>
                                    <th className="p-3 font-semibold">Bank / Account</th>
                                    <th className="p-3 font-semibold">Status</th>
                                    <th className="p-3 font-semibold">Payment Ref</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pastWithdrawals.map((w) => (
                                    <tr key={w.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                                            {new Date(w.requested_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-3 font-bold text-foreground">
                                            ₦{Number(w.amount).toLocaleString()}
                                        </td>
                                        <td className="p-3">
                                            <div>{w.bank_name}</div>
                                            <div className="text-[11px] text-muted-foreground font-mono">
                                                {w.account_number} • {w.account_name}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            {getStatusBadge(w.status)}
                                        </td>
                                        <td className="p-3 font-mono text-muted-foreground">
                                            {w.payment_reference || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
