import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, MapPin, Clock, GraduationCap, Languages, Building2, Circle } from "lucide-react";
import { Doctor } from "./DoctorCard";

interface DoctorProfileOverlayProps {
    doctor: Doctor | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onBook: (doctor: Doctor) => void;
}

export default function DoctorProfileOverlay({ doctor, open, onOpenChange, onBook }: DoctorProfileOverlayProps) {
    if (!doctor) return null;

    // Mock extra details that might not be in the base Doctor type yet
    const hospital = "Lagos University Teaching Hospital";
    const experience = "12 Years";
    const languages = ["English", "Yoruba", "Pidgin"];
    const about = `Dr. ${doctor.name} is a highly skilled ${doctor.specialty} dedicated to providing comprehensive care. With a focus on patient education and preventive medicine, they strive to empower patients to take control of their health.`;

    // Mock reviews
    const reviews = [
        { id: 1, user: "Chioma A.", rating: 5, date: "2 days ago", comment: "Very patient and understanding. Listened to all my concerns." },
        { id: 2, user: "Emmanuel O.", rating: 4, date: "1 week ago", comment: "Good explanation of the treatment plan. Wait time was a bit long though." },
        { id: 3, user: "Sarah K.", rating: 5, date: "2 weeks ago", comment: "Excellent service! Highly recommended." },
    ];

    const isOnline = true; // Mock status

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0 gap-0">
                {/* Header Section */}
                <div className="p-6 border-b bg-muted/20">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="sr-only">Doctor Profile</SheetTitle>
                        <SheetDescription className="sr-only">Detailed view of {doctor.name}</SheetDescription>
                        <div className="flex gap-4 items-start">
                            <div className="relative">
                                <Avatar className="w-20 h-20 border-2 border-background shadow-sm">
                                    <AvatarImage src={doctor.imageUrl} alt={doctor.name} />
                                    <AvatarFallback>{doctor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} title={isOnline ? 'Online' : 'Offline'} />
                            </div>
                            <div className="space-y-1 flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-2xl font-bold">{doctor.name}</h2>
                                        <p className="text-primary font-medium">{doctor.specialty}</p>
                                    </div>
                                    {isOnline && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Online Now</Badge>}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Building2 className="w-4 h-4" />
                                    <span>{hospital}</span>
                                </div>
                                <div className="flex items-center gap-1 text-amber-500 text-sm font-medium mt-1">
                                    <Star className="w-4 h-4 fill-current" />
                                    <span>{doctor.rating}</span>
                                    <span className="text-muted-foreground">({doctor.reviews} Reviews)</span>
                                </div>
                            </div>
                        </div>
                    </SheetHeader>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-6 space-y-8">
                        {/* Details Section */}
                        <section className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Circle className="w-4 h-4 fill-primary text-primary" />
                                Profile Details
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="w-4 h-4" />
                                        <span>Experience</span>
                                    </div>
                                    <p className="font-medium">{experience}</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin className="w-4 h-4" />
                                        <span>Location</span>
                                    </div>
                                    <p className="font-medium">Lagos, NG</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <GraduationCap className="w-4 h-4" />
                                        <span>Education</span>
                                    </div>
                                    <p className="font-medium">MBBS, FWKP</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Languages className="w-4 h-4" />
                                        <span>Languages</span>
                                    </div>
                                    <p className="font-medium">{languages.join(", ")}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-sm text-muted-foreground">About</h4>
                                <p className="text-sm leading-relaxed">{about}</p>
                            </div>
                        </section>

                        {/* Reviews Section */}
                        <section className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Star className="w-4 h-4 fill-primary text-primary" />
                                Patient Reviews
                            </h3>
                            <div className="space-y-4">
                                {reviews.map((review) => (
                                    <div key={review.id} className="bg-muted/30 p-4 rounded-lg space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="w-8 h-8">
                                                    <AvatarFallback>{review.user[0]}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium text-sm">{review.user}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">{review.date}</span>
                                        </div>
                                        <div className="flex text-amber-500 mb-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-300'}`} />
                                            ))}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" className="w-full text-xs">View All Reviews</Button>
                        </section>
                    </div>
                </ScrollArea>

                {/* Footer / Actions */}
                <SheetFooter className="p-6 border-t bg-background mt-auto">
                    <div className="w-full flex justify-between items-center">
                        <div>
                            <p className="text-sm text-muted-foreground">Consultation Fee</p>
                            <p className="text-xl font-bold text-primary">₦{doctor.price.toLocaleString()}</p>
                        </div>
                        <Button className="w-1/2" onClick={() => onBook(doctor)}>Book Consultation</Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
