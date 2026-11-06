import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Calendar, FileText, Activity, Loader2, Pill, FlaskConical, Brain, ShieldAlert, Eye } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PatientDetailProps {
    patientId: string; // auth user id of the patient
    onBack: () => void;
}

interface PatientRecord {
    consent: boolean;
    patient: {
        patient_id: string;
        first_name: string | null;
        last_name: string | null;
        gender: string | null;
        blood_group: string | null;
        age_years: number | null;
    } | null;
    health_history: {
        allergies: string[];
        chronic_conditions: string[];
        current_medications: { name?: string; dosage?: string; frequency?: string }[];
        past_surgeries: { condition?: string; details?: string; year?: string }[];
        family_history: string[];
    } | null;
    consultations: {
        id: string;
        status: string;
        visit_at: string;
        chief_complaint: string | null;
        physical_exam: string | null;
        differential_diagnosis: string | null;
        diagnosis: string | null;
        notes: string | null;
        clinical_summary: string | null;
        follow_up_plan: string | null;
        referral: string | null;
        is_mine: boolean;
        doctor_name: string | null;
        hospital_or_clinic: string | null;
    }[];
    prescriptions: { id: string; consultation_id: string; prescription_data: any; notes: string | null; created_at: string; is_mine: boolean; doctor_name: string | null; hospital_or_clinic: string | null }[];
    lab_orders: { id: string; test_name: string; urgency: string | null; reason: string | null; status: string | null; results: string | null; created_at: string; is_mine: boolean; doctor_name: string | null; hospital_or_clinic: string | null }[];
    vitals: {
        id: string; systolic: number | null; diastolic: number | null; heart_rate: number | null;
        weight: number | null; temperature: number | null; oxygen_saturation: number | null; recorded_at: string;
    }[] | null;
    ai_diagnoses: {
        id: string; condition: string | null; severity: string | null; confidence_percentage: number | null;
        rationale: string | null; flagged: boolean; created_at: string;
    }[] | null;
}

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function Author({ mine, name, clinic }: { mine: boolean; name: string | null; clinic: string | null }) {
    if (mine) return <Badge variant="secondary">You</Badge>;
    return (
        <span className="text-xs text-muted-foreground">
            {name ? `Dr. ${name}` : 'Another doctor'}
            {clinic ? ` · ${clinic}` : ''}
        </span>
    );
}

function NotShared({ what }: { what: string }) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>The patient has not shared their {what} with you. You can ask them during the consultation.</span>
        </div>
    );
}

