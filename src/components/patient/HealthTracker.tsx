import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Activity, Heart, Scale, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { VitalsService, VitalRecord } from '@/services/VitalsService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export default function HealthTracker() {
    const { user } = useAuth();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Stats for cards
    const [avgBp, setAvgBp] = useState("0/0");
    const [avgHr, setAvgHr] = useState("0");
    const [currentWeight, setCurrentWeight] = useState("0");

    const [newEntry, setNewEntry] = useState({
        systolic: '',
        diastolic: '',
        heartRate: '',
        weight: ''
    });

    useEffect(() => {
        if (user) {
            loadVitals();
        }
    }, [user]);

    const loadVitals = async () => {
        try {
            setLoading(true);
            const records = await VitalsService.getVitals(14); // Last 2 weeks

            // Format for Chart (Recharts expects array of objects)
            // We reverse because API returns desc (latest first), but chart needs asc (oldest left to right)
            const chartData = [...records].reverse().map(r => ({
                date: format(parseISO(r.recorded_at), 'dd MMM'), // e.g. "05 Feb"
                systolic: r.systolic,
                diastolic: r.diastolic,
                heartRate: r.heart_rate,
                weight: Number(r.weight)
            }));

            setData(chartData);
            calculateStats(records);
        } catch (error) {
            console.error("Failed to load vitals", error);
            toast.error("Could not load health history");
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (records: VitalRecord[]) => {
        if (records.length === 0) return;

        // Latest Weight
        const latestWeightRecord = records.find(r => r.weight);
        if (latestWeightRecord) setCurrentWeight(String(latestWeightRecord.weight));

        // Avg BP (last 7 entries)
        const bpRecords = records.filter(r => r.systolic && r.diastolic).slice(0, 7);
        if (bpRecords.length > 0) {
            const totalSys = bpRecords.reduce((sum, r) => sum + (r.systolic || 0), 0);
            const totalDia = bpRecords.reduce((sum, r) => sum + (r.diastolic || 0), 0);
            setAvgBp(`${Math.round(totalSys / bpRecords.length)}/${Math.round(totalDia / bpRecords.length)}`);
        }

        // Avg Heart Rate
        const hrRecords = records.filter(r => r.heart_rate).slice(0, 7);
        if (hrRecords.length > 0) {
            const totalHr = hrRecords.reduce((sum, r) => sum + (r.heart_rate || 0), 0);
            setAvgHr(String(Math.round(totalHr / hrRecords.length)));
        }
    };

    const handleAddEntry = async () => {
        if (!user) return;

        // Basic validation
        if (!newEntry.systolic && !newEntry.diastolic && !newEntry.heartRate && !newEntry.weight) {
            toast.error("Please enter at least one metric");
            return;
        }

        try {
            setSaving(true);
            await VitalsService.logVitals({
                systolic: newEntry.systolic ? Number(newEntry.systolic) : undefined,
                diastolic: newEntry.diastolic ? Number(newEntry.diastolic) : undefined,
                heart_rate: newEntry.heartRate ? Number(newEntry.heartRate) : undefined,
                weight: newEntry.weight ? Number(newEntry.weight) : undefined
            });

            toast.success("Vitals logged successfully");
            setIsDialogOpen(false);
            setNewEntry({ systolic: '', diastolic: '', heartRate: '', weight: '' });
            loadVitals(); // Refresh data
        } catch (error) {
            console.error(error);
            toast.error("Failed to save entry");
        } finally {
            setSaving(false);
        }
    };

    if (loading && data.length === 0) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

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
                                        type="number"
                                        placeholder="120"
                                        value={newEntry.systolic}
                                        onChange={(e) => setNewEntry({ ...newEntry, systolic: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="diastolic">Diastolic (mmHg)</Label>
                                    <Input
                                        id="diastolic"
                                        type="number"
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
                                        type="number"
                                        placeholder="72"
                                        value={newEntry.heartRate}
                                        onChange={(e) => setNewEntry({ ...newEntry, heartRate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="weight">Weight (kg)</Label>
                                    <Input
                                        id="weight"
                                        type="number"
                                        placeholder="70.5"
                                        value={newEntry.weight}
                                        onChange={(e) => setNewEntry({ ...newEntry, weight: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddEntry} disabled={saving}>
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Save Entry
                            </Button>
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
                        <div className="text-2xl font-bold">{avgBp}</div>
                        <p className="text-xs text-muted-foreground">Last 7 readings</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Heart Rate</CardTitle>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{avgHr} bpm</div>
                        <p className="text-xs text-muted-foreground">Last 7 readings</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Weight</CardTitle>
                        <Scale className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{currentWeight} kg</div>
                        <p className="text-xs text-muted-foreground">Latest entry</p>
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
                                    <YAxis domain={['auto', 'auto']} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="systolic" stroke="#ef4444" name="Systolic" strokeWidth={2} connectNulls />
                                    <Line type="monotone" dataKey="diastolic" stroke="#f97316" name="Diastolic" strokeWidth={2} connectNulls />
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
                                    <YAxis domain={['auto', 'auto']} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="heartRate" stroke="#3b82f6" name="Heart Rate" strokeWidth={2} connectNulls />
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
                                    <Line type="monotone" dataKey="weight" stroke="#10b981" name="Weight" strokeWidth={2} connectNulls />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
