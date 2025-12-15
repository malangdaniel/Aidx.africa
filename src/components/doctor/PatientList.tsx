import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, MoreHorizontal, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Patient {
    id: string; // profile id
    userId: string; // auth user id
    name: string;
    age: number | string;
    gender: string;
    lastVisit: string;
    condition: string;
    status: 'Active' | 'Recovered' | 'Critical' | 'Unknown';
    image?: string;
}

interface PatientListProps {
    onSelectPatient: (patientId: string) => void;
}

export default function PatientList({ onSelectPatient }: PatientListProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            // Fetch all profiles with role 'patient'
            // We also try to fetch their latest consultation time if possible, 
            // but for list performance we might skip that or do it separately.
            // For now, simple profile fetch.
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'patient');

            if (error) throw error;

            const mappedPatients: Patient[] = data.map((p: any) => ({
                id: p.id,
                userId: p.user_id,
                name: `${p.first_name || 'Unknown'} ${p.last_name || ''}`,
                age: p.metadata?.age || 'N/A',
                gender: p.metadata?.sex || 'N/A',
                lastVisit: 'Unknown', // Would require joining consultations
                condition: 'General', // Would require joining medical history
                status: 'Active',
                image: p.metadata?.avatar_url
            }));

            setPatients(mappedPatients);
        } catch (error) {
            console.error("Error fetching patients:", error);
            toast.error("Failed to load patient list");
        } finally {
            setLoading(false);
        }
    };

    const filteredPatients = patients.filter(patient =>
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.condition.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search patients by name..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" onClick={fetchPatients} title="Refresh List">Refresh</Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredPatients.map((patient) => (
                        <Card key={patient.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => onSelectPatient(patient.userId)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={patient.image} />
                                        <AvatarFallback>{patient.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <CardTitle className="text-base">{patient.name}</CardTitle>
                                        <p className="text-sm text-muted-foreground">{patient.age} yrs • {patient.gender}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Last Visit:</span>
                                        <span className="font-medium">{patient.lastVisit}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Condition:</span>
                                        <span className="font-medium">{patient.condition}</span>
                                    </div>
                                    <div className="pt-2 flex gap-2">
                                        <Badge variant={patient.status === 'Critical' ? 'destructive' : 'secondary'}>
                                            {patient.status}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {!loading && filteredPatients.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    No patients found.
                </div>
            )}
        </div>
    );
}
