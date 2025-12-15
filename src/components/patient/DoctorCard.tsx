import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, Video, MapPin, Clock } from 'lucide-react';

export interface Doctor {
    id: string;
    name: string;
    specialty: string;
    rating: number;
    reviews: number;
    imageUrl?: string;
    nextAvailable: string;
    price: number;
}

interface DoctorCardProps {
    doctor: Doctor;
    onBook: (doctor: Doctor) => void;
    onViewProfile: (doctor: Doctor) => void;
}

export default function DoctorCard({ doctor, onBook, onViewProfile }: DoctorCardProps) {
    return (
        <Card
            className="overflow-hidden flex flex-col md:flex-row cursor-pointer transition-colors hover:border-primary/50 group"
            onClick={() => onViewProfile(doctor)}
        >
            <div className="p-6 md:w-1/4 flex flex-col items-center justify-center bg-muted/30 group-hover:bg-muted/50 transition-colors">
                <Avatar className="w-24 h-24 mb-3">
                    <AvatarImage src={doctor.imageUrl} alt={doctor.name} />
                    <AvatarFallback className="text-xl">{doctor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="text-center">
                    <Badge variant="secondary" className="mb-2">{doctor.specialty}</Badge>
                    <div className="flex items-center justify-center gap-1 text-amber-500 font-medium">
                        <Star className="w-4 h-4 fill-current" />
                        <span>{doctor.rating}</span>
                        <span className="text-muted-foreground text-sm">({doctor.reviews})</span>
                    </div>
                </div>
            </div>

            <div className="p-6 md:w-3/4 flex flex-col justify-between">
                <div>
                    <h3 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors">{doctor.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>Lagos, NG</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Video className="w-4 h-4" />
                            <span>Video Consult</span>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        Experienced {doctor.specialty} with over 10 years of practice. Dedicated to providing patient-centered care and accurate diagnosis.
                    </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Next Available</span>
                        <div className="flex items-center gap-1 font-medium text-green-700">
                            <Clock className="w-4 h-4" />
                            <span>{doctor.nextAvailable}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-lg font-bold">₦{doctor.price.toLocaleString()}</div>
                            <span className="text-xs text-muted-foreground">per session</span>
                        </div>
                        <Button
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent opening profile
                                onBook(doctor);
                            }}
                        >
                            Book Consult
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
