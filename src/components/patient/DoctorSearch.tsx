import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Loader2 } from 'lucide-react';
import DoctorCard, { Doctor } from './DoctorCard';
import BookingModal from './BookingModal';
import DoctorProfileOverlay from './DoctorProfileOverlay';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DoctorSearchProps {
    initialSpecialty?: string;
}

export default function DoctorSearch({ initialSpecialty }: DoctorSearchProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState(initialSpecialty || 'all');
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [selectedProfileDoctor, setSelectedProfileDoctor] = useState<Doctor | null>(null);
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Real Data State
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);

    useEffect(() => {
        if (initialSpecialty) {
            setSpecialtyFilter(initialSpecialty);
        }
    }, [initialSpecialty]);

    useEffect(() => {
        fetchDoctors();
    }, []);

    const fetchDoctors = async () => {
        setLoading(true);
        try {
            // Join doctors with profiles to get name and details
            const { data, error } = await supabase
                .from('doctors')
                .select(`
                    id,
                    specialties,
                    consult_price,
                    rating,
                    total_consultations,
                    bio,
                    user_id,
                    profiles:user_id (
                        first_name,
                        last_name,
                        metadata
                    )
                `);

            if (error) throw error;

            const mappedDoctors: Doctor[] = data.map((d: any) => ({
                id: d.id, // This is the doctor table ID
                userId: d.user_id, // Auth user id
                name: `Dr. ${d.profiles?.first_name || 'Unknown'} ${d.profiles?.last_name || ''}`,
                specialty: d.specialties && d.specialties.length > 0 ? d.specialties[0] : 'General Practitioner',
                rating: Number(d.rating) || 0,
                reviews: d.total_consultations || 0, // Using consult count as proxy for reviews count for now
                nextAvailable: 'Available Today', // Placeholder until availability system is built
                price: Number(d.consult_price) || 0,
                imageUrl: d.profiles?.metadata?.avatar_url || 'https://ui.shadcn.com/avatars/01.png',
                bio: d.bio || "Experienced medical professional."
            }));

            setDoctors(mappedDoctors);

            // Extract unique specialties
            const specialties = Array.from(new Set(
                mappedDoctors.flatMap(doc => doc.specialty ? [doc.specialty] : [])
            ));
            setAvailableSpecialties(specialties);

        } catch (error) {
            console.error("Error fetching doctors:", error);
            toast.error("Failed to load doctors list.");
        } finally {
            setLoading(false);
        }
    };

    const filteredDoctors = doctors.filter(doc => {
        const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.specialty.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSpecialty = specialtyFilter === 'all' || doc.specialty === specialtyFilter;

        return matchesSearch && matchesSpecialty;
    });

    const handleBookClick = (doctor: Doctor) => {
        setSelectedDoctor(doctor);
        setIsBookingOpen(true);
    };

    const handleBookingConfirm = async (details: any) => {
        try {
            console.log('Booking Confirmed:', details);

            // In a real app, 'details' would likely come from the BookingModal 
            // and include patient info. We assume the current auth user is the patient.
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast.error("You must be logged in to book an appointment");
                return;
            }

            // Insert into consultations table
            const { error } = await supabase
                .from('consultations')
                .insert({
                    doctor_id: details.doctor.userId, // CAREFUL: consultation needs user_id of doctor, not doctor table id? Schema says doctor_id references auth.users
                    patient_id: user.id,
                    status: 'scheduled',
                    price: details.doctor.price,
                    scheduled_at: new Date().toISOString(), // Mocking 'now' for simplicity, actual modal should provide time
                    notes: "Initial consultation booking"
                });

            if (error) throw error;

            setIsBookingOpen(false);
            toast.success("Appointment Booked Successfully!", {
                description: `Consultation with ${details.doctor.name} scheduled.`
            });
        } catch (err) {
            console.error("Booking error:", err);
            toast.error("Failed to book appointment.");
        }
    };

    return (
        <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search doctors, specialties..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-[200px]">
                    <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                        <SelectTrigger>
                            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Specialty" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Specialties</SelectItem>
                            {availableSpecialties.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Results */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : filteredDoctors.length > 0 ? (
                    filteredDoctors.map(doctor => (
                        <DoctorCard
                            key={doctor.id}
                            doctor={doctor}
                            onBook={handleBookClick}
                            onViewProfile={(doc) => {
                                setSelectedProfileDoctor(doc);
                                setIsProfileOpen(true);
                            }}
                        />
                    ))
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>No doctors found matching your criteria.</p>
                        <Button variant="link" onClick={() => { setSearchTerm(''); setSpecialtyFilter('all'); }}>Clear Filters</Button>
                    </div>
                )}
            </div>

            <BookingModal
                doctor={selectedDoctor}
                isOpen={isBookingOpen}
                onClose={() => setIsBookingOpen(false)}
                onConfirm={handleBookingConfirm}
            />

            <DoctorProfileOverlay
                doctor={selectedProfileDoctor}
                open={isProfileOpen}
                onOpenChange={setIsProfileOpen}
                onBook={(doc) => {
                    setIsProfileOpen(false);
                    handleBookClick(doc);
                }}
            />
        </div>
    );
}
