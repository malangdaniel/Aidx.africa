import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';
import DoctorCard, { Doctor } from './DoctorCard';
import BookingModal from './BookingModal';
import { toast } from 'sonner';

interface DoctorSearchProps {
    initialSpecialty?: string;
}

// Mock Data
const MOCK_DOCTORS: Doctor[] = [
    {
        id: '1',
        name: 'Dr. Sarah Okon',
        specialty: 'Cardiologist',
        rating: 4.9,
        reviews: 124,
        nextAvailable: 'Today, 2:00 PM',
        price: 15000,
        imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2070&auto=format&fit=crop'
    },
    {
        id: '2',
        name: 'Dr. James Okafor',
        specialty: 'General Practitioner',
        rating: 4.7,
        reviews: 89,
        nextAvailable: 'Tomorrow, 9:00 AM',
        price: 5000,
        imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=2070&auto=format&fit=crop'
    },
    {
        id: '3',
        name: 'Dr. Emily Walsh',
        specialty: 'Dermatologist',
        rating: 4.8,
        reviews: 210,
        nextAvailable: 'Today, 4:00 PM',
        price: 12000,
        imageUrl: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?q=80&w=2070&auto=format&fit=crop'
    },
    {
        id: '4',
        name: 'Dr. Michael Chen',
        specialty: 'Neurologist',
        rating: 5.0,
        reviews: 56,
        nextAvailable: 'Wed, 10:00 AM',
        price: 20000,
        imageUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80&w=2070&auto=format&fit=crop'
    },
    {
        id: '5',
        name: 'Dr. Amara Diop',
        specialty: 'Gastroenterologist',
        rating: 4.8,
        reviews: 95,
        nextAvailable: 'Thu, 11:30 AM',
        price: 18000,
        imageUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=2064&auto=format&fit=crop'
    }
];

export default function DoctorSearch({ initialSpecialty }: DoctorSearchProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState(initialSpecialty || 'all');
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    useEffect(() => {
        if (initialSpecialty) {
            setSpecialtyFilter(initialSpecialty);
        }
    }, [initialSpecialty]);

    const filteredDoctors = MOCK_DOCTORS.filter(doc => {
        const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.specialty.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSpecialty = specialtyFilter === 'all' || doc.specialty === specialtyFilter;

        return matchesSearch && matchesSpecialty;
    });

    const handleBookClick = (doctor: Doctor) => {
        setSelectedDoctor(doctor);
        setIsBookingOpen(true);
    };

    const handleBookingConfirm = (details: any) => {
        console.log('Booking Confirmed:', details);
        setIsBookingOpen(false);
        toast.success("Appointment Booked Successfully!", {
            description: `Consultation with ${details.doctor.name} scheduled for ${details.timeSlot}`
        });
    };

    const specialties = Array.from(new Set(MOCK_DOCTORS.map(d => d.specialty)));

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
                            {specialties.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Results */}
            <div className="grid gap-4">
                {filteredDoctors.length > 0 ? (
                    filteredDoctors.map(doctor => (
                        <DoctorCard
                            key={doctor.id}
                            doctor={doctor}
                            onBook={handleBookClick}
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
        </div>
    );
}
