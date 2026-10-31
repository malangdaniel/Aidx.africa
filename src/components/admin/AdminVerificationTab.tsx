import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    CheckCircle,
    XCircle,
    FileText,
    ExternalLink,
    Loader2,
    RefreshCw,
    ShieldAlert,
    Building2,
    Stethoscope,
    User,
    Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminRpcService, AdminUserRow } from '@/services/AdminRpcService';
import { PharmacyDetail } from '@/components/admin/AdminPharmaciesTab';
import AdminDoctorDetail from '@/components/admin/AdminDoctorDetail';

export default function AdminVerificationTab() {
    const [pendingUsers, setPendingUsers] = useState<AdminUserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionUser, setActionUser] = useState<AdminUserRow | null>(null);
    const [actionType, setActionType] = useState<'verify' | 'reject' | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [docLoading, setDocLoading] = useState<string | null>(null);
    const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null);

    const loadPending = async () => {
        setLoading(true);
        try {
            // Load both doctors and pharmacists with status 'pending'
            const [doctors, pharmacists] = await Promise.all([
                AdminRpcService.listUsers({ role: 'doctor', status: 'pending', limit: 100 }),
                AdminRpcService.listUsers({ role: 'pharmacist', status: 'pending', limit: 100 }),
            ]);
            setPendingUsers([...doctors, ...pharmacists]);
        } catch (err: any) {
            console.error('Error loading pending verifications:', err);
            toast.error(err.message || 'Failed to load verification queue.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPending();
    }, []);

    const handleViewDocument = async (user: AdminUserRow) => {
        setDocLoading(user.user_id);
        try {
            // Search or retrieve signed URL for user's document in the private 'ids' bucket
            // Path convention in ids bucket: `<user_id>/id` or `<user_id>/license`
            const docPath = `${user.user_id}/license`;
            let url = await AdminRpcService.getPrivateIdSignedUrl(docPath);
            if (!url) {
                // Try fallback id path
                url = await AdminRpcService.getPrivateIdSignedUrl(`${user.user_id}/id`);
            }
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            } else {
                toast.error('No uploaded verification document found for this user in the ids storage bucket.');
            }
        } catch (err: any) {
            console.error('Document view error:', err);
            toast.error(err.message || 'Could not retrieve document.');
        } finally {
            setDocLoading(null);
        }
    };

    const handleConfirmAction = async () => {
        if (!actionUser || !actionType) return;
        if (actionType === 'reject' && !rejectReason.trim()) {
            toast.error('Please provide a reason for rejection.');
            return;
        }

        setSubmitting(true);
        try {
            const newStatus = actionType === 'verify' ? 'verified' : 'rejected';
            await AdminRpcService.setVerification(
                actionUser.user_id,
                newStatus,
                actionType === 'reject' ? rejectReason.trim() : null
            );
            toast.success(`User ${actionUser.full_name || actionUser.email} has been ${newStatus}.`);
            setActionUser(null);
            setActionType(null);
            setRejectReason('');
            loadPending();
        } catch (err: any) {
            console.error('Verification error:', err);
            toast.error(err.message || 'Failed to update verification status.');
        } finally {
            setSubmitting(false);
        }
    };

    const closeDetail = () => {
        setDetailUser(null);
        loadPending();
    };

    if (detailUser) {
        return detailUser.role === 'pharmacist' ? (
            <PharmacyDetail userId={detailUser.user_id} onBack={closeDetail} backLabel="Back to queue" />
        ) : (
            <AdminDoctorDetail user={detailUser} onBack={closeDetail} />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Credentials & Verification</h2>
                    <p className="text-xs text-muted-foreground">
                        Review medical licenses, business registrations, and identity documents
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadPending} disabled={loading} className="gap-1.5 self-start sm:self-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Queue
                </Button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading pending applications...</p>
                </div>
            ) : pendingUsers.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <CheckCircle className="w-12 h-12 text-emerald-500/60" />
                        <h3 className="font-semibold text-base">Verification Queue Clear</h3>
                        <p className="text-xs text-muted-foreground max-w-sm">
                            There are no pending doctor or pharmacy credentials awaiting administrative review.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingUsers.map((u) => {
                        const isDoctor = u.role === 'doctor';
                        return (
                            <Card key={u.user_id} className="border hover:shadow-sm transition-shadow">
                                <CardHeader className="pb-3 cursor-pointer" onClick={() => setDetailUser(u)}>
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                {isDoctor ? <Stethoscope className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <CardTitle className="text-sm font-bold">{u.full_name || 'Unnamed Applicant'}</CardTitle>
                                                <CardDescription className="text-xs">{u.email}</CardDescription>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="capitalize">
                                            {u.role}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="bg-muted/40 p-3 rounded-lg space-y-1.5 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">License Number:</span>
                                            <span className="font-mono font-semibold">{u.license_number || 'Not provided'}</span>
                                        </div>
                                        {u.business_name && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Business / Facility:</span>
                                                <span className="font-semibold">{u.business_name}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Applied:</span>
                                            <span>{new Date(u.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => setDetailUser(u)}
                                            className="text-xs gap-1.5 flex-1"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            {isDoctor ? 'View profile & details' : 'Review application'}
                                        </Button>

                                        {isDoctor && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleViewDocument(u)}
                                                    disabled={docLoading === u.user_id}
                                                    className="text-xs gap-1.5"
                                                >
                                                    {docLoading === u.user_id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <FileText className="w-3.5 h-3.5" />
                                                    )}
                                                    Document
                                                </Button>
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={() => {
                                                        setActionUser(u);
                                                        setActionType('verify');
                                                    }}
                                                    className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                >
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    Approve
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => {
                                                        setActionUser(u);
                                                        setActionType('reject');
                                                        setRejectReason('');
                                                    }}
                                                    className="text-xs gap-1"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Reject
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Approval / Rejection Modal */}
            {actionUser && actionType && (
                <Dialog open={!!actionUser} onOpenChange={(open) => !open && !submitting && setActionUser(null)}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>
                                {actionType === 'verify' ? 'Approve Credential' : 'Reject Credential'}
                            </DialogTitle>
                            <DialogDescription>
                                {actionType === 'verify'
                                    ? `Are you sure you want to approve ${actionUser.full_name || actionUser.email} as a verified ${actionUser.role}? They will immediately be authorized to receive bookings or orders.`
                                    : `Reject credential application for ${actionUser.full_name || actionUser.email}. Please provide a clear rationale for the user.`
                                }
                            </DialogDescription>
                        </DialogHeader>

                        {actionType === 'reject' && (
                            <div className="space-y-2 py-2">
                                <Label htmlFor="verification-reject-reason">Rejection Reason (Required)</Label>
                                <Textarea
                                    id="verification-reject-reason"
                                    placeholder="e.g. Expired medical license, unreadable document photo, invalid facility registration..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        )}

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setActionUser(null)} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button
                                variant={actionType === 'verify' ? 'default' : 'destructive'}
                                onClick={handleConfirmAction}
                                disabled={submitting || (actionType === 'reject' && !rejectReason.trim())}
                                className={actionType === 'verify' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                            >
                                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {actionType === 'verify' ? 'Confirm Approval' : 'Confirm Rejection'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
