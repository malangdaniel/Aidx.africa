import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Video, Phone, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react';
import { Doctor } from './DoctorCard';
import { supabase } from '@/integrations/supabase/client';

interface BookingModalProps {
    doctor: Doctor | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (bookingDetails: any) => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parseTime = (value: string | undefined, fallback: number) => {
    if (!value) return fallback;
    const m = value.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return fallback;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const formatSlot = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

export default function BookingModal({ doctor, isOpen, onClose, onConfirm }: BookingModalProps) {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [slots, setSlots] = useState<Date[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [consultType, setConsultType] = useState('video');
    const [step, setStep] = useState(1);

    const availableDays: string[] = doctor?.availableDays?.length ? doctor.availableDays : [];

    const isDayAvailable = useCallback((d: Date) => {
        if (!availableDays.length) return true;
        return availableDays.some(day => day.toLowerCase().startsWith(DAY_NAMES[d.getDay()].slice(0, 3).toLowerCase()));
    }, [availableDays]);

    const loadSlots = useCallback(async () => {
        if (!doctor || !date) return;
        setLoadingSlots(true);
        setSelectedSlot(null);
        try {
            const startMin = parseTime(doctor.workingHoursStart, 9 * 60);
            const endMin = parseTime(doctor.workingHoursEnd, 17 * 60);
            const step = doctor.slotDurationMinutes && doctor.slotDurationMinutes > 0 ? doctor.slotDurationMinutes : 30;

            const base = startOfDay(date);
            const now = new Date();

            const generated: Date[] = [];
            for (let m = startMin; m + step <= endMin; m += step) {
                const slot = new Date(base.getTime());
                slot.setHours(0, m, 0, 0);
                if (slot.getTime() > now.getTime()) generated.push(slot);
            }

            let booked: number[] = [];
            if (doctor.userId) {
                const y = base.getFullYear();
                const mo = String(base.getMonth() + 1).padStart(2, '0');
                const dd = String(base.getDate()).padStart(2, '0');
                const { data, error } = await supabase.rpc('get_doctor_booked_slots', {
                    _doctor_id: doctor.userId,
                    _day: `${y}-${mo}-${dd}`,
                });
                if (!error && data) {
                    booked = (data as any[])
                        .map(r => new Date(r.scheduled_at).getTime())
                        .filter(t => !Number.isNaN(t));
                }
            }

            setSlots(generated.filter(s => !booked.includes(s.getTime())));
        } finally {
            setLoadingSlots(false);
        }
    }, [doctor, date]);

    useEffect(() => {
        if (isOpen) loadSlots();
    }, [isOpen, loadSlots]);

    if (!doctor) return null;

    const handleConfirm = () => {
        onConfirm({
            doctor,
            date,
            timeSlot: selectedSlot ? formatSlot(selectedSlot) : '',
            scheduledAt: selectedSlot,
            consultType
        });
        setStep(1);
        setSelectedSlot(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Book Consultation</DialogTitle>
                    <DialogDescription>
                        with {doctor.name} - {doctor.specialty}
                    </DialogDescription>
                </DialogHeader>

                {step === 1 && (
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Select Date</Label>
                                <div className="border rounded-md p-2 flex justify-center">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        className="rounded-md"
                                        disabled={(d) => d < startOfDay(new Date()) || !isDayAvailable(d)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Select Time</Label>
                                {loadingSlots ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    </div>
                                ) : slots.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                                        {slots.map((slot) => (
                                            <Button
                                                key={slot.toISOString()}
                                                variant={selectedSlot?.getTime() === slot.getTime() ? "default" : "outline"}
                                                className="text-xs"
                                                onClick={() => setSelectedSlot(slot)}
                                            >
                                                {formatSlot(slot)}
                                            </Button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground py-4">
                                        No time slots available for this day. Please pick another date.
                                    </p>
                                )}
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
                        <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-primary" />
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
                                    <span className="font-medium text-foreground">{selectedSlot ? formatSlot(selectedSlot) : ''}</span>
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
                            disabled={!date || !selectedSlot}
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
