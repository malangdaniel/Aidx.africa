import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Video, FileText, Loader2, User, Star, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ConsultationReport from './ConsultationReport';
import PaymentStatusBadge, { getPaymentStatusHint } from '@/components/shared/PaymentStatusBadge';
import ReviewDialog from './ReviewDialog';
import { WalletService } from '@/services/WalletService';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Consultation {
    id: string;
    scheduled_at: string;
    status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
    price: number;
    doctor_id: string;
    payment_status?: string | null;
    escrow_amount?: number | null;
    doctor_profile?: {
        first_name: string;
        last_name: string;
        specialties?: string[];
        metadata?: {
            avatar_url?: string;
        }
    };
}

interface ConsultationsListProps {
    onJoinCall?: (consultation: Consultation) => void;
}

export default function ConsultationsList({ onJoinCall }: ConsultationsListProps) {
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<Consultation | null>(null);
    const [reviewTarget, setReviewTarget] = useState<Consultation | null>(null);
    const [cancelTarget, setCancelTarget] = useState<Consultation | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    useEffect(() => {
        fetchConsultations();
    }, []);

    const handleConfirmCancel = async () => {
        if (!cancelTarget) return;
        setIsCancelling(true);
        try {
            const data: any = await WalletService.refundConsultation(cancelTarget.id, cancelReason.trim() || undefined);
            const refundAmount = typeof data === 'number'
                ? data
                : (data?.amount ?? data?.refund_amount ?? (cancelTarget.escrow_amount ?? cancelTarget.price));
            toast.success(`Consultation cancelled. ₦${Number(refundAmount).toLocaleString()} refunded to your wallet.`);
            setCancelTarget(null);
            setCancelReason('');
            fetchConsultations();
        } catch (err: any) {
            console.error('Error cancelling consultation:', err);
            toast.error(err.message || 'Failed to cancel consultation.');
        } finally {
            setIsCancelling(false);
        }
    };

    const fetchConsultations = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('consultations')
                .select(`
                    id, scheduled_at, status, price, doctor_id, payment_status, escrow_amount,
                    profiles:doctor_id (first_name, last_name, metadata)
                `)
                .eq('patient_id', user.id)
                .order('scheduled_at', { ascending: false });

            if (error) throw error;

            const doctorIds = [...new Set((data || []).map(c => c.doctor_id))];
            let specialtiesMap = new Map<string, string[]>();

            if (doctorIds.length > 0) {
                const { data: doctorsData } = await supabase
                    .from('doctors')
                    .select('user_id, specialties')
                    .in('user_id', doctorIds);

                specialtiesMap = new Map(
                    (doctorsData || []).map(d => [d.user_id, d.specialties || []])
                );
            }

            const mapped: Consultation[] = (data || []).map((c: any) => ({
                id: c.id,
                scheduled_at: c.scheduled_at,
                status: c.status,
                price: c.price,
                doctor_id: c.doctor_id,
                payment_status: c.payment_status,
                escrow_amount: c.escrow_amount,
                doctor_profile: {
                    first_name: c.profiles?.first_name || 'Unknown',
                    last_name: c.profiles?.last_name || 'Doctor',
                    specialties: specialtiesMap.get(c.doctor_id) || undefined,
                    metadata: c.profiles?.metadata
                }
            }));

            setConsultations(mapped);
        } catch (error) {
            console.error('Error fetching consultations:', error);
            toast.error('Failed to load consultations.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'scheduled':
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Scheduled</Badge>;
            case 'ongoing':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 animate-pulse">Ongoing</Badge>;
            case 'completed':
                return <Badge variant="secondary">Completed</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (consultations.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Video className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-lg mb-1">No consultations yet</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                        Book a consultation with a doctor to get started.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <div className="space-y-4">
                {consultations.map((consultation) => (
                    <Card key={consultation.id} className="overflow-hidden hover:shadow-sm transition-shadow">
                        <CardContent className="p-0">
                            <div className="flex flex-col sm:flex-row">
                                <div className="p-4 flex-1 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                {consultation.doctor_profile?.metadata?.avatar_url ? (
                                                    <img
                                                        src={consultation.doctor_profile.metadata.avatar_url}
                                                        alt="Consulting doctor profile photo"
                                                        className="w-full h-full rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <User className="w-6 h-6 text-primary" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold flex items-center gap-2">
                                                    Dr. {consultation.doctor_profile?.first_name} {consultation.doctor_profile?.last_name}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    {consultation.doctor_profile?.specialties?.[0] || 'Medical Specialist'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {getStatusBadge(consultation.status)}
                                            <PaymentStatusBadge status={consultation.payment_status} />
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-muted-foreground">
                                        {getPaymentStatusHint(consultation.payment_status)}
                                    </p>

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Calendar className="w-4 h-4" />
                                            <span>{format(new Date(consultation.scheduled_at), 'MMM dd, yyyy')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Clock className="w-4 h-4" />
                                            <span>{format(new Date(consultation.scheduled_at), 'hh:mm a')}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-muted/30 p-4 flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-3 min-w-[140px] border-t sm:border-t-0 sm:border-l">
                                    <div className="text-center hidden sm:block">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                            {consultation.payment_status === 'escrowed' ? 'In escrow' : 'Price'}
                                        </p>
                                        <p className="text-lg font-bold">₦{(consultation.escrow_amount ?? consultation.price).toLocaleString()}</p>
                                    </div>

                                    <div className="flex sm:flex-col gap-2 w-full">
                                        {consultation.status === 'scheduled' || consultation.status === 'ongoing' ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    className="w-full gap-2 bg-primary"
                                                    onClick={() => onJoinCall && onJoinCall(consultation)}
                                                >
                                                    <Video className="w-4 h-4" />
                                                    Join Call
                                                </Button>
                                                {consultation.status === 'scheduled' && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="w-full gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => {
                                                            setCancelTarget(consultation);
                                                            setCancelReason('');
                                                        }}
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        Cancel
                                                    </Button>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full gap-2 hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-colors"
                                                    onClick={() => setSelectedReport(consultation)}
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    Report
                                                </Button>
                                                {consultation.status === 'completed' && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="w-full gap-2"
                                                        onClick={() => setReviewTarget(consultation)}
                                                    >
                                                        <Star className="w-4 h-4" />
                                                        Review
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Consultation Report Modal */}
            {selectedReport && (
                <ConsultationReport
                    open={!!selectedReport}
                    onClose={() => setSelectedReport(null)}
                    consultation={selectedReport}
                />
            )}

            {reviewTarget && (
                <ReviewDialog
                    open={!!reviewTarget}
                    onOpenChange={(open) => !open && setReviewTarget(null)}
                    revieweeId={reviewTarget.doctor_id}
                    consultationId={reviewTarget.id}
                    doctorName={`Dr. ${reviewTarget.doctor_profile?.first_name ?? ''} ${reviewTarget.doctor_profile?.last_name ?? ''}`.trim()}
                />
            )}

            {cancelTarget && (
                <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && !isCancelling && setCancelTarget(null)}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Cancel Consultation</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to cancel your consultation with Dr. {cancelTarget.doctor_profile?.first_name} {cancelTarget.doctor_profile?.last_name}?
                                {' '}₦{(cancelTarget.escrow_amount ?? cancelTarget.price).toLocaleString()} held in escrow will be immediately refunded to your wallet balance.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 py-2">
                            <Label htmlFor="cancel-reason">Reason for cancellation (optional)</Label>
                            <Textarea
                                id="cancel-reason"
                                placeholder="Let the doctor know why you need to cancel..."
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                variant="outline"
                                onClick={() => setCancelTarget(null)}
                                disabled={isCancelling}
                            >
                                Keep Consultation
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleConfirmCancel}
                                disabled={isCancelling}
                                className="gap-2"
                            >
                                {isCancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                                Confirm Cancel & Refund
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}