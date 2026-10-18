import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Wallet,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    RefreshCw,
    Loader2,
    Search,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    ArrowUpRight,
    ArrowDownLeft,
    Info,
} from 'lucide-react';
import { toast } from 'sonner';

/* ── interfaces ────────────────────────────────────────────── */
interface WalletRow {
    user_id: string;
    owner_name: string;
    owner_email: string;
    owner_role: string;
    balance: number;
    escrow_balance: number;
}

interface DepositRow {
    id: string;
    user_id: string;
    owner_name: string;
    amount_kobo: number;
    provider: string;
    provider_reference: string | null;
    status: string;
    created_at: string;
}

interface TxRow {
    id: string;
    owner_name: string;
    owner_role: string;
    type: string;
    direction: 'credit' | 'debit';
    amount_kobo: number;
    balance_after_kobo: number;
    description: string | null;
    reference: string | null;
    created_at: string;
}

interface Summary {
    totalWallets: number;
    totalBalanceNaira: number;
    totalEscrowNaira: number;
    pendingDeposits: number;
    pendingDepositAmountKobo: number;
}

const PAGE_SIZE = 25;

const fmtNaira = (n: number) =>
    `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const fmtKobo = (k: number) =>
    `₦${(k / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const depositBadge = (s: string) => {
    switch (s) {
        case 'completed': return { label: 'Completed', variant: 'default' as const, Icon: CheckCircle };
        case 'pending':   return { label: 'Pending',   variant: 'secondary' as const, Icon: Clock };
        case 'failed':    return { label: 'Failed',    variant: 'destructive' as const, Icon: XCircle };
        default:          return { label: s,            variant: 'outline' as const,    Icon: Info };
    }
};

/* ════════════════════════════════════════════════════════════ */
export default function AdminWalletTab() {
    const [view, setView] = useState<'wallets' | 'deposits' | 'ledger'>('wallets');

    // wallets
    const [wallets, setWallets]           = useState<WalletRow[]>([]);
    const [walletSearch, setWalletSearch] = useState('');
    const [walletLoading, setWalletLoading] = useState(false);

    // deposits
    const [deposits, setDeposits]                   = useState<DepositRow[]>([]);
    const [depositFilter, setDepositFilter]         = useState('all');
    const [depositPage, setDepositPage]             = useState(0);
    const [depositLoading, setDepositLoading]       = useState(false);

    // ledger
    const [txs, setTxs]             = useState<TxRow[]>([]);
    const [txPage, setTxPage]       = useState(0);
    const [txLoading, setTxLoading] = useState(false);

    // summary
    const [summary, setSummary] = useState<Summary | null>(null);

    useEffect(() => { fetchSummary(); }, []);
    useEffect(() => { if (view === 'wallets')  fetchWallets();  }, [view, walletSearch]);
    useEffect(() => { if (view === 'deposits') fetchDeposits(); }, [view, depositFilter, depositPage]);
    useEffect(() => { if (view === 'ledger')   fetchLedger();   }, [view, txPage]);

    async function fetchSummary() {
        try {
            const { data: ws } = await supabase.from('wallets').select('balance, escrow_balance');
            const { count: pendingCount } = await supabase
                .from('wallet_deposits').select('id', { count: 'exact', head: true }).eq('status', 'pending');
            const { data: pendingAmts } = await supabase
                .from('wallet_deposits').select('amount_kobo').eq('status', 'pending');
            setSummary({
                totalWallets: (ws || []).length,
                totalBalanceNaira: (ws || []).reduce((s, w) => s + (w.balance || 0), 0),
                totalEscrowNaira:  (ws || []).reduce((s, w) => s + (w.escrow_balance || 0), 0),
                pendingDeposits: pendingCount || 0,
                pendingDepositAmountKobo: (pendingAmts || []).reduce((s, d) => s + (d.amount_kobo || 0), 0),
            });
        } catch (err) { console.error('Summary error:', err); }
    }

    async function fetchWallets() {
        setWalletLoading(true);
        try {
            const { data, error } = await supabase
                .from('wallets')
                .select('user_id, balance, escrow_balance, profiles:user_id(first_name,last_name,email,role)')
                .order('balance', { ascending: false })
                .limit(100);
            if (error) throw error;

            const rows: WalletRow[] = (data || []).map((w: any) => {
                const p = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles || {};
                return {
                    user_id: w.user_id,
                    owner_name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
                    owner_email: p.email || '—',
                    owner_role: p.role || '—',
                    balance: w.balance || 0,
                    escrow_balance: w.escrow_balance || 0,
                };
            });

            const s = walletSearch.toLowerCase();
            setWallets(s ? rows.filter(r =>
                r.owner_name.toLowerCase().includes(s) || r.owner_email.toLowerCase().includes(s)
            ) : rows);
        } catch (err: any) {
            toast.error(err.message || 'Failed to load wallets');
        } finally { setWalletLoading(false); }
    }

    async function fetchDeposits() {
        setDepositLoading(true);
        try {
            let q = supabase
                .from('wallet_deposits')
                .select('id, user_id, amount_kobo, provider, provider_reference, status, created_at, profiles:user_id(first_name,last_name)')
                .order('created_at', { ascending: false })
                .range(depositPage * PAGE_SIZE, depositPage * PAGE_SIZE + PAGE_SIZE - 1);
            if (depositFilter !== 'all') q = q.eq('status', depositFilter);
            const { data, error } = await q;
            if (error) throw error;
            setDeposits((data || []).map((d: any) => {
                const p = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles || {};
                return { ...d, owner_name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown' };
            }));
        } catch (err: any) {
            toast.error(err.message || 'Failed to load deposits');
        } finally { setDepositLoading(false); }
    }

    async function fetchLedger() {
        setTxLoading(true);
        try {
            const { data, error } = await supabase
                .from('wallet_transactions')
                .select('id, wallet_id, type, direction, amount_kobo, balance_after_kobo, description, reference, created_at, wallets:wallet_id(user_id, profiles:user_id(first_name,last_name,role))')
                .order('created_at', { ascending: false })
                .range(txPage * PAGE_SIZE, txPage * PAGE_SIZE + PAGE_SIZE - 1);
            if (error) throw error;
            setTxs((data || []).map((t: any) => {
                const w = t.wallets || {};
                const p = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles || {};
                return {
                    id: t.id,
                    owner_name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
                    owner_role: p.role || '—',
                    type: t.type,
                    direction: t.direction,
                    amount_kobo: t.amount_kobo,
                    balance_after_kobo: t.balance_after_kobo,
                    description: t.description,
                    reference: t.reference,
                    created_at: t.created_at,
                };
            }));
        } catch (err: any) {
            toast.error(err.message || 'Failed to load ledger');
        } finally { setTxLoading(false); }
    }

    const refresh = () => {
        fetchSummary();
        if (view === 'wallets')  fetchWallets();
        if (view === 'deposits') fetchDeposits();
        if (view === 'ledger')   fetchLedger();
    };

    return (
        <div className="space-y-6">
            {/* Summary */}
            {summary && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Card className="bg-primary/5 border-primary/20 shadow-none">
                        <CardContent className="p-4">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-primary/70 mb-1">Total Wallets</p>
                            <p className="text-2xl font-black text-primary">{summary.totalWallets}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-500/5 border-emerald-500/20 shadow-none">
                        <CardContent className="p-4">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-700/70 mb-1">Total Balances</p>
                            <p className="text-base font-black text-emerald-700">{fmtNaira(summary.totalBalanceNaira)}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-500/5 border-amber-500/20 shadow-none">
                        <CardContent className="p-4">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-amber-700/70 mb-1">In Escrow</p>
                            <p className="text-base font-black text-amber-700">{fmtNaira(summary.totalEscrowNaira)}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-500/5 border-blue-500/20 shadow-none">
                        <CardContent className="p-4">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-blue-700/70 mb-1">Pending Deposits</p>
                            <p className="text-2xl font-black text-blue-700">{summary.pendingDeposits}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-500/5 border-blue-500/20 shadow-none">
                        <CardContent className="p-4">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-blue-700/70 mb-1">Pending Value</p>
                            <p className="text-base font-black text-blue-700">{fmtKobo(summary.pendingDepositAmountKobo)}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Notice */}
            <Card className="border-amber-400/30 bg-amber-50/30 dark:bg-amber-900/10">
                <CardContent className="flex items-start gap-3 p-4">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                        <strong>Read-only view.</strong> Wallet balances cannot be edited from this interface. Use corrective trusted RPC functions only. Never allow direct balance editing.
                    </p>
                </CardContent>
            </Card>

            {/* View switcher */}
            <div className="flex gap-2 border-b pb-2 overflow-x-auto scrollbar-hide">
                {(['wallets', 'deposits', 'ledger'] as const).map((v) => (
                    <Button key={v} variant={view === v ? 'default' : 'ghost'} size="sm"
                        onClick={() => setView(v)} className="capitalize shrink-0 text-xs h-8">
                        {v === 'wallets'  && <Wallet     className="w-3.5 h-3.5 mr-1.5" />}
                        {v === 'deposits' && <ArrowDownLeft className="w-3.5 h-3.5 mr-1.5" />}
                        {v === 'ledger'   && <TrendingUp  className="w-3.5 h-3.5 mr-1.5" />}
                        {v}
                    </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={refresh} className="ml-auto shrink-0 h-8 text-xs">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
                </Button>
            </div>

            {/* WALLETS */}
            {view === 'wallets' && (
                <div className="space-y-4">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Search by name or email…" value={walletSearch}
                            onChange={(e) => setWalletSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                    </div>
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-3 font-semibold">Owner</th>
                                        <th className="text-left p-3 font-semibold">Role</th>
                                        <th className="text-right p-3 font-semibold">Balance (₦)</th>
                                        <th className="text-right p-3 font-semibold">Escrow (₦)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {walletLoading ? (
                                        <tr><td colSpan={4} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                                    ) : wallets.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No wallets found</td></tr>
                                    ) : wallets.map((w) => (
                                        <tr key={w.user_id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3">
                                                <p className="font-semibold">{w.owner_name}</p>
                                                <p className="text-muted-foreground">{w.owner_email}</p>
                                            </td>
                                            <td className="p-3"><Badge variant="outline" className="text-[10px]">{w.owner_role}</Badge></td>
                                            <td className="p-3 text-right font-mono font-bold">{fmtNaira(w.balance)}</td>
                                            <td className="p-3 text-right font-mono text-amber-700">{fmtNaira(w.escrow_balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* DEPOSITS */}
            {view === 'deposits' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {['all', 'pending', 'completed', 'failed'].map((s) => (
                            <Button key={s} variant={depositFilter === s ? 'default' : 'outline'} size="sm"
                                onClick={() => { setDepositFilter(s); setDepositPage(0); }}
                                className="capitalize h-8 text-xs">{s}</Button>
                        ))}
                    </div>
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-3 font-semibold">User</th>
                                        <th className="text-left p-3 font-semibold">Provider</th>
                                        <th className="text-left p-3 font-semibold">Reference</th>
                                        <th className="text-right p-3 font-semibold">Amount</th>
                                        <th className="text-center p-3 font-semibold">Status</th>
                                        <th className="text-left p-3 font-semibold">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {depositLoading ? (
                                        <tr><td colSpan={6} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                                    ) : deposits.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No deposits found</td></tr>
                                    ) : deposits.map((d) => {
                                        const b = depositBadge(d.status);
                                        return (
                                            <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 font-semibold">{d.owner_name}</td>
                                                <td className="p-3 capitalize text-muted-foreground">{d.provider}</td>
                                                <td className="p-3 font-mono text-muted-foreground truncate max-w-[120px]">{d.provider_reference || '—'}</td>
                                                <td className="p-3 text-right font-bold font-mono">{fmtKobo(d.amount_kobo)}</td>
                                                <td className="p-3 text-center">
                                                    <Badge variant={b.variant} className="text-[10px] gap-1">
                                                        <b.Icon className="w-3 h-3" />{b.label}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(d.created_at).toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                    <div className="flex items-center justify-between">
                        <Button variant="outline" size="sm" onClick={() => setDepositPage(p => Math.max(0, p - 1))} disabled={depositPage === 0} className="h-8 text-xs gap-1">
                            <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </Button>
                        <span className="text-xs text-muted-foreground">Page {depositPage + 1}</span>
                        <Button variant="outline" size="sm" onClick={() => setDepositPage(p => p + 1)} disabled={deposits.length < PAGE_SIZE} className="h-8 text-xs gap-1">
                            Next <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* LEDGER */}
            {view === 'ledger' && (
                <div className="space-y-4">
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-3 font-semibold">Owner</th>
                                        <th className="text-left p-3 font-semibold">Type</th>
                                        <th className="text-right p-3 font-semibold">Amount</th>
                                        <th className="text-right p-3 font-semibold">Balance After</th>
                                        <th className="text-left p-3 font-semibold">Note</th>
                                        <th className="text-left p-3 font-semibold">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {txLoading ? (
                                        <tr><td colSpan={6} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                                    ) : txs.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No transactions found</td></tr>
                                    ) : txs.map((t) => (
                                        <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3">
                                                <p className="font-semibold">{t.owner_name}</p>
                                                <Badge variant="outline" className="text-[9px]">{t.owner_role}</Badge>
                                            </td>
                                            <td className="p-3">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${t.direction === 'credit' ? 'text-emerald-600' : 'text-destructive'}`}>
                                                    {t.direction === 'credit'
                                                        ? <ArrowDownLeft className="w-3 h-3" />
                                                        : <ArrowUpRight className="w-3 h-3" />}
                                                    {t.type.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className={`p-3 text-right font-bold font-mono ${t.direction === 'credit' ? 'text-emerald-700' : 'text-destructive'}`}>
                                                {t.direction === 'credit' ? '+' : '-'}{fmtKobo(t.amount_kobo)}
                                            </td>
                                            <td className="p-3 text-right font-mono text-muted-foreground">{fmtKobo(t.balance_after_kobo)}</td>
                                            <td className="p-3 text-muted-foreground max-w-[160px] truncate">{t.description || t.reference || '—'}</td>
                                            <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                    <div className="flex items-center justify-between">
                        <Button variant="outline" size="sm" onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0} className="h-8 text-xs gap-1">
                            <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </Button>
                        <span className="text-xs text-muted-foreground">Page {txPage + 1}</span>
                        <Button variant="outline" size="sm" onClick={() => setTxPage(p => p + 1)} disabled={txs.length < PAGE_SIZE} className="h-8 text-xs gap-1">
                            Next <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
