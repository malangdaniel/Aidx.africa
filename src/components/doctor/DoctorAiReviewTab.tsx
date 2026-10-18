import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    Brain,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    User,
    Loader2,
    RefreshCw,
    ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

interface AiDiagnosisItem {
    id: string;
    user_id: string;
    condition: string | null;
    severity: string | null;
    confidence_percentage: number | null;
    rationale: string | null;
    created_at: string;
    patient_name?: string;
}

export default function DoctorAiReviewTab() {
    const [diagnoses, setDiagnoses] = useState<AiDiagnosisItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Review dialog state
    const [selectedDiagnosis, setSelectedDiagnosis] = useState<AiDiagnosisItem | null>(null);
    const [agreedChoice, setAgreedChoice] = useState<boolean | null>(null);
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    const loadDiagnoses = async () => {
        setLoading(true);
        try {
            // Fetch unreviewed or flagged diagnoses
            const { data, error } = await supabase
                .from('ai_diagnoses')
                .select('id, user_id, condition, severity, confidence_percentage, rationale, created_at')
                .order('created_at', { ascending: false })
                .limit(30);

            if (error) throw error;

            const rows = (data || []) as AiDiagnosisItem[];

            // Resolve patient names if any
            const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('user_id, first_name, last_name')
                    .in('user_id', userIds);

                const nameMap: Record<string, string> = {};
                (profiles || []).forEach((p: any) => {
                    nameMap[p.user_id] = `${p.first_name || 'Patient'} ${p.last_name || ''}`.trim();
                });

                setDiagnoses(rows.map(r => ({
                    ...r,
                    patient_name: nameMap[r.user_id] || 'Patient',
                })));
            } else {
                setDiagnoses(rows);
            }
        } catch (err: any) {
            console.error('Error fetching AI diagnoses for review:', err);
            toast.error(err.message || 'Failed to load AI diagnoses.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDiagnoses();
    }, []);

    const handleOpenReview = (diagnosis: AiDiagnosisItem, agreed: boolean) => {
        setSelectedDiagnosis(diagnosis);
        setAgreedChoice(agreed);
        setNotes('');
    };

    const handleConfirmReview = async () => {
        if (!selectedDiagnosis || agreedChoice === null) return;

        setSubmitting(true);
        try {
            const { data, error } = await (supabase.rpc as any)('review_ai_diagnosis', {
                p_diagnosis_id: selectedDiagnosis.id,
                p_agreed: agreedChoice,
                p_notes: notes.trim() || (agreedChoice ? 'Clinician agreed with AI assessment' : 'Clinician disagreed with AI assessment'),
            });

            if (error) throw error;

            toast.success(`Review recorded: Clinician ${agreedChoice ? 'agreed' : 'disagreed'} with diagnosis.`);
            setSelectedDiagnosis(null);
            setAgreedChoice(null);
            setNotes('');
            loadDiagnoses();
        } catch (err: any) {
            console.error('Review AI diagnosis error:', err);
            toast.error(err.message || 'Failed to record AI review.');
        } finally {
            setSubmitting(false);
        }
    };

    const getSeverityBadge = (severity: string | null) => {
        switch (severity?.toLowerCase()) {
            case 'critical':
                return <Badge variant="destructive" className="uppercase font-bold text-[10px]">Critical</Badge>;
            case 'high':
                return <Badge variant="destructive" className="bg-orange-600 hover:bg-orange-700 text-white uppercase text-[10px]">High</Badge>;
            case 'medium':
                return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30 uppercase text-[10px]">Medium</Badge>;
            default:
                return <Badge variant="secondary" className="uppercase text-[10px]">Low</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold">AI Clinical Safety Reviews</h2>
                    <p className="text-xs text-muted-foreground">
                        Review patient-facing AI symptom evaluations and validate or challenge automated hypotheses
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadDiagnoses} disabled={loading} className="gap-1.5 self-start sm:self-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading AI cases...</p>
                </div>
            ) : diagnoses.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <Brain className="w-12 h-12 text-purple-500/60" />
                        <h3 className="font-semibold text-base">No Flagged Diagnoses Found</h3>
                        <p className="text-xs text-muted-foreground max-w-sm">
                            There are currently no AI evaluations requiring clinical adjudication.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {diagnoses.map((d) => (
                        <Card key={d.id} className="border hover:shadow-sm transition-shadow">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-sm text-foreground">{d.condition || 'Unspecified Condition'}</h3>
                                            {getSeverityBadge(d.severity)}
                                            {d.confidence_percentage && (
                                                <Badge variant="outline" className="text-[10px] font-mono">
                                                    {Number(d.confidence_percentage).toFixed(0)}% Confidence
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Patient: <strong>{d.patient_name || 'Patient'}</strong> • Evaluated on {new Date(d.created_at).toLocaleDateString()}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 self-start sm:self-auto">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleOpenReview(d, true)}
                                            className="text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50 h-8"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            I Agree
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleOpenReview(d, false)}
                                            className="text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 h-8"
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
                                            I Disagree
                                        </Button>
                                    </div>
                                </div>

                                {d.rationale && (
                                    <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1 text-muted-foreground">
                                        <p className="font-semibold text-foreground text-[11px]">AI Clinical Rationale:</p>
                                        <p className="leading-relaxed">{d.rationale}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Review Dialog */}
            {selectedDiagnosis && agreedChoice !== null && (
                <Dialog open={!!selectedDiagnosis} onOpenChange={(open) => !open && !submitting && setSelectedDiagnosis(null)}>
                    <DialogContent className="sm:max-w-[440px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                {agreedChoice ? (
                                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-destructive" />
                                )}
                                Clinician Assessment: {agreedChoice ? 'Agree with AI' : 'Disagree with AI'}
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Recording doctor review for condition: <strong>{selectedDiagnosis.condition}</strong>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="review-notes" className="text-xs font-semibold">
                                    Clinical Notes / Counter-Assessment
                                </Label>
                                <Textarea
                                    id="review-notes"
                                    placeholder={
                                        agreedChoice
                                            ? 'Confirming symptom presentation aligns with differential diagnosis...'
                                            : 'Explain why AI diagnosis is inaccurate or what alternative condition is suspected...'
                                    }
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={4}
                                    className="text-xs"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setSelectedDiagnosis(null)} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button
                                variant={agreedChoice ? 'default' : 'destructive'}
                                onClick={handleConfirmReview}
                                disabled={submitting}
                                className={agreedChoice ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                            >
                                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Submit Review
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
