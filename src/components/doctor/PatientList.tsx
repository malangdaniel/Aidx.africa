import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, MoreHorizontal, FileText, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Patient {
    id: string;
    name: string;
    age: number;
    gender: string;
    lastVisit: string;
    condition: string;
    status: 'Active' | 'Recovered' | 'Critical';
    image?: string;
}

interface PatientListProps {
    onSelectPatient: (patientId: string) => void;
}

// Mock Data
const MOCK_PATIENTS: Patient[] = [
    {
        id: '1',
        name: 'John Doe',
        age: 45,
        gender: 'Male',
        lastVisit: '2024-03-10',
        condition: 'Hypertension',
        status: 'Active',
    },
    {
        id: '2',
        name: 'Sarah Smith',
        age: 32,
        gender: 'Female',
        lastVisit: '2024-03-08',
        condition: 'Migraine',
        status: 'Active',
    },
    {
        id: '3',
        name: 'Michael Johnson',
        age: 58,
        gender: 'Male',
        lastVisit: '2024-02-28',
        condition: 'Type 2 Diabetes',
        status: 'Critical',
    },
    {
        id: '4',
        name: 'Emily Davis',
        age: 24,
        gender: 'Female',
        lastVisit: '2024-03-01',
        condition: 'Routine Checkup',
        status: 'Recovered',
    },
];

export default function PatientList({ onSelectPatient }: PatientListProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPatients = MOCK_PATIENTS.filter(patient =>
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.condition.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search patients by name or condition..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline">Filter</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPatients.map((patient) => (
                    <Card key={patient.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => onSelectPatient(patient.id)}>
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

            {filteredPatients.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    No patients found matching your search.
                </div>
            )}
        </div>
    );
}
