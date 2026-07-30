import { useEffect, useState } from "react";
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
import { Star, MapPin, Clock, GraduationCap, Languages, Building2, Circle, Loader2, Stethoscope } from "lucide-react";
import { Doctor } from "./DoctorCard";
import { supabase } from "@/integrations/supabase/client";

interface DoctorProfileOverlayProps {
    doctor: Doctor | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onBook: (doctor: Doctor) => void;
}

interface ReviewRow {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    reviewer_id: string;
    reviewerName?: string;
}

export default function DoctorProfileOverlay({ doctor, open, onOpenChange, onBook }: DoctorProfileOverlayProps) {
    const [reviews, setReviews] = useState<ReviewRow[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);

    useEffect(() => {
        const loadReviews = async () => {
            if (!open || !doctor?.userId) {
                setReviews([]);
                return;
            }
            setLoadingReviews(true);
            try {
                const { data, error } = await supabase
                    .from("reviews")
                    .select("id, rating, comment, created_at, reviewer_id")
                    .eq("reviewee_id", doctor.userId)
                    .order("created_at", { ascending: false })
                    .limit(5);

                if (error) throw error;

                const rows = (data || []) as ReviewRow[];
                const reviewerIds = Array.from(new Set(rows.map(r => r.reviewer_id).filter(Boolean)));
                let nameMap: Record<string, string> = {};

                if (reviewerIds.length > 0) {
                    const { data: profs } = await supabase
                        .from("profiles")
                        .select("user_id, first_name, last_name")
                        .in("user_id", reviewerIds);
                    (profs || []).forEach((p: any) => {
                        nameMap[p.user_id] = `${p.first_name || "Patient"} ${(p.last_name || "").charAt(0)}.`.trim();
                    });
                }

                setReviews(rows.map(r => ({ ...r, reviewerName: nameMap[r.reviewer_id] || "Patient" })));
            } catch (e) {
                console.error("Error loading reviews:", e);
                setReviews([]);
            } finally {
                setLoadingReviews(false);
            }
        };

        loadReviews();
    }, [open, doctor?.userId]);

    if (!doctor) return null;

    const hospital = doctor.affiliations && doctor.affiliations.length > 0 ? doctor.affiliations[0] : null;
    const about = doctor.bio;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[540px] flex flex-col p-0 gap-0">
                {/* Header Section */}
                <div className="p-6 border-b bg-muted/20">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="sr-only">Doctor Profile</SheetTitle>
                        <SheetDescription className="sr-only">Detailed view of {doctor.name}</SheetDescription>
                        <div className="flex gap-4 items-start">
                            <Avatar className="w-20 h-20 border-2 border-background shadow-sm">
                                <AvatarImage src={doctor.imageUrl} alt={doctor.name} />
                                <AvatarFallback>{doctor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                        <h2 className="text-2xl font-bold truncate">{doctor.name}</h2>
                                        <p className="text-primary font-medium">
                                            {doctor.specialty}
                                            {doctor.subSpecialty ? ` · ${doctor.subSpecialty}` : ''}
                                        </p>
                                    </div>
                                    {doctor.emergencyAvailable && (
                                        <Badge variant="outline" className="shrink-0">Emergency</Badge>
                                    )}
                                </div>
                                {hospital && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Building2 className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{hospital}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1 text-amber-500 text-sm font-medium mt-1">
                                    <Star className="w-4 h-4 fill-current" />
                                    <span>{doctor.rating || 'New'}</span>
                                    <span className="text-muted-foreground">
                                        ({reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'})
                                    </span>
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
                                    <p className="font-medium">{doctor.experience || 'Not specified'}</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin className="w-4 h-4" />
                                        <span>Location</span>
                                    </div>
                                    <p className="font-medium">{doctor.location || 'Not specified'}</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <GraduationCap className="w-4 h-4" />
                                        <span>Education</span>
                                    </div>
                                    <p className="font-medium">{doctor.education || 'Not specified'}</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Languages className="w-4 h-4" />
                                        <span>Languages</span>
                                    </div>
                                    <p className="font-medium">
                                        {doctor.languages && doctor.languages.length > 0 ? doctor.languages.join(", ") : 'Not specified'}
                                    </p>
                                </div>
                            </div>

                            {doctor.workingHours && (
                                <div className="space-y-1 text-sm">
                                    <h4 className="font-medium text-muted-foreground">Working Hours</h4>
                                    <p>{doctor.workingHours}</p>
                                    {doctor.availableDays && doctor.availableDays.length > 0 && (
                                        <p className="text-muted-foreground">{doctor.availableDays.join(', ')}</p>
                                    )}
                                </div>
                            )}

                            {about && (
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-muted-foreground">About</h4>
                                    <p className="text-sm leading-relaxed">{about}</p>
                                </div>
                            )}

                            {doctor.conditionsTreated && doctor.conditionsTreated.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                                        <Stethoscope className="w-4 h-4" /> Conditions Treated
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {doctor.conditionsTreated.map((c) => (
                                            <Badge key={c} variant="secondary">{c}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {doctor.licenseNumber && (
                                <p className="text-xs text-muted-foreground">Licence No: {doctor.licenseNumber}</p>
                            )}
                        </section>

                        {/* Reviews Section */}
                        <section className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Star className="w-4 h-4 fill-primary text-primary" />
                                Patient Reviews
                            </h3>
                            {loadingReviews ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                </div>
                            ) : reviews.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No reviews yet for this doctor.</p>
                            ) : (
                                <div className="space-y-4">
                                    {reviews.map((review) => (
                                        <div key={review.id} className="bg-muted/30 p-4 rounded-lg space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="w-8 h-8">
                                                        <AvatarFallback>{(review.reviewerName || 'P')[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium text-sm">{review.reviewerName}</span>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(review.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex text-amber-500 mb-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-muted-foreground/40'}`} />
                                                ))}
                                            </div>
                                            {review.comment && (
                                                <p className="text-sm text-muted-foreground">{review.comment}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
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
