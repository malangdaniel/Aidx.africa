import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Video, FileText, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';

interface Consultation {
    id: string;
    scheduled_at: string;
    status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
    price: number;
    doctor_id: string;
    doctor_profile?: {
        first_name: string;
        last_name: string;
        specialties?: string[];
        metadata?: {
            avatar_url?: string;
        }
    };
}

const MOCK_CONSULTATIONS: Consultation[] = [
    {
        id: 'mock-1',
        scheduled_at: addDays(new Date(), 1).toISOString(),
        status: 'scheduled',
        price: 15000,
        doctor_id: 'doc-1',
        doctor_profile: {
            first_name: 'Sarah',
            last_name: 'Johnson',
            specialties: ['Cardiologist'],
            metadata: { avatar_url: 'https://i.pravatar.cc/150?u=doc1' }
        }
    },
    {
        id: 'mock-2',
        scheduled_at: new Date().toISOString(),
        status: 'ongoing',
        price: 12000,
        doctor_id: 'doc-2',
        doctor_profile: {
            first_name: 'Michael',
            last_name: 'Chen',
            specialties: ['General Physician'],
            metadata: { avatar_url: 'https://i.pravatar.cc/150?u=doc2' }
        }
    },
    {
        id: 'mock-3',
        scheduled_at: subDays(new Date(), 3).toISOString(),
        status: 'completed',
        price: 10000,
        doctor_id: 'doc-3',
        doctor_profile: {
            first_name: 'Amara',
            last_name: 'Okonkwo',
            specialties: ['Pediatrician'],
            metadata: { avatar_url: 'https://i.pravatar.cc/150?u=doc3' }
        }
    }
];

interface ConsultationsListProps {
    onJoinCall?: (consultation: Consultation) => void;
}

export default function ConsultationsList({ onJoinCall }: ConsultationsListProps) {
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConsultations();
    }, []);

    const fetchConsultations = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                // For demo purposes if not logged in
                setConsultations(MOCK_CONSULTATIONS);
                return;
            };

            const { data, error } = await supabase
                .from('consultations')
                .select(`
                    id,
                    scheduled_at,
                    status,
                    price,
                    doctor_id,
                    profiles:doctor_id (
                        first_name,
                        last_name,
                        metadata
                    ),
                    doctors:doctor_id (
                        specialties
                    )
                `)
                .eq('patient_id', user.id)
                .order('scheduled_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                const mapped: Consultation[] = data.map((c: any) => ({
                    id: c.id,
                    scheduled_at: c.scheduled_at,
                    status: c.status,
                    price: c.price,
                    doctor_id: c.doctor_id,
                    doctor_profile: {
                        first_name: c.profiles?.first_name || 'Unknown',
                        last_name: c.profiles?.last_name || 'Doctor',
                        specialties: c.doctors?.specialties,
                        metadata: c.profiles?.metadata
                    }
                }));
                setConsultations(mapped);
            } else {
                // If no real data, show mock data for demonstration
                setConsultations(MOCK_CONSULTATIONS);
            }
        } catch (error) {
            console.error('Error fetching consultations:', error);
            // Fallback to mock data on error too for better demo
            setConsultations(MOCK_CONSULTATIONS);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'scheduled':
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Scheduled</Badge>;
            case 'ongoing':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 animate-pulse">Ongoing</Badge>;
            case 'completed':
                return <Badge variant="secondary">Completed</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {consultations.map((consultation) => (
                <Card key={consultation.id} className="overflow-hidden hover:shadow-sm transition-shadow">
                    <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row">
                            <div className="p-4 flex-1 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            {consultation.doctor_profile?.metadata?.avatar_url ? (
                                                <img
                                                    src={consultation.doctor_profile.metadata.avatar_url}
                                                    alt="Doctor"
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                <User className="w-6 h-6 text-primary" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold flex items-center gap-2">
                                                Dr. {consultation.doctor_profile?.first_name} {consultation.doctor_profile?.last_name}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                {consultation.doctor_profile?.specialties?.[0] || 'Medical Specialist'}
                                            </p>
                                        </div>
                                    </div>
                                    {getStatusBadge(consultation.status)}
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="w-4 h-4" />
                                        <span>{format(new Date(consultation.scheduled_at), 'MMM dd, yyyy')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Clock className="w-4 h-4" />
                                        <span>{format(new Date(consultation.scheduled_at), 'hh:mm a')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-muted/30 p-4 flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-3 min-w-[140px] border-t sm:border-t-0 sm:border-l">
                                <div className="text-center hidden sm:block">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Price</p>
                                    <p className="text-lg font-bold">₦{consultation.price.toLocaleString()}</p>
                                </div>

                                <div className="flex sm:flex-col gap-2 w-full">
                                    {consultation.status === 'scheduled' || consultation.status === 'ongoing' ? (
                                        <Button
                                            size="sm"
                                            className="w-full gap-2 bg-primary"
                                            onClick={() => onJoinCall && onJoinCall(consultation)}
                                        >
                                            <Video className="w-4 h-4" />
                                            Join Call
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="outline" className="w-full gap-2">
                                            <FileText className="w-4 h-4" />
                                            Report
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