export default function PatientDetail({ patientId, onBack }: PatientDetailProps) {
    const [confirmOpen, setConfirmOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [record, setRecord] = useState<PatientRecord | null>(null);

    const openRecord = async () => {
        setConfirmOpen(false);
        setLoading(true);
        try {
            const { data, error } = await (supabase.rpc as any)('open_patient_record', {
                p_patient_id: patientId,
                p_acknowledged: true,
            });
            if (error) throw error;
            setRecord(data as PatientRecord);
        } catch (error: any) {
            console.error('Error opening patient record:', error);
            toast.error(error?.message || 'Could not open this patient record');
            onBack();
        } finally {
            setLoading(false);
        }
    };

    if (!record) {
        return (
            <>
                <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!o && !loading && !record) onBack(); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <Eye className="w-5 h-5 text-primary" />
                                Open this patient's record?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                                <span className="block">
                                    The patient will be notified that you opened their record, and the access is saved
                                    in their privacy log and the platform audit trail.
                                </span>
                                <span className="block">
                                    Only open records you need for the patient's care.
                                </span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={onBack}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={openRecord}>I understand, open record</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                {loading && (
                    <div className="flex justify-center items-center h-96">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                )}
            </>
        );
    }

    const p = record.patient;
    const name = `${p?.first_name || 'Unknown'} ${p?.last_name || ''}`.trim();
    const initials = `${p?.first_name?.[0] || ''}${p?.last_name?.[0] || ''}`;
    const hh = record.health_history;
    const vitals = record.vitals || [];

    const chartData = [...vitals].reverse().map((v) => ({
        date: new Date(v.recorded_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        systolic: v.systolic,
        diastolic: v.diastolic,
        heartRate: v.heart_rate,
        temperature: v.temperature,
        oxygenSaturation: v.oxygen_saturation,
    }));

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold">Patient Record</h2>
                    <p className="text-muted-foreground text-sm">This access was logged and the patient was notified.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Patient</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center">
                            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary mb-4">
                                {initials}
                            </div>
                            <h3 className="text-xl font-bold text-center">{name}</h3>
                            <p className="text-muted-foreground">
                                {[p?.age_years != null ? `${p.age_years} years` : null, p?.gender].filter(Boolean).join(' • ') || '—'}
                            </p>
                            {p?.blood_group && <Badge variant="outline" className="mt-2">Blood group {p.blood_group}</Badge>}
                        </div>

                        {hh ? (
                            <div className="space-y-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground block mb-1">Allergies</span>
                                    {asList(hh.allergies).length ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {asList(hh.allergies).map((a) => <Badge key={a} variant="destructive">{a}</Badge>)}
                                        </div>
                                    ) : <span className="font-medium">None reported</span>}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block mb-1">Chronic conditions</span>
                                    {asList(hh.chronic_conditions).length ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {asList(hh.chronic_conditions).map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                                        </div>
                                    ) : <span className="font-medium">None reported</span>}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block mb-1">Current medications</span>
                                    {(hh.current_medications || []).length ? (
                                        <ul className="space-y-1">
                                            {hh.current_medications.map((m, i) => (
                                                <li key={i} className="font-medium">
                                                    {m.name}
                                                    <span className="text-muted-foreground font-normal">
                                                        {[m.dosage, m.frequency].filter(Boolean).length ? ` — ${[m.dosage, m.frequency].filter(Boolean).join(', ')}` : ''}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : <span className="font-medium">None reported</span>}
                                </div>
                                {(hh.past_surgeries || []).length > 0 && (
                                    <div>
                                        <span className="text-muted-foreground block mb-1">Past surgeries / conditions</span>
                                        <ul className="space-y-1">
                                            {hh.past_surgeries.map((s, i) => (
                                                <li key={i} className="font-medium">
                                                    {s.condition}
                                                    <span className="text-muted-foreground font-normal">{s.year ? ` (${s.year})` : ''}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {asList(hh.family_history).length > 0 && (
                                    <div>
                                        <span className="text-muted-foreground block mb-1">Family history</span>
                                        <span className="font-medium">{asList(hh.family_history).join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <NotShared what="health history" />
                        )}
                    </CardContent>
                </Card>

                <div className="md:col-span-2">
                    <Tabs defaultValue="visits">
                        <TabsList className="w-full justify-start flex-wrap h-auto">
                            <TabsTrigger value="visits">Visits & Notes</TabsTrigger>
                            <TabsTrigger value="vitals">Vitals</TabsTrigger>
                            <TabsTrigger value="ai">AI Diagnoses</TabsTrigger>
                            <TabsTrigger value="rx">Prescriptions & Labs</TabsTrigger>
                        </TabsList>

                        <TabsContent value="visits" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-primary" />
                                        Visits & clinical notes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {!record.consent && (
                                        <div className="m-4 mb-0">
                                            <NotShared what="record, including notes from other doctors" />
                                        </div>
                                    )}
                                    {record.consultations.length === 0 ? (
                                        <div className="p-4 text-sm text-muted-foreground">No consultations found.</div>
                                    ) : (
                                        record.consultations.map((c) => (
                                            <div key={c.id} className="flex items-start gap-4 p-4 border-b last:border-0">
                                                <div className="mt-1 bg-primary/10 p-2 rounded-full">
                                                    <Calendar className="w-4 h-4 text-primary" />
                                                </div>
                                                <div className="space-y-1 text-sm min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold">{fmtDate(c.visit_at)}</h4>
                                                        <Badge variant="outline" className="capitalize">{c.status}</Badge>
                                                    </div>
                                                    <Author mine={c.is_mine} name={c.doctor_name} clinic={c.hospital_or_clinic} />
                                                    {c.chief_complaint && <p><span className="text-muted-foreground">Complaint: </span>{c.chief_complaint}</p>}
                                                    {c.diagnosis && <p className="font-medium">Dx: {c.diagnosis}</p>}
                                                    {c.differential_diagnosis && <p><span className="text-muted-foreground">Differential: </span>{c.differential_diagnosis}</p>}
                                                    {c.physical_exam && <p><span className="text-muted-foreground">Exam: </span>{c.physical_exam}</p>}
                                                    {c.notes && <p className="whitespace-pre-wrap">{c.notes}</p>}
                                                    {c.clinical_summary && <p className="text-muted-foreground whitespace-pre-wrap">{c.clinical_summary}</p>}
                                                    {c.follow_up_plan && <p><span className="text-muted-foreground">Follow-up: </span>{c.follow_up_plan}</p>}
                                                    {c.referral && <p><span className="text-muted-foreground">Referral: </span>{c.referral}</p>}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="vitals" className="mt-4">
                            {record.vitals === null ? (
                                <NotShared what="vitals" />
                            ) : (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-primary" />
                                            Vitals Trends
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[300px]">
                                        {chartData.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">No vitals recorded.</div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Line type="monotone" dataKey="systolic" stroke="#ef4444" name="Systolic BP" strokeWidth={2} connectNulls />
                                                    <Line type="monotone" dataKey="diastolic" stroke="#f97316" name="Diastolic BP" strokeWidth={2} connectNulls />
                                                    <Line type="monotone" dataKey="heartRate" stroke="#3b82f6" name="Heart Rate" strokeWidth={2} connectNulls opacity={0.5} />
                                                    <Line type="monotone" dataKey="temperature" stroke="#fb923c" name="Temp (°C)" strokeWidth={2} connectNulls opacity={0.5} />
                                                    <Line type="monotone" dataKey="oxygenSaturation" stroke="#0ea5e9" name="SpO2 (%)" strokeWidth={2} connectNulls opacity={0.5} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="ai" className="mt-4">
                            {record.ai_diagnoses === null ? (
                                <NotShared what="AI diagnosis history" />
                            ) : (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Brain className="w-5 h-5 text-primary" />
                                            AI Diagnoses
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {record.ai_diagnoses.length === 0 ? (
                                            <div className="p-4 text-sm text-muted-foreground">No AI diagnoses yet.</div>
                                        ) : (
                                            record.ai_diagnoses.map((d) => (
                                                <div key={d.id} className="p-4 border-b last:border-0 space-y-1 text-sm">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-semibold">{d.condition || 'Unspecified'}</span>
                                                        {d.severity && <Badge variant={d.severity === 'severe' ? 'destructive' : 'secondary'} className="capitalize">{d.severity}</Badge>}
                                                        {d.confidence_percentage != null && <span className="text-muted-foreground">{d.confidence_percentage}% confidence</span>}
                                                        {d.flagged && <Badge variant="destructive">Flagged</Badge>}
                                                    </div>
                                                    {d.rationale && <p className="text-muted-foreground">{d.rationale}</p>}
                                                    <p className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</p>
                                                </div>
                                            ))
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="rx" className="mt-4 space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Pill className="w-5 h-5 text-primary" />
                                        Prescriptions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {record.prescriptions.length === 0 ? (
                                        <div className="p-4 text-sm text-muted-foreground">None.</div>
                                    ) : (
                                        record.prescriptions.map((rx) => {
                                            const items: any[] = Array.isArray(rx.prescription_data)
                                                ? rx.prescription_data
                                                : Array.isArray(rx.prescription_data?.medications)
                                                    ? rx.prescription_data.medications
                                                    : [];
                                            return (
                                                <div key={rx.id} className="p-4 border-b last:border-0 text-sm space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs text-muted-foreground">{fmtDate(rx.created_at)}</p>
                                                        <Author mine={rx.is_mine} name={rx.doctor_name} clinic={rx.hospital_or_clinic} />
                                                    </div>
                                                    {items.length > 0 ? (
                                                        <ul className="space-y-0.5">
                                                            {items.map((m, i) => (
                                                                <li key={i} className="font-medium">
                                                                    {m.name || m.drug || 'Medication'}
                                                                    <span className="text-muted-foreground font-normal">
                                                                        {[m.dosage, m.frequency, m.duration].filter(Boolean).length ? ` — ${[m.dosage, m.frequency, m.duration].filter(Boolean).join(', ')}` : ''}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-muted-foreground">Prescription on file.</p>
                                                    )}
                                                    {rx.notes && <p>{rx.notes}</p>}
                                                </div>
                                            );
                                        })
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FlaskConical className="w-5 h-5 text-primary" />
                                        Lab orders
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {record.lab_orders.length === 0 ? (
                                        <div className="p-4 text-sm text-muted-foreground">None.</div>
                                    ) : (
                                        record.lab_orders.map((l) => (
                                            <div key={l.id} className="p-4 border-b last:border-0 text-sm space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold">{l.test_name}</span>
                                                    {l.urgency && <Badge variant="outline" className="capitalize">{l.urgency}</Badge>}
                                                    {l.status && <Badge variant="secondary" className="capitalize">{l.status.replace('_', ' ')}</Badge>}
                                                </div>
                                                {l.reason && <p className="text-muted-foreground">{l.reason}</p>}
                                                {l.results && <p>Result: {l.results}</p>}
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-muted-foreground">{fmtDate(l.created_at)}</p>
                                                    <Author mine={l.is_mine} name={l.doctor_name} clinic={l.hospital_or_clinic} />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
