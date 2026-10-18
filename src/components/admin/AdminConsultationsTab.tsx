import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    User,
    Clock,
    DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminRpcService, AdminConsultationRow } from '@/services/AdminRpcService';

const PAGE_SIZE = 25;

export default function AdminConsultationsTab() {
    const [consultations, setConsultations] = useState<AdminConsultationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(0);

    const loadConsultations = async () => {
        setLoading(true);
        try {
            const data = await AdminRpcService.listConsultations({
                status: statusFilter === 'all' ? null : statusFilter,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });
            setConsultations(data);
        } catch (err: any) {
            console.error('Error listing consultations:', err);
            toast.error(err.message || 'Failed to load consultations.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConsultations();
    }, [page, statusFilter]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Completed</Badge>;
            case 'scheduled':
                return <Badge variant="outline" className="border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/40">Scheduled</Badge>;
            case 'ongoing':
                return <Badge variant="default" className="bg-primary animate-pulse">Ongoing</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getPaymentBadge = (paymentStatus: string) => {
        switch (paymentStatus) {
            case 'escrowed':
                return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30">Escrow Held</Badge>;
            case 'released':
                return <Badge variant="outline" className="border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">Paid to Doctor</Badge>;
            case 'refunded':
                return <Badge variant="outline" className="border-muted text-muted-foreground">Refunded</Badge>;
            default:
                return <Badge variant="outline">{paymentStatus || '—'}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Consultations History</h2>
                    <p className="text-xs text-muted-foreground">
                        Monitor virtual consultations, session lifecycles, and escrow payments
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
                        <SelectTrigger className="w-[160px] text-xs">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="ongoing">Ongoing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={loadConsultations} disabled={loading} className="gap-1.5">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading consultations...</p>
                        </div>
                    ) : consultations.length === 0 ? (
                        <div className="text-center py-16 space-y-2 text-muted-foreground">
                            <Calendar className="w-10 h-10 mx-auto opacity-40" />
                            <p className="text-sm font-medium">No consultations found</p>
                            <p className="text-xs">No records match the selected filter criteria.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-muted/30 text-muted-foreground">
                                    <th className="p-3 font-semibold">Consultation ID</th>
                                    <th className="p-3 font-semibold">Doctor</th>
                                    <th className="p-3 font-semibold">Patient</th>
                                    <th className="p-3 font-semibold">Scheduled For</th>
                                    <th className="p-3 font-semibold">Price</th>
                                    <th className="p-3 font-semibold">Status</th>
                                    <th className="p-3 font-semibold">Payment / Escrow</th>
                                    <th className="p-3 font-semibold">Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {consultations.map((c) => (
                                    <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                            {c.id.slice(0, 8)}...
                                        </td>
                                        <td className="p-3 font-semibold text-foreground">
                                            {c.doctor_name || 'Assigned Doctor'}
                                        </td>
                                        <td className="p-3 text-foreground">
                                            {c.patient_name || 'Patient'}
                                        </td>
                                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                                            {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : 'TBD'}
                                        </td>
                                        <td className="p-3 font-bold text-foreground">
                                            ₦{Number(c.price || 0).toLocaleString()}
                                        </td>
                                        <td className="p-3">
                                            {getStatusBadge(c.status)}
                                        </td>
                                        <td className="p-3">
                                            {getPaymentBadge(c.payment_status)}
                                        </td>
                                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                                            {new Date(c.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>

                {/* Pagination */}
                <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
                    <div>
                        Showing page {page + 1} ({consultations.length} items listed)
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0 || loading}
                            className="h-8 gap-1"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={consultations.length < PAGE_SIZE || loading}
                            className="h-8 gap-1"
                        >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
