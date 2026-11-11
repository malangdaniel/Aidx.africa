import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle,
    Loader2,
    RefreshCw,
    Building2,
    Stethoscope,
    Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminRpcService, AdminUserRow } from '@/services/AdminRpcService';
import { PharmacyDetail } from '@/components/admin/AdminPharmaciesTab';
import { DoctorApplicationDetail } from '@/components/admin/AdminDoctorsTab';

export default function AdminVerificationTab() {
    const [pendingUsers, setPendingUsers] = useState<AdminUserRow[]>([]);
    const [loading, setLoading] = useState(true);
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

    const closeDetail = () => {
        setDetailUser(null);
        loadPending();
    };

    if (detailUser) {
        return detailUser.role === 'pharmacist' ? (
            <PharmacyDetail userId={detailUser.user_id} onBack={closeDetail} backLabel="Back to queue" />
        ) : (
            <DoctorApplicationDetail userId={detailUser.user_id} onBack={closeDetail} backLabel="Back to queue" />
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
                                            Review application
                                        </Button>

                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
