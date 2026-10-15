import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Plus,
    Wallet,
    Shield,
    RefreshCw,
    ArrowDownLeft,
    ArrowUpRight,
    Video,
    Pill,
    RotateCcw,
    Lock,
    ExternalLink,
    Clock,
    CheckCircle2,
    AlertCircle,
    Info,
} from 'lucide-react';
import { WalletService, WalletTransaction, WalletTransactionType } from '@/services/WalletService';
import DepositFundsModal from './DepositFundsModal';
import { toast } from 'sonner';

interface WalletViewProps {
    balance: number;
    escrow: number;
    onRefresh?: () => void;
}

export default function WalletView({ balance: initialBalance, escrow: initialEscrow, onRefresh }: WalletViewProps) {
    const [balance, setBalance] = useState(initialBalance);
    const [escrow, setEscrow] = useState(initialEscrow);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [filterType, setFilterType] = useState<WalletTransactionType | 'all'>('all');
    const [loading, setLoading] = useState(false);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

    useEffect(() => {
        setBalance(initialBalance);
        setEscrow(initialEscrow);
    }, [initialBalance, initialEscrow]);

    useEffect(() => {
        loadTransactions();
    }, [filterType]);

    const loadWalletData = async () => {
        setLoading(true);
        try {
            const walletInfo = await WalletService.getWallet();
            if (walletInfo) {
                setBalance(walletInfo.balance);
                setEscrow(walletInfo.escrowBalance);
            }
            await loadTransactions();
            if (onRefresh) onRefresh();
            toast.success('Wallet refreshed');
        } catch (err) {
            console.error('Failed to reload wallet:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadTransactions = async () => {
        try {
            const txs = await WalletService.getTransactions({
                type: filterType,
                limit: 40,
            });
            setTransactions(txs);
        } catch (err) {
            console.error('Failed to load wallet transactions:', err);
        }
    };

    const handleDepositSuccess = () => {
        loadWalletData();
    };

    const getTxIcon = (type: WalletTransactionType) => {
        switch (type) {
            case 'deposit':
                return <ArrowDownLeft className="w-4 h-4 text-emerald-600" />;
            case 'consultation_payment':
                return <Video className="w-4 h-4 text-blue-600" />;
            case 'pharmacy_order':
                return <Pill className="w-4 h-4 text-amber-600" />;
            case 'refund':
                return <RotateCcw className="w-4 h-4 text-purple-600" />;
            case 'escrow_hold':
            case 'escrow_release':
                return <Shield className="w-4 h-4 text-indigo-600" />;
            default:
                return <Wallet className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getTxBadge = (type: WalletTransactionType) => {
        switch (type) {
            case 'deposit':
                return <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">Deposit</Badge>;
            case 'consultation_payment':
                return <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">Consultation</Badge>;
            case 'pharmacy_order':
                return <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">Pharmacy</Badge>;
            case 'refund':
                return <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">Refund</Badge>;
            default:
                return <Badge variant="outline">Transaction</Badge>;
        }
    };

    const formatDate = (isoStr: string) => {
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return isoStr;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Title and Refresh */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <span>Patient Healthcare Wallet</span>
                        <Badge variant="secondary" className="text-xs font-medium">NGN Only</Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Secure closed-loop wallet for appointments, medication delivery, and verified medical escrow
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadWalletData}
                    disabled={loading}
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Wallet Balances Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Available Balance Card */}
                <Card className="relative overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-secondary/10 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Available Balance
                            </span>
                            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Ready to Spend</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                                ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Available for immediate booking of doctor visits & pharmacy checkout
                            </p>
                        </div>
                        <Button
                            onClick={() => setIsDepositModalOpen(true)}
                            className="w-full gap-2 shadow-sm font-semibold"
                            size="sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Funds
                        </Button>
                    </CardContent>
                </Card>

                {/* Escrow Balance Card */}
                <Card className="border-dashed border-border/80 bg-muted/20">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Held in Escrow
                            </span>
                            <div className="flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                <Shield className="w-3 h-3" />
                                <span>Protected</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight opacity-80 text-foreground">
                                ₦{escrow.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Reserved for scheduled consultations and pending pharmacy deliveries
                            </p>
                        </div>
                        <div className="rounded-lg bg-background/80 border p-2.5 text-[11px] text-muted-foreground space-y-1">
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                                <Lock className="w-3.5 h-3.5 text-primary" />
                                <span>Escrow Protection Guarantee</span>
                            </div>
                            <p>
                                Funds are only released to the doctor or pharmacy once your consultation or medication delivery is confirmed. If cancelled, funds return directly to your balance.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Closed-loop policy alert */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-start gap-3">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-foreground">Sanari Closed-Loop Health Wallet</p>
                    <p className="text-muted-foreground leading-relaxed">
                        This wallet operates in Nigerian Naira (NGN) exclusively for healthcare services provided through Sanari.ai. In compliance with financial safeguarding standards, wallet funds cannot be transferred to external bank accounts or third parties.
                    </p>
                </div>
            </div>

            {/* Transaction History Section */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold tracking-tight">Ledger & Transaction History</h3>
                        <p className="text-xs text-muted-foreground">Audited, immutable log of all credits and escrow debits</p>
                    </div>

                    {/* Filter Tabs */}
                    <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)} className="w-auto">
                        <TabsList className="h-8 p-0.5 text-xs">
                            <TabsTrigger value="all" className="text-xs px-2.5 py-1">All</TabsTrigger>
                            <TabsTrigger value="deposit" className="text-xs px-2.5 py-1">Deposits</TabsTrigger>
                            <TabsTrigger value="consultation_payment" className="text-xs px-2.5 py-1">Consults</TabsTrigger>
                            <TabsTrigger value="pharmacy_order" className="text-xs px-2.5 py-1">Pharmacy</TabsTrigger>
                            <TabsTrigger value="refund" className="text-xs px-2.5 py-1">Refunds</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Transactions List */}
                <div className="space-y-2">
                    {transactions.length > 0 ? (
                        transactions.map((tx) => {
                            const isPositive = tx.amount > 0;
                            return (
                                <div
                                    key={tx.id}
                                    className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-muted/60 shrink-0">
                                            {getTxIcon(tx.type)}
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-xs sm:text-sm text-foreground">
                                                    {tx.description}
                                                </span>
                                                {getTxBadge(tx.type)}
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                <span>{formatDate(tx.createdAt)}</span>
                                                <span>•</span>
                                                <span className="font-mono">{tx.reference}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className={`font-bold text-xs sm:text-sm ${
                                            isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                                        }`}>
                                            {isPositive ? '+' : ''}₦{Math.abs(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            Balance: ₦{tx.balanceAfter.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-10 rounded-xl border border-dashed border-border/80 bg-muted/10 space-y-2">
                            <Wallet className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                            <p className="text-xs font-medium text-muted-foreground">
                                No transactions found in this category.
                            </p>
                            {filterType === 'all' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsDepositModalOpen(true)}
                                    className="text-xs gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Fund your wallet to get started
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Deposit Funds Modal */}
            <DepositFundsModal
                isOpen={isDepositModalOpen}
                onClose={() => setIsDepositModalOpen(false)}
                onDepositSuccess={handleDepositSuccess}
            />
        </div>
    );
}
