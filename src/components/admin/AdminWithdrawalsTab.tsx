import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    DollarSign,
    CheckCircle,
    XCircle,
    Building2,
    CreditCard,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    Send
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminRpcService, AdminWithdrawalRow } from '@/services/AdminRpcService';

const PAGE_SIZE = 25;

export default function AdminWithdrawalsTab() {
    const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(0);

    // Modal state for mark_paid or reject
    const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawalRow | null>(null);
    const [actionModal, setActionModal] = useState<'mark_paid' | 'reject' | null>(null);
    const [referenceInput, setReferenceInput] = useState('');
    const [reasonInput, setReasonInput] = useState('');
    const [processing, setProcessing] = useState(false);

    const loadWithdrawals = async () => {
        setLoading(true);
        try {
            const data = await AdminRpcService.listWithdrawals({
                status: statusFilter === 'all' ? null : statusFilter,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });
            setWithdrawals(data);
        } catch (err: any) {
            console.error('Error listing withdrawals:', err);
            toast.error(err.message || 'Failed to load withdrawal requests.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWithdrawals();
    }, [page, statusFilter]);

    const handleApprove = async (withdrawal: AdminWithdrawalRow) => {
        setProcessing(true);
        try {
            await AdminRpcService.processWithdrawal({
                withdrawalId: withdrawal.id,
                action: 'approve',
            });
            toast.success(`Withdrawal of ₦${Number(withdrawal.amount).toLocaleString()} approved for payout.`);
            loadWithdrawals();
        } catch (err: any) {
            console.error('Approval error:', err);
            toast.error(err.message || 'Failed to approve withdrawal.');
        } finally {
            setProcessing(false);
        }
    };

    const handleConfirmModalAction = async () => {
        if (!selectedWithdrawal || !actionModal) return;

        if (actionModal === 'mark_paid' && !referenceInput.trim()) {
            toast.error('Please enter the bank transfer reference or transaction ID.');
            return;
        }

        if (actionModal === 'reject' && !reasonInput.trim()) {
            toast.error('Please provide a reason for rejecting the withdrawal.');
            return;
        }

        setProcessing(true);
        try {
            await AdminRpcService.processWithdrawal({
                withdrawalId: selectedWithdrawal.id,
                action: actionModal,
                reference: actionModal === 'mark_paid' ? referenceInput.trim() : null,
                reason: actionModal === 'reject' ? reasonInput.trim() : null,
            });

            toast.success(
                actionModal === 'mark_paid'
                    ? `Withdrawal marked as paid with reference ${referenceInput}.`
                    : `Withdrawal rejected and balance restored.`
            );

            setSelectedWithdrawal(null);
            setActionModal(null);
            setReferenceInput('');
            setReasonInput('');
            loadWithdrawals();
        } catch (err: any) {
            console.error('Action error:', err);
            toast.error(err.message || 'Failed to process withdrawal action.');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Paid / Disbursed</Badge>;
            case 'approved':
                return <Badge variant="outline" className="border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/30">Approved (Ready to Pay)</Badge>;
            case 'pending':
                return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30">Pending Review</Badge>;
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
                    <h2 className="text-xl font-bold tracking-tight">Withdrawal Requests & Payouts</h2>
                    <p className="text-xs text-muted-foreground">
                        Review practitioner payout claims, copy bank details for transfer, and reconcile disbursements
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
                        <SelectTrigger className="w-[160px] text-xs">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="pending">Pending Review</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={loadWithdrawals} disabled={loading} className="gap-1.5">
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
                            <p className="text-sm text-muted-foreground">Loading withdrawal requests...</p>
                        </div>
                    ) : withdrawals.length === 0 ? (
                        <div className="text-center py-16 space-y-2 text-muted-foreground">
                            <DollarSign className="w-10 h-10 mx-auto opacity-40" />
                            <p className="text-sm font-medium">No withdrawal requests found</p>
                            <p className="text-xs">No records match the current status criteria.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-muted/30 text-muted-foreground">
                                    <th className="p-3 font-semibold">User</th>
                                    <th className="p-3 font-semibold">Role</th>
                                    <th className="p-3 font-semibold">Amount</th>
                                    <th className="p-3 font-semibold">Banking Details</th>
                                    <th className="p-3 font-semibold">Status</th>
                                    <th className="p-3 font-semibold">Requested At</th>
                                    <th className="p-3 font-semibold">Payment Ref</th>
                                    <th className="p-3 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {withdrawals.map((w) => (
                                    <tr key={w.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="p-3">
                                            <div className="font-semibold text-foreground">{w.name}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono">{w.user_id.slice(0, 8)}...</div>
                                        </td>
                                        <td className="p-3">
                                            <Badge variant="outline" className="capitalize text-[10px]">
                                                {w.role}
                                            </Badge>
                                        </td>
                                        <td className="p-3 font-bold text-foreground">
                                            ₦{Number(w.amount || 0).toLocaleString()}
                                        </td>
                                        <td className="p-3">
                                            <div className="font-medium text-foreground">{w.bank_name}</div>
                                            <div className="font-mono text-muted-foreground text-[11px]">
                                                {w.account_number} • {w.account_name}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            {getStatusBadge(w.status)}
                                        </td>
                                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                                            {new Date(w.requested_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-3 font-mono text-muted-foreground">
                                            {w.payment_reference || '—'}
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {w.status === 'pending' && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleApprove(w)}
                                                            disabled={processing}
                                                            className="h-7 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                                                        >
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => {
                                                                setSelectedWithdrawal(w);
                                                                setActionModal('reject');
                                                                setReasonInput('');
                                                            }}
                                                            disabled={processing}
                                                            className="h-7 text-xs"
                                                        >
                                                            Reject
                                                        </Button>
                                                    </>
                                                )}

                                                {w.status === 'approved' && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedWithdrawal(w);
                                                                setActionModal('mark_paid');
                                                                setReferenceInput('');
                                                            }}
                                                            disabled={processing}
                                                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        >
                                                            Mark Paid
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                setSelectedWithdrawal(w);
                                                                setActionModal('reject');
                                                                setReasonInput('');
                                                            }}
                                                            disabled={processing}
                                                            className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                                        >
                                                            Reject
                                                        </Button>
                                                    </>
                                                )}

                                                {w.status === 'paid' && (
                                                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                                        <CheckCircle className="w-3.5 h-3.5" /> Settled
                                                    </span>
                                                )}

                                                {w.status === 'rejected' && (
                                                    <span className="text-[11px] text-destructive">
                                                        Rejected
                                                    </span>
                                                )}
                                            </div>
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
                        Showing page {page + 1} ({withdrawals.length} withdrawals listed)
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
                            disabled={withdrawals.length < PAGE_SIZE || loading}
                            className="h-8 gap-1"
                        >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Action Dialog (Mark Paid / Reject) */}
            {selectedWithdrawal && actionModal && (
                <Dialog open={!!selectedWithdrawal} onOpenChange={(open) => !open && !processing && setSelectedWithdrawal(null)}>
                    <DialogContent className="sm:max-w-[440px]">
                        <DialogHeader>
                            <DialogTitle>
                                {actionModal === 'mark_paid' ? 'Mark Withdrawal as Paid' : 'Reject Withdrawal Request'}
                            </DialogTitle>
                            <DialogDescription>
                                {actionModal === 'mark_paid'
                                    ? `Confirm manual bank transfer of ₦${Number(selectedWithdrawal.amount).toLocaleString()} to ${selectedWithdrawal.name}.`
                                    : `Reject the ₦${Number(selectedWithdrawal.amount).toLocaleString()} withdrawal request from ${selectedWithdrawal.name}. The funds will be restored to their wallet.`
                                }
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-2">
                            <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1 font-mono">
                                <p><span className="text-muted-foreground font-sans">Bank:</span> {selectedWithdrawal.bank_name}</p>
                                <p><span className="text-muted-foreground font-sans">Account No:</span> {selectedWithdrawal.account_number}</p>
                                <p><span className="text-muted-foreground font-sans">Account Name:</span> {selectedWithdrawal.account_name}</p>
                            </div>

                            {actionModal === 'mark_paid' ? (
                                <div className="space-y-1.5">
                                    <Label htmlFor="bank-ref">Bank Transfer Reference / Session ID (Required)</Label>
                                    <Input
                                        id="bank-ref"
                                        placeholder="e.g. NIP-20261018-9842187654"
                                        value={referenceInput}
                                        onChange={(e) => setReferenceInput(e.target.value)}
                                        className="text-xs"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        This reference will be visible to the recipient on their transaction history.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <Label htmlFor="reject-reason">Reason for Rejection (Required)</Label>
                                    <Textarea
                                        id="reject-reason"
                                        placeholder="e.g. Invalid account name mismatch, suspect account activity..."
                                        value={reasonInput}
                                        onChange={(e) => setReasonInput(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            )}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setSelectedWithdrawal(null)} disabled={processing}>
                                Cancel
                            </Button>
                            <Button
                                variant={actionModal === 'mark_paid' ? 'default' : 'destructive'}
                                onClick={handleConfirmModalAction}
                                disabled={processing}
                                className={actionModal === 'mark_paid' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                            >
                                {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {actionModal === 'mark_paid' ? 'Confirm Payment Complete' : 'Confirm Rejection'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
