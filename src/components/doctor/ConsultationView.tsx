import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import VideoCall from '@/components/common/VideoCall';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    User, FileText, MessageSquare, Pill, Plus, X, Check, Video,
    MicOff, CameraOff, Clock, CalendarDays, Activity, AlertCircle,
    ShieldCheck, AlertTriangle, Monitor, Share2, ClipboardList,
    Stethoscope, Phone, Timer, Play, Pause, RotateCcw, Siren
} from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

interface PrescriptionItem {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
}

interface LabOrder {
    testName: string;
    urgency: 'routine' | 'urgent' | 'stat';
    reason: string;
}

interface ChatMessage {
    id: string;
    sender: 'doctor' | 'patient';
    text: string;
    timestamp: string;
}

interface ConsultationViewProps {
    consultationId: string;
    patientName: string;
    clinicalSummary?: string;
    onEndConsultation: (data?: any) => void;
}

const MOCK_LAB_TESTS = [
    "Complete Blood Count (CBC)",
    "Basic Metabolic Panel (BMP)",
    "Comprehensive Metabolic Panel (CMP)",
    "Lipid Panel",
    "Liver Function Tests (LFTs)",
    "Thyroid Function Tests (TSH, T4)",
    "Hemoglobin A1C",
    "Urinalysis",
    "X-Ray Chest",
    "MRI Brain",
    "CT Scan Abdomen",
    "ECG"
];

const MOCK_CHRONIC_CONDITIONS = ["Type 2 Diabetes", "Hypertension"];
const MOCK_CURRENT_MEDS = ["Metformin 500mg (QD)", "Lisinopril 10mg (QD)"];

