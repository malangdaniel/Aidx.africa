import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Users,
    Calendar,
    ShoppingCart,
    DollarSign,
    Brain,
    Headphones,
    AlertTriangle,
    ShieldAlert,
    TrendingUp,
    Clock,
    CheckCircle,
    Loader2,
    RefreshCw,
    PackageX
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminRpcService, AdminOverviewData } from '@/services/AdminRpcService';

export default function AdminOverviewTab() {
    const [period, setPeriod] = useState<number>(30);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AdminOverviewData | null>(null);

    const fetchOverview = async (days = period) => {
        setLoading(true);
        try {
            const res = await AdminRpcService.getOverview(days);
            setData(res);
        } catch (err: any) {
            console.error('Error fetching admin overview:', err);
            toast.error(err.message || 'Failed to load platform overview.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOverview(period);
    }, [period]);

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading platform analytics...</p>
            </div>
        );
    }

    const money = data?.money;
    const users = data?.users;
    const consultations = data?.consultations;
    const orders = data?.orders;
    const ai = data?.ai;
    const support = data?.support;
    const outOfSync = money?.wallets_out_of_sync_with_ledger ?? 0;

    return (
        <div className="space-y-6">
            {/* Header + Period Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Platform Overview</h2>
                    <p className="text-xs text-muted-foreground">
                        Live system health, volume, and operational metrics
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border bg-muted/30 p-1">
                        {[7, 30, 90].map((d) => (
                            <Button
                                key={d}
                                variant={period === d ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setPeriod(d)}
                                className="h-7 text-xs px-3"
                            >
                                {d} Days
                            </Button>
                        ))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchOverview(period)}
                        disabled={loading}
                        className="h-9 gap-1.5"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Reconciliation Warning (if out of sync) */}
            {outOfSync !== 0 && (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/30 flex items-center gap-3 text-red-600 dark:text-red-400">
                    <ShieldAlert className="w-6 h-6 shrink-0" />
                    <div className="flex-1 text-sm">
                        <p className="font-bold">Reconciliation problem: investigate</p>
                        <p className="text-xs opacity-90">
                            {outOfSync} user wallet(s) differ from their transaction ledger records. Audit the ledger immediately.
                        </p>
                    </div>
                </div>
            )}

            {/* Key Financial Health Cards */}
            {money && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center justify-between">
                                Platform Revenue
                                <DollarSign className="w-4 h-4" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-primary">
                                ₦{Number(money.platform_revenue_period ?? 0).toLocaleString()}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                All time: ₦{Number(money.platform_revenue_all_time ?? 0).toLocaleString()}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                User Wallets
                                <TrendingUp className="w-4 h-4 text-green-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black">
                                ₦{Number(money.total_wallet_balances ?? 0).toLocaleString()}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Escrow held: ₦{Number(money.escrow_held ?? 0).toLocaleString()}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                Period Deposits
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black">
                                ₦{Number(money.deposits_period ?? 0).toLocaleString()}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Failed deposits: {money.failed_deposits_period ?? 0}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className={outOfSync !== 0 ? 'border-destructive bg-destructive/10' : ''}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                                Ledger Integrity
                                <AlertTriangle className={`w-4 h-4 ${outOfSync !== 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-black ${outOfSync !== 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                {outOfSync === 0 ? 'In Sync (0)' : `${outOfSync} Discrepancies`}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Pending withdrawals: {money.pending_withdrawals_count ?? 0} (₦{Number(money.pending_withdrawals_amount ?? 0).toLocaleString()})
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* User & Consultation Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Users Card */}
                {users && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                Users Overview
                            </CardTitle>
                            <CardDescription>Accounts & onboarding state</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Total registered users</span>
                                <span className="font-bold">{users.total ?? 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">New in last {period} days</span>
                                <span className="font-bold text-primary">+{users.new_in_period ?? 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Pending verification</span>
                                <Badge variant={users.pending_verification ? 'destructive' : 'secondary'}>
                                    {users.pending_verification ?? 0}
                                </Badge>
                            </div>
                            {users.by_role && (
                                <div className="pt-2">
                                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">By Role</p>
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div className="p-2 bg-muted/40 rounded-lg">
                                            <p className="text-muted-foreground text-[10px]">Patients</p>
                                            <p className="font-bold text-sm">{users.by_role.patient ?? 0}</p>
                                        </div>
                                        <div className="p-2 bg-muted/40 rounded-lg">
                                            <p className="text-muted-foreground text-[10px]">Doctors</p>
                                            <p className="font-bold text-sm">{users.by_role.doctor ?? 0}</p>
                                        </div>
                                        <div className="p-2 bg-muted/40 rounded-lg">
                                            <p className="text-muted-foreground text-[10px]">Pharmacies</p>
                                            <p className="font-bold text-sm">{users.by_role.pharmacist ?? 0}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Consultations Card */}
                {consultations && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                Consultations
                            </CardTitle>
                            <CardDescription>Clinical appointments activity</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Completed</span>
                                <span className="font-bold text-green-600">{consultations.completed ?? 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Scheduled / Ongoing</span>
                                <span className="font-bold">
                                    {(consultations.scheduled ?? 0) + (consultations.ongoing ?? 0)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Cancelled</span>
                                <span className="font-bold text-muted-foreground">{consultations.cancelled ?? 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Overdue not started</span>
                                <Badge variant={consultations.overdue_not_started ? 'destructive' : 'secondary'}>
                                    {consultations.overdue_not_started ?? 0}
                                </Badge>
                            </div>
                            {consultations.by_status && (
                                <div className="pt-2 text-xs text-muted-foreground flex justify-between">
                                    <span>Total recorded:</span>
                                    <span className="font-bold text-foreground">{consultations.total ?? 0}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Pharmacy Orders Card */}
                {orders && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <ShoppingCart className="w-4 h-4 text-primary" />
                                Medication Orders
                            </CardTitle>
                            <CardDescription>Pharmacy fulfillment metrics</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Total orders</span>
                                <span className="font-bold">{orders.total ?? 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Delivered successfully</span>
                                <span className="font-bold text-green-600">{orders.delivered ?? 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Avg. delivery time</span>
                                <span className="font-bold">
                                    {orders.average_delivery_hours ? `${orders.average_delivery_hours.toFixed(1)} hrs` : 'N/A'}
                                </span>
                            </div>
                            {orders.by_tracking_status && (
                                <div className="pt-2">
                                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">In Pipeline</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(orders.by_tracking_status).map(([status, count]) => (
                                            <Badge key={status} variant="outline" className="text-[11px]">
                                                {status.replace('_', ' ')}: {count}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* AI Diagnostics & Support Tickets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ai && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Brain className="w-4 h-4 text-purple-600" />
                                AI Diagnostics Safety
                            </CardTitle>
                            <CardDescription>Clinical AI usage and safety benchmarks</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Diagnoses in period</span>
                                <span className="font-bold">{ai.diagnoses_period ?? 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Flagged unreviewed</span>
                                <Badge variant={ai.flagged_unreviewed ? 'destructive' : 'secondary'}>
                                    {ai.flagged_unreviewed ?? 0}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Doctor agreement rate</span>
                                <span className="font-bold text-green-600">
                                    {ai.doctor_agreement_rate !== undefined ? `${(ai.doctor_agreement_rate * 100).toFixed(1)}%` : 'N/A'}
                                </span>
                            </div>
                            {ai.by_severity && (
                                <div className="pt-2 flex gap-2">
                                    {Object.entries(ai.by_severity).map(([sev, count]) => (
                                        <Badge key={sev} variant="outline" className="text-xs capitalize">
                                            {sev}: {count}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {support && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Headphones className="w-4 h-4 text-blue-600" />
                                Support Helpdesk
                            </CardTitle>
                            <CardDescription>User inquiries & incident queue</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Open tickets</span>
                                <span className="font-bold">{support.open ?? 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                                <span className="text-sm text-muted-foreground">Urgent priority</span>
                                <Badge variant={support.urgent ? 'destructive' : 'secondary'}>
                                    {support.urgent ?? 0}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Low-rated doctors & low-stock items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data?.low_rated_doctors && data.low_rated_doctors.length > 0 && (
                    <Card className="border-amber-500/20 bg-amber-500/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-amber-700 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Low-Rated Doctors Notice
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {data.low_rated_doctors.map((doc) => (
                                <div key={doc.id} className="flex justify-between items-center text-xs py-1 border-b border-amber-200">
                                    <span className="font-semibold">{doc.name}</span>
                                    <Badge variant="outline" className="border-amber-400 text-amber-800">
                                        ⭐ {doc.rating.toFixed(1)} ({doc.review_count} reviews)
                                    </Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {data?.low_stock_items && data.low_stock_items.length > 0 && (
                    <Card className="border-amber-500/20 bg-amber-500/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-amber-700 flex items-center gap-2">
                                <PackageX className="w-4 h-4" />
                                Low Stock Medications
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {data.low_stock_items.map((item) => (
                                <div key={item.id} className="flex justify-between items-center text-xs py-1 border-b border-amber-200">
                                    <div>
                                        <p className="font-semibold">{item.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{item.pharmacy_name}</p>
                                    </div>
                                    <Badge variant="destructive" className="text-xs">
                                        {item.stock} left
                                    </Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
