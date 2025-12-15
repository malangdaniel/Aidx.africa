import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Activity, Heart, Scale } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// Mock Data
const INITIAL_DATA = [
    { date: 'Mon', systolic: 120, diastolic: 80, heartRate: 72, weight: 70.5 },
    { date: 'Tue', systolic: 122, diastolic: 82, heartRate: 75, weight: 70.4 },
    { date: 'Wed', systolic: 118, diastolic: 79, heartRate: 71, weight: 70.6 },
    { date: 'Thu', systolic: 124, diastolic: 84, heartRate: 76, weight: 70.3 },
    { date: 'Fri', systolic: 121, diastolic: 75, heartRate: 73, weight: 70.2 },
    { date: 'Sat', systolic: 119, diastolic: 80, heartRate: 70, weight: 70.1 },
    { date: 'Sun', systolic: 120, diastolic: 80, heartRate: 72, weight: 70.0 },
];

export default function HealthTracker() {
    const [data, setData] = useState(INITIAL_DATA);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newEntry, setNewEntry] = useState({
        systolic: '',
        diastolic: '',
        heartRate: '',
        weight: ''
    });

    const handleAddEntry = () => {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
        setData([...data, {
            date: today,
            systolic: Number(newEntry.systolic) || 0,
            diastolic: Number(newEntry.diastolic) || 0,
            heartRate: Number(newEntry.heartRate) || 0,
            weight: Number(newEntry.weight) || 0
        }]);
        setIsDialogOpen(false);
        setNewEntry({ systolic: '', diastolic: '', heartRate: '', weight: '' });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="w-6 h-6 text-primary" />
                        Health Tracker
                    </h2>
                    <p className="text-muted-foreground">Monitor your vitals and health metrics</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Log Vitals
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Log Health Metrics</DialogTitle>
                            <DialogDescription>Enter your latest readings below.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="systolic">Systolic (mmHg)</Label>
                                    <Input
                                        id="systolic"
                                        placeholder="120"
                                        value={newEntry.systolic}
                                        onChange={(e) => setNewEntry({ ...newEntry, systolic: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="diastolic">Diastolic (mmHg)</Label>
                                    <Input
                                        id="diastolic"
                                        placeholder="80"
                                        value={newEntry.diastolic}
                                        onChange={(e) => setNewEntry({ ...newEntry, diastolic: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="heartRate">Heart Rate (bpm)</Label>
                                    <Input
                                        id="heartRate"
                                        placeholder="72"
                                        value={newEntry.heartRate}
                                        onChange={(e) => setNewEntry({ ...newEntry, heartRate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="weight">Weight (kg)</Label>
                                    <Input
                                        id="weight"
                                        placeholder="70.5"
                                        value={newEntry.weight}
                                        onChange={(e) => setNewEntry({ ...newEntry, weight: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddEntry}>Save Entry</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Blood Pressure</CardTitle>
                        <Heart className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">120/80</div>
                        <p className="text-xs text-muted-foreground">Normal range</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Heart Rate</CardTitle>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">72 bpm</div>
                        <p className="text-xs text-muted-foreground">+2% from last week</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Weight</CardTitle>
                        <Scale className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">70.0 kg</div>
                        <p className="text-xs text-muted-foreground">-0.5 kg this week</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="bp" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="bp">Blood Pressure</TabsTrigger>
                    <TabsTrigger value="hr">Heart Rate</TabsTrigger>
                    <TabsTrigger value="weight">Weight</TabsTrigger>
                </TabsList>

                <TabsContent value="bp" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Blood Pressure Trend</CardTitle>
                            <CardDescription>Systolic and Diastolic pressure over time.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis domain={[60, 160]} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="systolic" stroke="#ef4444" name="Systolic" strokeWidth={2} />
                                    <Line type="monotone" dataKey="diastolic" stroke="#f97316" name="Diastolic" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="hr" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Heart Rate Trend</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis domain={[40, 120]} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="heartRate" stroke="#3b82f6" name="Heart Rate" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="weight" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Weight Trend</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis domain={['auto', 'auto']} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="weight" stroke="#10b981" name="Weight" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