export default function ConsultationView({ consultationId, patientName, clinicalSummary, onEndConsultation }: ConsultationViewProps) {
    const { user, profile } = useAuth();
    const [note, setNote] = useState('');
    const [isCallActive, setIsCallActive] = useState(false);
    const [callMode, setCallMode] = useState<'video' | 'audio'>('video');

    // Timer State
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Chat State
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    // Clinical State
    const [physicalExam, setPhysicalExam] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [differentialDiagnosis, setDifferentialDiagnosis] = useState('');
    const [referral, setReferral] = useState('');

    // Prescription State
    const [rxName, setRxName] = useState('');
    const [rxDosage, setRxDosage] = useState('');
    const [rxFrequency, setRxFrequency] = useState('');
    const [rxDuration, setRxDuration] = useState('');
    const [prescribedMeds, setPrescribedMeds] = useState<PrescriptionItem[]>([]);

    // Lab Order State
    const [labSearch, setLabSearch] = useState('');
    const [labUrgency, setLabUrgency] = useState<'routine' | 'urgent' | 'stat'>('routine');
    const [labReason, setLabReason] = useState('');
    const [labOrders, setLabOrders] = useState<LabOrder[]>([]);

    // Timer Logic
    useEffect(() => {
        if (isTimerRunning) {
            timerRef.current = setInterval(() => {
                setTimerSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isTimerRunning]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;
        const newMessage: ChatMessage = {
            id: Math.random().toString(36).substr(2, 9),
            sender: 'doctor',
            text: chatInput.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages([...chatMessages, newMessage]);
        setChatInput('');
    };

    const handleEmergencyEscalation = () => {
        toast.error("EMERGENCY ESCALATED", {
            description: "Local emergency services and hospital administration have been notified.",
            duration: 10000,
        });
    };

    const handleAddMedication = () => {
        if (rxName.trim() && rxDosage.trim() && rxFrequency.trim()) {
            setPrescribedMeds([...prescribedMeds, {
                name: rxName.trim(),
                dosage: rxDosage.trim(),
                frequency: rxFrequency.trim(),
                duration: rxDuration.trim()
            }]);
            // Reset fields
            setRxName('');
            setRxDosage('');
            setRxFrequency('');
            setRxDuration('');
        } else {
            toast.error("Please fill in medication name, dosage and frequency");
        }
    };

    const handleRemoveMedication = (index: number) => {
        const newMeds = [...prescribedMeds];
        newMeds.splice(index, 1);
        setPrescribedMeds(newMeds);
    };

    const handleAddLab = () => {
        if (labSearch.trim()) {
            setLabOrders([...labOrders, {
                testName: labSearch.trim(),
                urgency: labUrgency,
                reason: labReason.trim() || 'Routine check'
            }]);
            setLabSearch('');
            setLabReason('');
            setLabUrgency('routine');
        } else {
            toast.error("Please select or type a lab test name");
        }
    };

    const handleRemoveLab = (index: number) => {
        const newLabs = [...labOrders];
        newLabs.splice(index, 1);
        setLabOrders(newLabs);
    };

    const handleFinish = () => {
        const consultationData = {
            id: consultationId,
            patientName,
            soapNotes: note,
            prescriptions: prescribedMeds,
            labOrders: labOrders,
            completedAt: new Date().toISOString(),
            doctor: user?.email || "Dr. Current User"
        };

        toast.success("Consultation Completed", {
            description: `Saved: ${prescribedMeds.length} Rx, ${labOrders.length} Labs.`
        });
        onEndConsultation(consultationData);
    };

    const filteredLabs = MOCK_LAB_TESTS.filter(test =>
        test.toLowerCase().includes(labSearch.toLowerCase()) &&
        test !== labSearch
    );

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in bg-background/50">
            {/* Session Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-card border-b shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20 text-primary">
                        <Timer className="w-4 h-4" />
                        <span className="text-sm font-mono font-bold">{formatTime(timerSeconds)}</span>
                        <div className="flex items-center gap-1 border-l pl-2 ml-1">
                            <button
                                onClick={() => setIsTimerRunning(!isTimerRunning)}
                                className="hover:text-primary/70 transition-colors"
                            >
                                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                            <button
                                onClick={() => setTimerSeconds(0)}
                                className="hover:text-primary/70 transition-colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                    <Badge variant="outline" className="gap-1.5 text-[10px] uppercase tracking-wider bg-background">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Live Recording Enabled
                    </Badge>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-muted rounded-md border text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                        <ShieldCheck className="w-3 h-3 text-green-600" />
                        Consent Verified
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 border-l pl-3">
                        LICENSE: MD #{profile?.id?.slice(0, 8).toUpperCase() || 'REF-83921'}
                    </div>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 gap-2 px-4 shadow-lg animate-pulse hover:animate-none"
                        onClick={handleEmergencyEscalation}
                    >
                        <Siren className="w-4 h-4" />
                        EMERGENCY
                    </Button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 min-h-0 overflow-hidden">
                {/* Left Panel: Patient Info & Context */}
                <div className="lg:col-span-1 space-y-4 flex flex-col h-full overflow-hidden">
                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-4 pb-4">
                            <Card className="shrink-0 border-muted-foreground/10 shadow-sm overflow-hidden">
                                <div className="bg-primary/5 px-4 py-3 border-b">
                                    <CardTitle className="text-xs uppercase tracking-widest text-primary font-bold">Patient Profile</CardTitle>
                                </div>
                                <CardHeader className="flex flex-row items-center gap-4 py-4">
                                    <Avatar className="h-14 w-14 border-2 border-primary/10">
                                        <AvatarFallback className="bg-primary/5"><User className="w-8 h-8 text-primary/40" /></AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-black text-base tracking-tight">{patientName}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Badge variant="secondary" className="text-[10px] h-4 font-bold border-none bg-muted px-1.5">32Y</Badge>
                                            <Badge variant="secondary" className="text-[10px] h-4 font-bold border-none bg-muted px-1.5">MALE</Badge>
                                            <Badge variant="secondary" className="text-[10px] h-4 font-bold border-none bg-red-100 text-red-700 px-1.5 font-mono">A+</Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-0">
                                    <div className="p-3 bg-muted/30 rounded-lg border border-muted-foreground/5">
                                        <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1 block">Chief Complaint</Label>
                                        <p className="font-semibold text-sm leading-tight italic text-foreground/90 leading-relaxed">"Severe chest pain radiating to left arm (7/10)"</p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3 text-red-500" /> Allergies
                                            </Label>
                                            <div className="flex flex-wrap gap-1.5">
                                                <Badge variant="destructive" className="text-[10px] py-0 px-2 font-bold uppercase">Penicillin</Badge>
                                                <Badge variant="destructive" className="text-[10px] py-0 px-2 font-bold uppercase">Peanuts</Badge>
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1.5 block">Chronic Conditions</Label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {MOCK_CHRONIC_CONDITIONS.map(c => (
                                                    <Badge key={c} variant="outline" className="text-[10px] py-0 px-2 font-bold border-muted-foreground/20 bg-muted/20">{c}</Badge>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1.5 block">Current Medications</Label>
                                            <ul className="space-y-1.5">
                                                {MOCK_CURRENT_MEDS.map(m => (
                                                    <li key={m} className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                                                        <div className="w-1 h-1 rounded-full bg-primary" />
                                                        {m}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* AI Clinical Summary Section */}
                            <Card className="flex flex-col overflow-hidden border-primary/20 bg-primary/0 shadow-none">
                                <CardHeader className="py-2.5 bg-primary/5 flex flex-row items-center justify-between">
                                    <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                        <FileText className="w-3.5 h-3.5" />
                                        AI HPI Summary
                                    </CardTitle>
                                    <Badge variant="outline" className="text-[9px] h-4 border-primary/20 text-primary/70">AUTO-GEN</Badge>
                                </CardHeader>
                                <CardContent className="p-3">
                                    {clinicalSummary ? (
                                        <div className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap bg-primary/5 p-3 rounded-md border border-primary/10 text-primary/90">
                                            {clinicalSummary}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic text-center py-4">Generating summary...</p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Decision Support Card */}
                            <Card className="border-orange-500/20 bg-orange-500/5 shadow-none overflow-hidden">
                                <CardHeader className="py-2.5 bg-orange-500/10 flex flex-row items-center gap-2">
                                    <Activity className="w-3.5 h-3.5 text-orange-600" />
                                    <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-orange-700">Decision Support</CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 space-y-3">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold text-orange-600/70 uppercase">AI Suggestions</Label>
                                            <Badge className="bg-orange-600 text-[9px] h-3.5 px-1 font-black">PREMIUM</Badge>
                                        </div>
                                        <div className="p-2 bg-white/50 border border-orange-200 rounded text-[11px] font-bold text-orange-800 flex items-center gap-2">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            Differential: ACS vs GERD vs PE
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600">
                                            <Siren className="w-3 h-3" /> RED FLAGS DETECTED
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-snug">Chest pain associated with nausea in a smoker requires immediate EKG.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </ScrollArea>
                </div>

                {/* Center Panel: Main Workspace */}
                <div className="lg:col-span-2 flex flex-col gap-4 h-full overflow-hidden">
                    {/* Active Call UI */}
                    <div className="shrink-0 group relative shadow-inner overflow-hidden border rounded-xl bg-slate-950 min-h-[160px] md:min-h-[200px]">
                        {isCallActive ? (
                            <div className="absolute inset-0">
                                <VideoCall
                                    roomId={consultationId}
                                    userId={user?.id || 'doc-anon'}
                                    userName="Dr. User"
                                    isDoctor={true}
                                    onEndCall={() => setIsCallActive(false)}
                                />
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                                    <Video className="w-8 h-8 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-white font-bold text-sm tracking-tight">Camera & Mic Ready</h4>
                                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">End-to-End Encrypted Session</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="rounded-full px-6 font-bold shadow-xl"
                                        onClick={() => { setIsCallActive(true); setIsTimerRunning(true); }}
                                    >
                                        Start Video
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full px-6 font-bold bg-white/5 border-white/10 text-white hover:bg-white/10"
                                        onClick={() => { setIsCallActive(true); setCallMode('audio'); setIsTimerRunning(true); }}
                                    >
                                        Audio Only
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <Tabs defaultValue="notes" className="flex-1 flex flex-col min-h-0 bg-card border rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto scrollbar-hide border-b bg-muted/20">
                            <TabsList className="w-full justify-start rounded-none p-0 h-auto bg-transparent border-none">
                                <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 px-5 text-[11px] font-black uppercase tracking-widest min-w-fit">
                                    <ClipboardList className="w-3.5 h-3.5 mr-2" />
                                    Clinical Record
                                </TabsTrigger>
                                <TabsTrigger value="rx" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 px-5 text-[11px] font-black uppercase tracking-widest min-w-fit">
                                    <Pill className="w-3.5 h-3.5 mr-2" />
                                    Prescriptions
                                </TabsTrigger>
                                <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 px-5 text-[11px] font-black uppercase tracking-widest min-w-fit">
                                    <Stethoscope className="w-3.5 h-3.5 mr-2" />
                                    Lab & Imaging
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-hidden relative">
                            <TabsContent value="notes" className="absolute inset-0 mt-0 focus-visible:ring-0">
                                <ScrollArea className="h-full">
                                    <div className="p-4 space-y-6">
                                        {/* SOAP Notes */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">SOAP Notes</Label>
                                                <Badge variant="outline" className="text-[9px] font-bold opacity-60">AUTO-SAVING</Badge>
                                            </div>
                                            <Textarea
                                                placeholder="Subjective: Patient reports...
Objective: Vitals normal, chest clear...
Assessment: Suspected GERD/MI...
Plan: Order ECG, Rx Antacids..."
                                                className="min-h-[160px] resize-none font-mono text-sm border-muted-foreground/10 focus-visible:ring-primary/20 rounded-xl p-4 bg-muted/5 leading-relaxed"
                                                value={note}
                                                onChange={(e) => setNote(e.target.value)}
                                            />
                                        </div>

                                        {/* Physical Exam & Diagnosis */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-dashed">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Physical Exam Findings</Label>
                                                <Textarea
                                                    className="min-h-[80px] text-xs"
                                                    placeholder="Heart sounds, palpation results..."
                                                    value={physicalExam}
                                                    onChange={(e) => setPhysicalExam(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Provisional Diagnosis</Label>
                                                <div className="relative">
                                                    <Input
                                                        className="text-xs font-bold"
                                                        placeholder="e.g. R07.9 (Chest Pain, Unspecified)"
                                                        value={diagnosis}
                                                        onChange={(e) => setDiagnosis(e.target.value)}
                                                    />
                                                    <div className="absolute right-2 top-2">
                                                        <Badge className="bg-green-600 text-[8px] h-4 px-1">ICD-10</Badge>
                                                    </div>
                                                </div>
                                                <Input
                                                    className="text-[10px]"
                                                    placeholder="Differential diagnoses..."
                                                    value={differentialDiagnosis}
                                                    onChange={(e) => setDifferentialDiagnosis(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Session Checklist */}
                                        <div className="space-y-3 pt-4 border-t border-dashed">
                                            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Symptom Checklist</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {['Chest Pain', 'Nausea', 'Shortness of Breath', 'Dizziness', 'Fever', 'Cough'].map(s => (
                                                    <label key={s} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                                                        <div className="w-4 h-4 border-2 rounded border-primary/20 group-hover:border-primary/40 flex items-center justify-center">
                                                            {/* Simple checkbox UI */}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-foreground/70">{s}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="rx" className="absolute inset-0 mt-0 focus-visible:ring-0">
                                <ScrollArea className="h-full">
                                    <div className="p-4 space-y-6">
                                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-black text-primary uppercase tracking-tight">Prescription Writer</h4>
                                                <Badge variant="outline" className="border-primary/20 text-primary">DRUG INTERACTION: ON</Badge>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase pl-1">Medication Name</Label>
                                                    <Input className="h-8 text-xs" placeholder="e.g. Amoxicillin" value={rxName} onChange={(e) => setRxName(e.target.value)} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase pl-1">Dose & Unit</Label>
                                                    <Input className="h-8 text-xs" placeholder="e.g. 500mg" value={rxDosage} onChange={(e) => setRxDosage(e.target.value)} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase pl-1">Frequency</Label>
                                                    <Select value={rxFrequency} onValueChange={setRxFrequency}>
                                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                                                        <SelectContent><SelectItem value="QD">Once daily</SelectItem><SelectItem value="BID">Twice daily</SelectItem><SelectItem value="TID">Three times</SelectItem><SelectItem value="PRN">As needed</SelectItem></SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase pl-1">Duration</Label>
                                                    <Input className="h-8 text-xs" placeholder="e.g. 7 days" value={rxDuration} onChange={(e) => setRxDuration(e.target.value)} />
                                                </div>
                                            </div>
                                            <Button onClick={handleAddMedication} className="w-full h-9 font-bold tracking-tight shadow-md">
                                                <Plus className="w-4 h-4 mr-2" /> Add to Prescription
                                            </Button>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Active Prescription</Label>
                                            {prescribedMeds.length === 0 ? (
                                                <div className="text-center py-10 border-2 border-dashed rounded-xl bg-muted/5 text-muted-foreground">
                                                    <p className="text-xs font-bold uppercase tracking-widest opacity-40">Cart Empty</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {prescribedMeds.map((med, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/20 border rounded-xl group transition-all hover:bg-muted/40 shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                                <div className="bg-primary text-white p-2 rounded-lg"><Pill className="w-4 h-4" /></div>
                                                                <div>
                                                                    <p className="font-black text-sm">{med.name} <span className="font-normal text-muted-foreground">({med.dosage})</span></p>
                                                                    <p className="text-[10px] font-bold text-muted-foreground/70 uppercase">{med.frequency} • {med.duration}</p>
                                                                </div>
                                                            </div>
                                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveMedication(idx)} className="h-8 w-8 text-muted-foreground hover:text-destructive group-hover:scale-110 transition-transform">
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="orders" className="absolute inset-0 mt-0 focus-visible:ring-0">
                                <ScrollArea className="h-full">
                                    <div className="p-4 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Lab Order Wrapper */}
                                            <div className="space-y-4 bg-muted/30 p-4 rounded-xl border border-muted-foreground/10">
                                                <h4 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                                    <Activity className="w-4 h-4 text-primary" />
                                                    Order Diagnostics
                                                </h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase pl-1">Test / Image Name</Label>
                                                        <div className="relative">
                                                            <Input
                                                                className="h-8 text-xs"
                                                                placeholder="CBC, MRI, ECG..."
                                                                value={labSearch}
                                                                onChange={(e) => setLabSearch(e.target.value)}
                                                            />
                                                            {labSearch.length > 1 && (
                                                                <div className="absolute z-20 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-40 overflow-auto scrollbar-hide">
                                                                    {MOCK_LAB_TESTS.filter(t => t.toLowerCase().includes(labSearch.toLowerCase())).map(lab => (
                                                                        <div
                                                                            key={lab}
                                                                            className="p-2 hover:bg-muted cursor-pointer text-[11px] font-bold"
                                                                            onClick={() => { setLabSearch(lab); }}
                                                                        >
                                                                            {lab}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase pl-1">Urgency</Label>
                                                        <Select value={labUrgency} onValueChange={(v: any) => setLabUrgency(v)}>
                                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent><SelectItem value="routine">Routine</SelectItem><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="stat">STAT</SelectItem></SelectContent>
                                                        </Select>
                                                    </div>
                                                    <Button onClick={handleAddLab} className="w-full h-8 text-[11px] font-black uppercase tracking-widest shadow-sm" variant="secondary">
                                                        Add Order
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Actions Wrapper */}
                                            <div className="space-y-4 bg-primary/5 p-4 rounded-xl border border-primary/10">
                                                <h4 className="text-sm font-black uppercase tracking-tight text-primary flex items-center gap-2">
                                                    <Stethoscope className="w-4 h-4" />
                                                    Referrals & Escalate
                                                </h4>
                                                <div className="space-y-2">
                                                    <Button variant="outline" className="w-full justify-start text-[11px] font-bold h-9 bg-white shadow-sm hover:bg-primary/5 hover:text-primary transition-colors">
                                                        <Share2 className="w-3.5 h-3.5 mr-2" /> Specialist Referral
                                                    </Button>
                                                    <Button variant="outline" className="w-full justify-start text-[11px] font-bold h-9 bg-white shadow-sm hover:bg-primary/5 hover:text-primary transition-colors">
                                                        <Monitor className="w-3.5 h-3.5 mr-2" /> Request Imaging Clinic
                                                    </Button>
                                                    <Button variant="outline" className="w-full justify-start text-[11px] font-bold h-9 bg-red-50 text-red-600 border-red-200 shadow-sm hover:bg-red-600 hover:text-white transition-all">
                                                        <Phone className="w-3.5 h-3.5 mr-2" /> Hospital Admission
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Active Orders List */}
                                        <div className="space-y-3">
                                            <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Diagnostics Cart</Label>
                                            {labOrders.length === 0 ? (
                                                <div className="text-center py-8 border-2 border-dashed rounded-xl bg-muted/5 opacity-50">
                                                    <p className="text-[10px] font-black uppercase tracking-widest">No Tests Selected</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {labOrders.map((order, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-card border rounded-lg shadow-sm border-muted-foreground/10">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`p-1.5 rounded-md ${order.urgency === 'stat' ? 'bg-red-500 text-white' : 'bg-primary/10 text-primary'}`}>
                                                                    <Activity className="w-3 h-3" />
                                                                </div>
                                                                <span className="text-[11px] font-bold tracking-tight">{order.testName}</span>
                                                            </div>
                                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveLab(idx)} className="h-6 w-6">
                                                                <X className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </div>

                        {/* Persistent Footer Actions */}
                        <div className="p-3 bg-muted/10 border-t flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] h-5 opacity-60">SESSION ID: {consultationId.slice(0, 6)}</Badge>
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            </div>
                            <Button
                                className="h-9 px-8 bg-green-600 hover:bg-green-700 shadow-xl font-black text-[11px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                                onClick={handleFinish}
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Finalize Session
                            </Button>
                        </div>
                    </Tabs>
                </div>

                {/* Right Panel: Tools & Chat */}
                <div className="lg:col-span-1 flex flex-col gap-4 h-full overflow-hidden">
                    <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0 bg-card border rounded-xl overflow-hidden shadow-sm">
                        <TabsList className="grid grid-cols-2 bg-muted/20 border-b rounded-none h-11">
                            <TabsTrigger value="chat" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-card">
                                <MessageSquare className="w-3.5 h-3.5 mr-2" />
                                Live Chat
                            </TabsTrigger>
                            <TabsTrigger value="docs" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-card">
                                <Monitor className="w-3.5 h-3.5 mr-2" />
                                Files / Labs
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 p-0 m-0">
                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-4">
                                    {chatMessages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 opacity-30">
                                            <MessageSquare className="w-8 h-8" />
                                            <p className="text-[10px] uppercase font-black tracking-widest">No Messages Yet</p>
                                        </div>
                                    ) : (
                                        chatMessages.map(msg => (
                                            <div key={msg.id} className={`flex flex-col ${msg.sender === 'doctor' ? 'items-end' : 'items-start'}`}>
                                                <div className={`max-w-[85%] p-3 rounded-2xl text-[12px] font-medium leading-normal shadow-sm ${msg.sender === 'doctor' ? 'bg-primary text-white rounded-tr-none' : 'bg-muted rounded-tl-none'
                                                    }`}>
                                                    {msg.text}
                                                </div>
                                                <span className="text-[8px] font-black text-muted-foreground/50 mt-1 uppercase tracking-tight">{msg.timestamp}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                            <div className="p-3 border-t bg-muted/5">
                                <div className="relative">
                                    <Input
                                        placeholder="Type instructions..."
                                        className="pr-12 h-10 text-xs font-medium rounded-full border-muted-foreground/10 bg-white"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="absolute right-1 top-1 h-8 w-8 text-primary hover:bg-primary/5"
                                        onClick={handleSendMessage}
                                    >
                                        <Share2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="docs" className="flex-1 flex flex-col p-4 m-0 space-y-4">
                            <div className="flex-1 border-2 border-dashed rounded-xl bg-muted/5 flex flex-col items-center justify-center text-center p-6 space-y-3">
                                <Monitor className="w-10 h-10 text-muted-foreground opacity-30" />
                                <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80">No Shared Media</h5>
                                    <p className="text-[10px] text-muted-foreground mt-1 px-4 leading-relaxed tracking-tight">Patient documents, lab photos, and imaging scans will appear here when shared during the call.</p>
                                </div>
                            </div>
                            <Button variant="outline" className="w-full h-9 border-dashed text-[10px] font-black uppercase tracking-widest">
                                <Plus className="w-3.5 h-3.5 mr-2" /> Upload Reference
                            </Button>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
