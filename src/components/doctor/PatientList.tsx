import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, ShieldCheck, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PastPatient {
    patient_id: string;
    first_name: string | null;
    last_name: string | null;
    gender: string | null;
    age_years: number | null;
    visit_count: number;
    last_visit_at: string | null;
    last_chief_complaint: string | null;
    last_diagnosis: string | null;
    has_upcoming: boolean;
    consent_given: boolean;
}

interface PatientListProps {
    onSelectPatient: (patientId: string) => void;
}

export default function PatientList({ onSelectPatient }: PatientListProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [patients, setPatients] = useState<PastPatient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        try {
            // Only patients this doctor has attended; enforced server-side.
            const { data, error } = await (supabase.rpc as any)('list_my_past_patients', {
                p_search: debouncedSearch || null,
            });
            if (error) throw error;
            setPatients((data || []) as PastPatient[]);
        } catch (error) {
            console.error('Error fetching patients:', error);
            toast.error('Failed to load patient list');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    return (
        <div className="space-y-4">
            <Alert className="border-primary/20 bg-primary/5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs">
                    You only see patients you have attended. Opening a patient's record is logged, and
                    <span className="font-semibold"> the patient is notified each time</span>.
                </AlertDescription>
            </Alert>

            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search your patients by name..."
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
                    {patients.map((p) => {
                        const name = `${p.first_name || 'Unknown'} ${p.last_name || ''}`.trim();
                        const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                        const meta = [p.age_years != null ? `${p.age_years} yrs` : null, p.gender].filter(Boolean).join(' • ');
                        return (
                            <Card
                                key={p.patient_id}
                                className="cursor-pointer hover:shadow-md transition-all"
                                onClick={() => onSelectPatient(p.patient_id)}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarFallback>{initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <CardTitle className="text-base truncate">{name}</CardTitle>
                                            {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="mt-2 space-y-2 text-sm">
                                        <div className="flex justify-between gap-2">
                                            <span className="text-muted-foreground">Last visit</span>
                                            <span className="font-medium">
                                                {p.last_visit_at ? new Date(p.last_visit_at).toLocaleDateString() : '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-muted-foreground">Visits</span>
                                            <span className="font-medium">{p.visit_count}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-muted-foreground shrink-0">Last concern</span>
                                            <span className="font-medium text-right truncate">
                                                {p.last_diagnosis || p.last_chief_complaint || '—'}
                                            </span>
                                        </div>
                                        <div className="pt-2 flex flex-wrap gap-2">
                                            {p.has_upcoming && <Badge>Follow-up booked</Badge>}
                                            <Badge variant={p.consent_given ? 'secondary' : 'outline'}>
                                                {p.consent_given ? 'History shared' : 'History not shared'}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {!loading && patients.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>{debouncedSearch ? 'No matching patients.' : 'Patients you attend will appear here.'}</p>
                </div>
            )}
        </div>
    );
}
