import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar, FileText, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PatientDetailProps {
    patientId: string;
    onBack: () => void;
}

// Mock Data
const MOCK_VITALS_DATA = [
    { date: 'Mon', systolic: 120, diastolic: 80, heartRate: 72 },
    { date: 'Tue', systolic: 122, diastolic: 82, heartRate: 75 },
    { date: 'Wed', systolic: 118, diastolic: 79, heartRate: 71 },
    { date: 'Thu', systolic: 124, diastolic: 84, heartRate: 76 },
    { date: 'Fri', systolic: 121, diastolic: 81, heartRate: 73 },
    { date: 'Sat', systolic: 119, diastolic: 80, heartRate: 70 },
    { date: 'Sun', systolic: 120, diastolic: 80, heartRate: 72 },
];

export default function PatientDetail({ patientId, onBack }: PatientDetailProps) {
    // In a real app, fetch patient data by ID here. 
    // For now, we use placeholder data matching the ID logic if we wanted, 
    // but just static structure is fine for the UI.

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold">Patient Details</h2>
                    <p className="text-muted-foreground text-sm">ID: {patientId}</p>
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
                                JD
                            </div>
                            <h3 className="text-xl font-bold">John Doe</h3>
                            <p className="text-muted-foreground">45 years old • Male</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <span className="text-sm text-muted-foreground block">Condition</span>
                                <span className="font-medium">Hypertension</span>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground block">Phone</span>
                                <span className="font-medium">+1 (555) 123-4567</span>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground block">Email</span>
                                <span className="font-medium">john.doe@example.com</span>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground block">Address</span>
                                <span className="font-medium">123 Health St, Medical City</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* content Area */}
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
                                        <LineChart data={MOCK_VITALS_DATA}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="systolic" stroke="#ef4444" name="Systolic BP" />
                                            <Line type="monotone" dataKey="diastolic" stroke="#f97316" name="Diastolic BP" />
                                            <Line type="monotone" dataKey="heartRate" stroke="#3b82f6" name="Heart Rate" />
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
                                        <div className="text-2xl font-bold">Mar 10</div>
                                        <p className="text-xs text-muted-foreground">Routine Checkup</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">Next Appointment</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">Apr 12</div>
                                        <p className="text-xs text-muted-foreground">Follow-up</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="history" className="mt-4">
                            <Card>
                                <CardContent className="p-0">
                                    {[1, 2, 3].map((_, i) => (
                                        <div key={i} className="flex items-start gap-4 p-4 border-b last:border-0 hover:bg-muted/50 transition-colors">
                                            <div className="mt-1 bg-primary/10 p-2 rounded-full">
                                                <Calendar className="w-4 h-4 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">General Consultation</h4>
                                                <p className="text-sm text-muted-foreground">March {10 - i * 5}, 2024</p>
                                                <p className="mt-2 text-sm">Patient reported mild headaches. Prescribed Paracetamol and advised rest.</p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notes" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Private Notes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                            <h4 className="font-semibold text-yellow-900 mb-1">Allergies</h4>
                                            <p className="text-sm text-yellow-800">Penicillin (Severe)</p>
                                        </div>
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                                            <h4 className="font-semibold text-blue-900 mb-1">Observation</h4>
                                            <p className="text-sm text-blue-800">Monitor blood pressure closely over next 3 months.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
