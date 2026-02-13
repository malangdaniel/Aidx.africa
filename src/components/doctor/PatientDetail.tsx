import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar, FileText, Activity, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { VitalsService, VitalRecord } from '@/services/VitalsService';

interface PatientDetailProps {
    patientId: string; // This is the auth user id (profile user_id)
    onBack: () => void;
}

interface Consult {
    id: string;
    doctor_id: string;
    created_at: string;
    notes: string | null;
    diagnosis: string | null;
}

export default function PatientDetail({ patientId, onBack }: PatientDetailProps) {
    const [patient, setPatient] = useState<any>(null);
    const [consultations, setConsultations] = useState<Consult[]>([]);
    const [vitals, setVitals] = useState<VitalRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (patientId) {
            fetchPatientData();
        }
    }, [patientId]);

    const fetchPatientData = async () => {
        setLoading(true);
        try {
            // Fetch Profile
            const [profileRes, consultsRes, vitalsRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('user_id', patientId).single(),
                supabase.from('consultations').select('id, doctor_id, created_at, notes, diagnosis').eq('patient_id', patientId).order('created_at', { ascending: false }),
                VitalsService.getPatientVitals(patientId)
            ]);

            if (profileRes.error) throw profileRes.error;
            if (consultsRes.error) throw consultsRes.error;

            setPatient(profileRes.data);
            setConsultations(consultsRes.data || []);
            setVitals(vitalsRes || []);

        } catch (error) {
            console.error("Error fetching patient details:", error);
            toast.error("Could not load patient details");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!patient) return <div>Patient not found</div>;

    // Helper to get initials
    const initials = `${patient.first_name?.[0] || ''}${patient.last_name?.[0] || ''}`;
    const name = `${patient.first_name || 'Unknown'} ${patient.last_name || ''}`;
    const age = patient.metadata?.age || 'N/A';
    const sex = patient.metadata?.sex || 'N/A';
    const address = patient.metadata?.address || 'N/A';

    // Format vitals for chart
    const chartData = [...vitals].reverse().map(v => ({
        date: new Date(v.recorded_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        systolic: v.systolic,
        diastolic: v.diastolic,
        heartRate: v.heart_rate
    }));

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold">Patient Details</h2>
                    <p className="text-muted-foreground text-sm">ID: {patientId.slice(0, 8)}...</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Profile Card */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary mb-4">
                                {initials}
                            </div>
                            <h3 className="text-xl font-bold">{name}</h3>
                            <p className="text-muted-foreground">{age} years • {sex}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <span className="text-sm text-muted-foreground block">Phone</span>
                                <span className="font-medium">{patient.phone || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground block">Address</span>
                                <span className="font-medium">{address}</span>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground block">Verification</span>
                                <span className="font-medium capitalize">{patient.verification_status}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Content Area */}
                <div className="md:col-span-2">
                    <Tabs defaultValue="overview">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="history">Medical History</TabsTrigger>
                            <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-6 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-primary" />
                                        Vitals Trends
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="systolic" stroke="#ef4444" name="Systolic BP" />
                                            <Line type="monotone" dataKey="diastolic" stroke="#f97316" name="Diastolic BP" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">Last Visit</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {consultations.length > 0
                                                ? new Date(consultations[0].created_at).toLocaleDateString()
                                                : "None"}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {consultations.length > 0 ? "General Checkup" : "No visits recorded"}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">Total Consults</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{consultations.length}</div>
                                        <p className="text-xs text-muted-foreground">Lifetime</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="history" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-primary" />
                                        Clinical History
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {/* Placeholder for AI Summary if not stored in DB yet */}
                                    <div className="text-sm text-muted-foreground">
                                        No recent clinical summary available for this patient.
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notes" className="mt-4 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Past Consultations</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {consultations.length === 0 ? (
                                        <div className="p-4 text-sm text-muted-foreground">No past consultations found.</div>
                                    ) : (
                                        consultations.map((consult) => (
                                            <div key={consult.id} className="flex items-start gap-4 p-4 border-b last:border-0 hover:bg-muted/50 transition-colors">
                                                <div className="mt-1 bg-primary/10 p-2 rounded-full">
                                                    <Calendar className="w-4 h-4 text-primary" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold">Consultation</h4>
                                                    <p className="text-sm text-muted-foreground">{new Date(consult.created_at).toLocaleDateString()}</p>
                                                    {consult.notes && <p className="mt-2 text-sm">{consult.notes}</p>}
                                                    {consult.diagnosis && <p className="mt-1 text-sm font-medium">Dx: {consult.diagnosis}</p>}
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
