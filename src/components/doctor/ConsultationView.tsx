import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { User, FileText, MessageSquare, Pill, Plus, X, Check, Video, MicOff, CameraOff } from 'lucide-react';
import { toast } from 'sonner';

interface ConsultationViewProps {
    consultationId: string;
    patientName: string;
    onEndConsultation: () => void;
}

export default function ConsultationView({ consultationId, patientName, onEndConsultation }: ConsultationViewProps) {
    const [note, setNote] = useState('');
    const [medicationSearch, setMedicationSearch] = useState('');
    const [prescribedMeds, setPrescribedMeds] = useState<string[]>([]);

    const handleAddMedication = () => {
        if (medicationSearch.trim()) {
            setPrescribedMeds([...prescribedMeds, medicationSearch.trim()]);
            setMedicationSearch('');
        }
    };

    const handleRemoveMedication = (index: number) => {
        const newMeds = [...prescribedMeds];
        newMeds.splice(index, 1);
        setPrescribedMeds(newMeds);
    };

    const handleFinish = () => {
        toast.success("Consultation Completed", {
            description: `Notes saved and ${prescribedMeds.length} prescriptions sent to pharmacy.`
        });
        onEndConsultation();
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-100px)]">
            {/* Left Panel: Patient Info & Context */}
            <div className="md:col-span-1 space-y-4 flex flex-col">
                <Card>
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

                <Card className="flex-1 flex flex-col overflow-hidden">
                    <CardHeader className="py-3 bg-muted/30">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            AI Pre-Consultation Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-4">
                        <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-900 space-y-2 mb-4">
                            <p className="font-bold">AI Assessment: Angina Pectoris (75%)</p>
                            <p>Patient reported sudden onset chest pain (7/10 severity). Denies shortness of breath. No history of cardiac issues in family.</p>
                        </div>
                        <div className="space-y-4 text-sm">
                            <div className="border-l-2 border-primary pl-3">
                                <p className="text-xs text-muted-foreground mb-1">Patient</p>
                                <p>I have this sharp pain in my chest, it started about an hour ago.</p>
                            </div>
                            <div className="border-l-2 border-muted pl-3">
                                <p className="text-xs text-muted-foreground mb-1">AI Assistant</p>
                                <p>Is the pain localized or does it radiate?</p>
                            </div>
                            <div className="border-l-2 border-primary pl-3">
                                <p className="text-xs text-muted-foreground mb-1">Patient</p>
                                <p>It goes down my left arm a bit.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Center/Right Panel: Workspace */}
            <div className="md:col-span-2 flex flex-col gap-4">
                {/* Active Call UI Mockup */}
                <div className="bg-black/90 rounded-lg h-64 flex items-center justify-center relative overflow-hidden group">
                    <div className="text-white text-center">
                        <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Video Connected</p>
                        <p className="text-xs opacity-60">04:23</p>
                    </div>
                    <div className="absolute bottom-4 flex gap-4">
                        <Button variant="secondary" size="icon" className="rounded-full"><MicOff className="w-4 h-4" /></Button>
                        <Button variant="destructive" size="icon" className="rounded-full" onClick={onEndConsultation}><Video className="w-4 h-4" /></Button>
                        <Button variant="secondary" size="icon" className="rounded-full"><CameraOff className="w-4 h-4" /></Button>
                    </div>
                </div>

                <Tabs defaultValue="notes" className="flex-1 flex flex-col">
                    <TabsList>
                        <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
                        <TabsTrigger value="rx">Prescription</TabsTrigger>
                        <TabsTrigger value="orders">Lab Orders</TabsTrigger>
                    </TabsList>

                    <TabsContent value="notes" className="flex-1 mt-4">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-sm">SOAP Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    placeholder="Subjective, Objective, Assessment, Plan..."
                                    className="h-[300px] resize-none font-mono"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="rx" className="flex-1 mt-4">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-sm">E-Prescription</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Search medication..."
                                        value={medicationSearch}
                                        onChange={(e) => setMedicationSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddMedication()}
                                    />
                                    <Button onClick={handleAddMedication}><Plus className="w-4 h-4" /></Button>
                                </div>

                                <div className="space-y-2">
                                    {prescribedMeds.map((med, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-md">
                                            <div className="flex items-center gap-2">
                                                <Pill className="w-4 h-4 text-primary" />
                                                <span className="font-medium">{med}</span>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => handleRemoveMedication(idx)}>
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {prescribedMeds.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-8">No medications added yet.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="orders" className="flex-1 mt-4">
                        <div className="flex items-center justify-center h-full text-muted-foreground bg-muted/20 rounded-lg border border-dashed text-sm">
                            Lab ordering module would go here.
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end pt-2">
                    <Button size="lg" className="w-full md:w-auto bg-green-600 hover:bg-green-700" onClick={handleFinish}>
                        <Check className="w-4 h-4 mr-2" />
                        Finalize Consultation
                    </Button>
                </div>
            </div>
        </div>
    );
}
