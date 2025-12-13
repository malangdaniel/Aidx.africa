import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Video, Phone, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Doctor } from './DoctorCard';

interface BookingModalProps {
    doctor: Doctor | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (bookingDetails: any) => void;
}

export default function BookingModal({ doctor, isOpen, onClose, onConfirm }: BookingModalProps) {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [timeSlot, setTimeSlot] = useState<string>('');
    const [consultType, setConsultType] = useState('video');
    const [step, setStep] = useState(1);

    if (!doctor) return null;

    const timeSlots = [
        '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
        '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM'
    ];

    const handleConfirm = () => {
        onConfirm({
            doctor,
            date,
            timeSlot,
            consultType
        });
        setStep(1); // Reset
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Book Consultation</DialogTitle>
                    <DialogDescription>
                        with {doctor.name} - {doctor.specialty}
                    </DialogDescription>
                </DialogHeader>

                {step === 1 && (
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Select Date</Label>
                                <div className="border rounded-md p-2 flex justify-center">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        className="rounded-md"
                                        disabled={(date) => date < new Date()}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Select Time</Label>
                                <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                                    {timeSlots.map((slot) => (
                                        <Button
                                            key={slot}
                                            variant={timeSlot === slot ? "default" : "outline"}
                                            className="text-xs"
                                            onClick={() => setTimeSlot(slot)}
                                        >
                                            {slot}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Consultation Type</Label>
                            <Tabs value={consultType} onValueChange={setConsultType} className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="video">
                                        <Video className="w-4 h-4 mr-2" />
                                        Video
                                    </TabsTrigger>
                                    <TabsTrigger value="audio">
                                        <Phone className="w-4 h-4 mr-2" />
                                        Audio
                                    </TabsTrigger>
                                    <TabsTrigger value="chat">
                                        <MessageSquare className="w-4 h-4 mr-2" />
                                        Chat
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="py-6 flex flex-col items-center text-center space-y-4">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold">Confirm Booking</h3>
                        <div className="text-sm text-muted-foreground max-w-xs">
                            <p>Review your appointment details before confirming.</p>
                            <div className="mt-4 bg-muted p-4 rounded-lg text-left space-y-2">
                                <div className="flex justify-between">
                                    <span>Doctor:</span>
                                    <span className="font-medium text-foreground">{doctor.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Date:</span>
                                    <span className="font-medium text-foreground">{date?.toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Time:</span>
                                    <span className="font-medium text-foreground">{timeSlot}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Type:</span>
                                    <span className="font-medium text-foreground capitalize">{consultType}</span>
                                </div>
                                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                                    <span>Total:</span>
                                    <span>₦{doctor.price.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 1 ? (
                        <Button
                            onClick={() => setStep(2)}
                            disabled={!date || !timeSlot}
                            className="w-full"
                        >
                            Continue to Payment
                        </Button>
                    ) : (
                        <div className="flex w-full gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                            <Button className="flex-1" onClick={handleConfirm}>Confirm & Pay</Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
