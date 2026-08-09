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
import { ConsultationService } from '@/services/ConsultationService';
import { computeRealNextAvailable } from '@/lib/doctorAvailability';

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
                    license_number,

                    user_id,
                    profiles:user_id (
                        first_name,
                        last_name,
                        metadata
                    )
                `);

            if (error) throw error;

            const mappedDoctors: Doctor[] = data.map((d: any) => {
                const meta = d.profiles?.metadata || {};
                const dp = meta.doctorProfile || {};
                const basic = dp.basicInfo || {};
                const creds = dp.credentials || {};
                const expertise = dp.expertise || {};
                const avail = dp.availability || {};

                const title = basic.professionalTitle || 'Dr.';
                const location = [basic.city, basic.country].filter(Boolean).join(', ');
                const education = [creds.primaryDegree, ...(creds.postgraduateQualifications || [])]
                    .filter(Boolean).join(', ');

                const startHours = avail.workingHoursStart || '09:00';
                const endHours = avail.workingHoursEnd || '17:00';
                const rawDays = avail.availableDays && avail.availableDays.length > 0
                    ? avail.availableDays
                    : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

                return {
                    id: d.id, // This is the doctor table ID
                    userId: d.user_id, // Auth user id
                    name: `${title} ${d.profiles?.first_name || 'Unknown'} ${d.profiles?.last_name || ''}`.trim(),
                    specialty: creds.specialty || (d.specialties && d.specialties.length > 0 ? d.specialties[0] : 'General Practitioner'),
                    subSpecialty: creds.subSpecialty || undefined,
                    rating: Number(d.rating) || 0,
                    reviews: d.total_consultations || 0,
                    nextAvailable: computeRealNextAvailable(rawDays, startHours, endHours),
                    price: Number(avail.consultPrice) || Number(d.consult_price) || 0,
                    imageUrl: basic.profilePhoto || meta.avatar_url || undefined,
                    bio: d.bio || undefined,
                    location: location || undefined,
                    languages: basic.languages || [],
                    experience: creds.yearsExperience ? `${creds.yearsExperience} Years` : undefined,
                    education: education || undefined,
                    affiliations: creds.currentAffiliations || [],
                    conditionsTreated: expertise.conditionsTreated || [],
                    consultationModes: avail.consultationModes && avail.consultationModes.length > 0 ? avail.consultationModes : ['video', 'chat', 'audio'],
                    licenseNumber: d.license_number || basic.registrationNumber || undefined,
                    availableDays: rawDays,
                    workingHours: `${startHours} - ${endHours}${avail.timezone ? ` (${avail.timezone})` : ''}`,
                    workingHoursStart: startHours,
                    workingHoursEnd: endHours,
                    maxConsultationsPerDay: Number(avail.maxConsultationsPerDay) || undefined,
                    slotDurationMinutes: Number(avail.slotDurationMinutes) || Number(avail.consultDuration) || 30,
                    emergencyAvailable: !!avail.emergencyAvailable,
                };
            });


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
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast.error("You must be logged in to book an appointment");
                return;
            }

            const scheduledAt: Date = details.scheduledAt
                ? new Date(details.scheduledAt)
                : new Date(`${details.date.toDateString()} ${details.timeSlot}`);

            if (scheduledAt.getTime() <= Date.now()) {
                toast.error("That time slot has already passed. Please pick another.");
                return;
            }

            await ConsultationService.bookConsultation(
                details.doctor.userId,
                user.id,
                scheduledAt,
                details.doctor.price,
                `Initial consultation booking (${details.consultType})`
            );

            setIsBookingOpen(false);
            toast.success("Appointment Booked Successfully!", {
                description: `Consultation with ${details.doctor.name} scheduled for ${scheduledAt.toLocaleString()}.`
            });
        } catch (err: any) {
            console.error("Booking error:", err);
            if (err?.code === '23505') {
                toast.error("That time slot was just booked by someone else. Please choose another.");
            } else {
                toast.error("Failed to book appointment.");
            }
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
