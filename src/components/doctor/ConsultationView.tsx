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
import { User, FileText, MessageSquare, Pill, Plus, X, Check, Video, MicOff, CameraOff, Clock, CalendarDays, Activity } from 'lucide-react';
import { toast } from 'sonner';

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

export default function ConsultationView({ consultationId, patientName, clinicalSummary, onEndConsultation }: ConsultationViewProps) {
    const { user } = useAuth();
    const [note, setNote] = useState('');
    const [isCallActive, setIsCallActive] = useState(false);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-100px)] animate-in fade-in">
            {/* Left Panel: Patient Info & Context */}
            <div className="md:col-span-1 space-y-4 flex flex-col h-full overflow-hidden">
                <Card className="shrink-0">
                    <CardHeader className="flex flex-row items-center gap-4">
                        <Avatar className="h-12 w-12">
                            <AvatarFallback><User /></AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle>{patientName}</CardTitle>
                            <CardDescription>32 Years • Male • A+</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <Label className="text-muted-foreground text-xs uppercase">Chief Complaint</Label>
                                <p className="font-medium">"Severe chest pain radiating to left arm"</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground text-xs uppercase">Allergies</Label>
                                <div className="flex gap-2 mt-1">
                                    <Badge variant="destructive">Penicillin</Badge>
                                    <Badge variant="destructive">Peanuts</Badge>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* AI Clinical Summary Section */}
                <Card className="flex-1 flex flex-col overflow-hidden border-primary/20">
                    <CardHeader className="py-3 bg-primary/5">
                        <CardTitle className="text-sm flex items-center gap-2 text-primary">
                            <FileText className="w-4 h-4" />
                            AI Clinical Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-4">
                        {clinicalSummary ? (
                            <div className="text-sm font-mono whitespace-pre-wrap bg-muted/30 p-3 rounded-md border text-foreground/80">
                                {clinicalSummary}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-4">
                                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                                <p>No AI summary available for this patient.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Center/Right Panel: Workspace */}
            <div className="md:col-span-2 flex flex-col gap-4 h-full overflow-hidden">
                {/* Active Call UI */}
                {isCallActive ? (
                    <div className="h-64 shrink-0 shadow-lg rounded-lg overflow-hidden border">
                        <VideoCall
                            roomId={consultationId}
                            userId={user?.id || 'doc-anon'}
                            userName="Dr. User"
                            isDoctor={true}
                            onEndCall={() => setIsCallActive(false)}
                        />
                    </div>
                ) : (
                    <div className="bg-muted/10 border-2 border-dashed rounded-lg h-32 shrink-0 flex items-center justify-center gap-4 hover:bg-muted/20 transition-colors">
                        <div className="text-center">
                            <Button
                                size="lg"
                                className="gap-2 rounded-full shadow-md"
                                onClick={() => setIsCallActive(true)}
                            >
                                <Video className="w-5 h-5" />
                                Start Video Consultation
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">Connect with {patientName}</p>
                        </div>
                    </div>
                )}

                <Tabs defaultValue="notes" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="w-full justify-start border-b rounded-none p-0 h-auto bg-transparent">
                        <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2">
                            Clinical Notes
                        </TabsTrigger>
                        <TabsTrigger value="rx" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2">
                            Prescription
                        </TabsTrigger>
                        <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2">
                            Lab Orders
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="notes" className="flex-1 mt-0 pt-4 overflow-hidden">
                        <Card className="h-full flex flex-col">
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm">SOAP Notes</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 p-0">
                                <Textarea
                                    placeholder="Subjective, Objective, Assessment, Plan..."
                                    className="h-full resize-none font-mono border-0 focus-visible:ring-0 rounded-none p-4"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="rx" className="flex-1 mt-0 pt-4 overflow-hidden">
                        <Card className="h-full flex flex-col">
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm">E-Prescription</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto p-4 space-y-6">
                                {/* Add Medication Form */}
                                <div className="space-y-4 bg-muted/30 p-4 rounded-lg border">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="med-name">Medication Name</Label>
                                            <Input
                                                id="med-name"
                                                placeholder="e.g. Amoxicillin"
                                                value={rxName}
                                                onChange={(e) => setRxName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="med-dose">Dose</Label>
                                            <Input
                                                id="med-dose"
                                                placeholder="e.g. 500mg"
                                                value={rxDosage}
                                                onChange={(e) => setRxDosage(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="med-freq">Frequency</Label>
                                            <Select value={rxFrequency} onValueChange={setRxFrequency}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select frequency" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="QD">Once daily (QD)</SelectItem>
                                                    <SelectItem value="BID">Twice daily (BID)</SelectItem>
                                                    <SelectItem value="TID">Three times daily (TID)</SelectItem>
                                                    <SelectItem value="QID">Four times daily (QID)</SelectItem>
                                                    <SelectItem value="PRN">As needed (PRN)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="med-dur">Duration</Label>
                                            <Input
                                                id="med-dur"
                                                placeholder="e.g. 7 days"
                                                value={rxDuration}
                                                onChange={(e) => setRxDuration(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <Button onClick={handleAddMedication} className="w-full">
                                        <Plus className="w-4 h-4 mr-2" /> Add to Prescription
                                    </Button>
                                </div>

                                {/* List of Added Meds */}
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">Prescribed List</Label>
                                    {prescribedMeds.length === 0 ? (
                                        <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                                            No medications added yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {prescribedMeds.map((med, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-background border rounded-md shadow-sm">
                                                    <div className="flex items-start gap-3">
                                                        <div className="bg-primary/10 p-2 rounded-full mt-1">
                                                            <Pill className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-sm">{med.name} <span className="text-muted-foreground font-normal">({med.dosage})</span></p>
                                                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {med.frequency}</span>
                                                                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {med.duration}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveMedication(idx)} className="text-muted-foreground hover:text-destructive">
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="orders" className="flex-1 mt-0 pt-4 overflow-hidden">
                        <Card className="h-full flex flex-col">
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm">Lab Orders</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto p-4 space-y-6">
                                {/* Add Lab Form */}
                                <div className="space-y-4 bg-muted/30 p-4 rounded-lg border">
                                    <div className="space-y-2">
                                        <Label htmlFor="lab-search">Test Name</Label>
                                        <div className="relative">
                                            <Input
                                                id="lab-search"
                                                placeholder="Search e.g. CBC, MRI, Lipid Panel"
                                                value={labSearch}
                                                onChange={(e) => setLabSearch(e.target.value)}
                                            />
                                            {labSearch.length > 0 && filteredLabs.length > 0 && (
                                                <div className="absolute z-10 w-full bg-popover border rounded-md shadow-md mt-1 max-h-40 overflow-auto">
                                                    {filteredLabs.map((lab) => (
                                                        <div
                                                            key={lab}
                                                            className="p-2 hover:bg-muted cursor-pointer text-sm"
                                                            onClick={() => setLabSearch(lab)}
                                                        >
                                                            {lab}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="lab-urgency">Urgency</Label>
                                            <Select value={labUrgency} onValueChange={(v: any) => setLabUrgency(v)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="routine">Routine</SelectItem>
                                                    <SelectItem value="urgent">Urgent (24h)</SelectItem>
                                                    <SelectItem value="stat">STAT (Immediate)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lab-reason">Details / Indication</Label>
                                            <Input
                                                id="lab-reason"
                                                placeholder="e.g. Rule out anemia"
                                                value={labReason}
                                                onChange={(e) => setLabReason(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <Button onClick={handleAddLab} className="w-full">
                                        <Plus className="w-4 h-4 mr-2" /> Add Lab Order
                                    </Button>
                                </div>

                                {/* List of Added Labs */}
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">Ordered Tests</Label>
                                    {labOrders.length === 0 ? (
                                        <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                                            No lab tests ordered.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {labOrders.map((order, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-background border rounded-md shadow-sm">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-2 rounded-full mt-1 ${order.urgency === 'stat' ? 'bg-red-100 text-red-600' :
                                                                order.urgency === 'urgent' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                                                            }`}>
                                                            <Activity className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold text-sm">{order.testName}</p>
                                                                {order.urgency !== 'routine' && (
                                                                    <Badge variant={order.urgency === 'stat' ? 'destructive' : 'secondary'} className="text-[10px] h-5 px-1 uppercase">
                                                                        {order.urgency}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-1">Indication: {order.reason}</p>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveLab(idx)} className="text-muted-foreground hover:text-destructive">
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end pt-2 shrink-0">
                    <Button size="lg" className="w-full md:w-auto bg-green-600 hover:bg-green-700 shadow-md" onClick={handleFinish}>
                        <Check className="w-4 h-4 mr-2" />
                        Finalize Consultation & Save Record
                    </Button>
                </div>
            </div>
        </div>
    );
}
