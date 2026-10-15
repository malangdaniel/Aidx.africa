import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Video, Phone, MessageSquare, CheckCircle2, Loader2, ShieldCheck, RefreshCw, Clock, Wallet, AlertCircle, Plus } from 'lucide-react';
import { Doctor } from './DoctorCard';
import { supabase } from '@/integrations/supabase/client';
import PaymentStatusBadge from '@/components/shared/PaymentStatusBadge';
import { isDayAvailableForDoctor, formatTime12, formatAvailableDaysList } from '@/lib/doctorAvailability';
import { WalletService } from '@/services/WalletService';
import DepositFundsModal from './DepositFundsModal';

interface BookingModalProps {
    doctor: Doctor | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (bookingDetails: any) => void;
}

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
    const [bookedCount, setBookedCount] = useState(0);
    const [dayFull, setDayFull] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [consultType, setConsultType] = useState('video');
    const [step, setStep] = useState(1);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [loadingWallet, setLoadingWallet] = useState(false);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

    const availableDays: string[] = doctor?.availableDays?.length ? doctor.availableDays : [];
    const modes = doctor?.consultationModes?.length ? doctor.consultationModes : ['video', 'audio', 'chat'];

    const fetchWallet = useCallback(async () => {
        setLoadingWallet(true);
        try {
            const w = await WalletService.getWallet();
            setWalletBalance(w ? w.balance : 0);
        } catch (e) {
            console.error("Failed to fetch wallet for booking:", e);
        } finally {
            setLoadingWallet(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchWallet();
        }
    }, [isOpen, fetchWallet]);

    useEffect(() => {
        if (!modes.includes(consultType)) setConsultType(modes[0]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doctor?.id]);

    const isDayAvailable = useCallback(
        (d: Date) => isDayAvailableForDoctor(d, availableDays),
        [availableDays]
    );

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
            if (isDayAvailable(date)) {
                for (let m = startMin; m + step <= endMin; m += step) {
                    const slot = new Date(base.getTime());
                    slot.setHours(0, m, 0, 0);
                    if (slot.getTime() > now.getTime()) generated.push(slot);
                }
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

            setBookedCount(booked.length);

            const stepMs = step * 60 * 1000;
            // Remove any slot that overlaps an existing booking (not just exact matches)
            const free = generated.filter(s => {
                const start = s.getTime();
                const end = start + stepMs;
                return !booked.some(b => b < end && b + stepMs > start);
            });

            const maxPerDay = doctor.maxConsultationsPerDay && doctor.maxConsultationsPerDay > 0
                ? doctor.maxConsultationsPerDay
                : null;
            const remaining = maxPerDay ? Math.max(0, maxPerDay - booked.length) : free.length;
            setDayFull(!!maxPerDay && remaining === 0 && free.length > 0);

            setSlots(free.slice(0, remaining));
        } finally {
            setLoadingSlots(false);
        }
    }, [doctor, date, isDayAvailable]);

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
                        <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-xs">
                            <Clock className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                            <span>
                                {doctor.name} consults {formatAvailableDaysList(doctor.availableDays)},{' '}
                                {formatTime12(doctor.workingHoursStart, '9:00 AM')} – {formatTime12(doctor.workingHoursEnd, '5:00 PM')}
                                {' '}· {doctor.slotDurationMinutes || 30} min slots. Booked times are hidden automatically.
                            </span>
                        </div>
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
                                <div className="flex items-center justify-between">
                                    <Label>Select Time</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={loadSlots}
                                        disabled={loadingSlots}
                                    >
                                        <RefreshCw className={`w-3 h-3 mr-1 ${loadingSlots ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </Button>
                                </div>
                                {loadingSlots ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    </div>
                                ) : slots.length > 0 ? (
                                    <>
                                        <p className="text-xs text-muted-foreground">
                                            {slots.length} slot{slots.length === 1 ? '' : 's'} available
                                            {bookedCount > 0 ? ` · ${bookedCount} already booked` : ''}
                                        </p>
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
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground py-4">
                                        {dayFull
                                            ? 'This doctor is fully booked for this day. Please pick another date.'
                                            : !isDayAvailable(date ?? new Date())
                                                ? 'The doctor does not consult on this day. Please pick another date.'
                                                : 'No time slots left for this day. Please pick another date.'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Consultation Type</Label>
                            <Tabs value={consultType} onValueChange={setConsultType} className="w-full">
                                <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}>
                                    {modes.includes('video') && (
                                        <TabsTrigger value="video">
                                            <Video className="w-4 h-4 mr-2" />
                                            Video
                                        </TabsTrigger>
                                    )}
                                    {modes.includes('audio') && (
                                        <TabsTrigger value="audio">
                                            <Phone className="w-4 h-4 mr-2" />
                                            Audio
                                        </TabsTrigger>
                                    )}
                                    {modes.includes('chat') && (
                                        <TabsTrigger value="chat">
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            Chat
                                        </TabsTrigger>
                                    )}
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
                                <div className="flex justify-between items-center">
                                    <span>Payment Source:</span>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                        <Wallet className="w-3.5 h-3.5" />
                                        <span>Patient Wallet</span>
                                    </div>
                                </div>
                                <div className="border-t pt-2 mt-2 space-y-1.5">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Your Wallet Balance:</span>
                                        <span className="font-semibold text-foreground">
                                            {loadingWallet ? 'Checking...' : `₦${(walletBalance ?? 0).toLocaleString()}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between font-bold text-sm">
                                        <span>Consultation Fee:</span>
                                        <span className="text-primary">₦{doctor.price.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Insufficient Funds Warning */}
                            {walletBalance !== null && walletBalance < doctor.price && (
                                <div className="mt-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-left text-xs space-y-2">
                                    <div className="flex items-start gap-2 text-destructive font-semibold">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>Insufficient Wallet Balance</span>
                                    </div>
                                    <p className="text-muted-foreground text-[11px]">
                                        You need an additional ₦{(doctor.price - walletBalance).toLocaleString()} in your patient wallet to book this session.
                                    </p>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="default"
                                        onClick={() => setIsDepositModalOpen(true)}
                                        className="w-full text-xs gap-1.5 font-semibold"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Funds to Wallet
                                    </Button>
                                </div>
                            )}

                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-left text-xs">
                                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                                <span>
                                    Your slot is confirmed once payment is escrowed. Funds stay securely in escrow
                                    and are only released to the doctor after the consultation is completed.
                                </span>
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
                            <Button
                                className="flex-1 gap-1.5"
                                onClick={handleConfirm}
                                disabled={walletBalance !== null && walletBalance < doctor.price}
                            >
                                <ShieldCheck className="w-4 h-4" />
                                Confirm & Escrow
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>

            <DepositFundsModal
                isOpen={isDepositModalOpen}
                onClose={() => setIsDepositModalOpen(false)}
                onDepositSuccess={fetchWallet}
                initialAmount={Math.max(500, doctor.price - (walletBalance || 0))}
            />
        </Dialog>
    );
}
