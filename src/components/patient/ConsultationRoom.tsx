import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Video, VideoOff, Mic, MicOff, PhoneOff, Send,
    MessageSquare, User, Bot, Loader2, ArrowLeft,
    CheckCircle2, Clock, Activity, ShieldCheck,
    Languages, Award, Thermometer, Heart,
    Eye, Upload, AlertTriangle, FileDown,
    Star, ShoppingCart, HelpCircle, AlertOctagon,
    Calendar, Wallet
} from 'lucide-react';
import { toast } from 'sonner';

interface Message {
    id: string;
    role: 'patient' | 'doctor';
    content: string;
    timestamp: Date;
}

interface Instruction {
    id: string;
    text: string;
    isKeyAdvice: boolean;
}

interface ConsultationRoomProps {
    consultation: any;
    onEnd: () => void;
    onPharmacyRedirect?: () => void;
}

export default function ConsultationRoom({ consultation, onEnd, onPharmacyRedirect }: ConsultationRoomProps) {
    if (!consultation) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
                <AlertTriangle className="w-12 h-12 text-yellow-500" />
                <h3 className="text-xl font-bold">Consultation not found</h3>
                <Button onClick={onEnd}>Go Back</Button>
            </div>
        );
    }

    const [status, setStatus] = useState<'waiting' | 'connected' | 'ended'>('waiting');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [duration, setDuration] = useState(0);
    const [rating, setRating] = useState(0);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [instructions, setInstructions] = useState<Instruction[]>([
        { id: '1', text: 'Rest as much as possible for the next 48 hours.', isKeyAdvice: true },
        { id: '2', text: 'Drink at least 3 liters of water daily.', isKeyAdvice: false }
    ]);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    const doctorName = `Dr. ${consultation.doctor_profile?.first_name || 'Medical'} ${consultation.doctor_profile?.last_name || 'Specialist'}`;

    // Camera Access Logic
    useEffect(() => {
        if (status === 'connected' && !localStream) {
            startCamera();
        }
        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [status]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setLocalStream(stream);
        } catch (err) {
            console.error("Error accessing media devices:", err);
            toast.error("Could not access camera or microphone. Please check permissions.");
        }
    };

    // Callback ref for reliable stream attachment
    const localVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
        if (el && localStream) {
            el.srcObject = localStream;
            el.play().catch(e => console.error("Error playing video:", e));
        }
        localVideoRef.current = el;
    }, [localStream]);

    const toggleMute = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    // Timer logic
    useEffect(() => {
        let interval: any;
        if (status === 'connected') {
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [status]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Simulate doctor joining
    useEffect(() => {
        if (status === 'waiting') {
            const timer = setTimeout(() => {
                setStatus('connected');
                toast.success(`${doctorName} has joined the call.`);
                setMessages([{
                    id: '1',
                    role: 'doctor',
                    content: `Hello, I'm ${doctorName}. I've reviewed your symptoms. How are you feeling right now?`,
                    timestamp: new Date()
                }]);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [status, doctorName]);

    const handleSendMessage = () => {
        if (!inputText.trim()) return;
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'patient',
            content: inputText,
            timestamp: new Date()
        }]);
        setInputText('');
    };

    if (status === 'waiting') {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] space-y-8 animate-in fade-in duration-500">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20">
                        <Loader2 className="w-10 h-10 animate-spin" />
                    </div>
                </div>
                <div className="text-center space-y-3">
                    <h2 className="text-2xl font-bold">Virtual Waiting Room</h2>
                    <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                        Please stay on this screen. <span className="font-semibold text-foreground">{doctorName}</span> is reviewing your medical history.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                    <Card className="p-4 text-center space-y-1 bg-muted/50 border-none shadow-none">
                        <Clock className="w-4 h-4 mx-auto text-primary" />
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Estimated wait</p>
                        <p className="text-lg font-bold">~ 2 mins</p>
                    </Card>
                    <Card className="p-4 text-center space-y-1 bg-muted/50 border-none shadow-none">
                        <Activity className="w-4 h-4 mx-auto text-primary" />
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Queue Position</p>
                        <p className="text-lg font-bold"># 1</p>
                    </Card>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                    <p className="text-[10px] text-center text-muted-foreground bg-yellow-50 text-yellow-700 py-1.5 px-3 rounded-full border border-yellow-200 flex items-center justify-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" />
                        Ensure your microphone & camera are enabled
                    </p>
                    <Button variant="ghost" onClick={onEnd} className="text-muted-foreground hover:text-destructive text-xs h-8">
                        Leave Waiting Room
                    </Button>
                </div>
            </div>
        );
    }

    if (status === 'ended') {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom duration-500">
                <Card className="overflow-hidden border-2 border-primary/20 shadow-xl">
                    <div className="bg-primary/5 p-8 text-center space-y-4 border-b">
                        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto ring-4 ring-green-50">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold">Consultation Summary</h2>
                            <p className="text-muted-foreground">Session with {doctorName} • {formatTime(duration)} duration</p>
                        </div>
                    </div>

                    <CardContent className="p-8 space-y-8">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Diagnosis Summary</h3>
                                <div className="p-4 rounded-xl bg-muted/30 border border-muted-foreground/10">
                                    <p className="font-semibold text-lg">Acute Viral Rhinopharyngitis</p>
                                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                        Symptoms indicate a standard common cold. Inflammation of the nasal passages and throat.
                                        Viral origin, no antibiotics required. Focus on symptomatic relief and hydration.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Prescribed Drugs</h3>
                                <div className="space-y-2">
                                    {[
                                        { name: 'Panadol Advance', dose: '2 tablets every 6 hours', day: '3 Days' },
                                        { name: 'Ascoril Syrup', dose: '10ml three times daily', day: '5 Days' }
                                    ].map((drug, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-background group hover:border-primary transition-colors">
                                            <div>
                                                <p className="font-bold text-sm">{drug.name}</p>
                                                <p className="text-xs text-muted-foreground">{drug.dose} • {drug.day}</p>
                                            </div>
                                            <Button size="icon" variant="ghost" className="text-primary group-hover:bg-primary group-hover:text-primary-foreground" onClick={onPharmacyRedirect}>
                                                <ShoppingCart className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase">Lab Tests</h4>
                                <Badge variant="secondary" className="w-full justify-start py-2 px-3 gap-2">
                                    <AlertTriangle className="w-3 h-3" />
                                    None Requested
                                </Badge>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase">Follow-up</h4>
                                <p className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    Feb 12, 2026 (1 week)
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase">Report</h4>
                                <Button variant="outline" size="sm" className="w-full gap-2 h-9">
                                    <FileDown className="w-4 h-4" />
                                    Download PDF
                                </Button>
                            </div>
                        </div>

                        <div className="bg-primary/5 p-6 rounded-2xl flex flex-col items-center space-y-4 border border-primary/10">
                            <h3 className="font-bold">How was your session?</h3>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setRating(star)}
                                        className={`p-1 transition-transform hover:scale-110 ${rating >= star ? 'text-yellow-400' : 'text-neutral-300'}`}
                                    >
                                        <Star className={`w-8 h-8 ${rating >= star ? 'fill-current' : ''}`} />
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground italic">Your feedback helps improve our healthcare services</p>
                        </div>
                    </CardContent>

                    <CardFooter className="bg-muted/30 p-4 border-t flex justify-center">
                        <Button onClick={onEnd} variant="link" className="text-muted-foreground hover:text-primary transition-colors">
                            Close & Exit Dashboard
                        </Button>
                    </CardFooter>
                </Card>

                <div className="bg-red-50 p-4 rounded-xl border border-red-200 flex items-start gap-3">
                    <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-900">Emergency Warning</p>
                        <p className="text-xs text-red-700">If your symptoms worsen or you experience difficulty breathing, chest pain, or high fever, please seek urgent medical care immediately.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[800px] gap-4 animate-in fade-in duration-700">
            {/* Header / Session Stats */}
            <div className="flex items-center justify-between bg-background p-1.5 rounded-2xl border px-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Activity className="w-3.5 h-3.5 text-green-500" />
                        HD Call Connected
                    </div>
                    <Separator orientation="vertical" className="h-4 hidden sm:block" />
                    <Badge variant="outline" className="font-mono text-[11px] px-2 py-0 border-primary/20 text-primary">
                        {formatTime(duration)}
                    </Badge>
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] hidden md:flex gap-1.5 py-1 px-3">
                        <Wallet className="w-3 h-3" />
                        Payment Verified (₦15,000)
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-red-600 hover:bg-red-50" onClick={() => setStatus('ended')}>
                        <PhoneOff className="w-3.5 h-3.5" />
                        End Session
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">

                {/* Left Panel: Health Summary */}
                <div className="hidden lg:flex flex-col w-72 gap-4">
                    <Card className="flex-1 overflow-hidden flex flex-col shadow-none border-muted-foreground/10">
                        <CardHeader className="p-4 bg-muted/20 border-b pb-3">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Health Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-hidden flex flex-col flex-1">
                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Reason for Visit</p>
                                        <Input defaultValue="Dry cough and mild fever" className="text-xs h-8 bg-muted/30 border-none shadow-none focus-visible:ring-primary/20" />
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Live Vitals</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2 rounded-lg bg-red-50 flex flex-col items-center">
                                                <Heart className="w-3.5 h-3.5 text-red-500" />
                                                <p className="text-xs font-bold mt-1">78 BPM</p>
                                            </div>
                                            <div className="p-2 rounded-lg bg-blue-50 flex flex-col items-center">
                                                <Thermometer className="w-3.5 h-3.5 text-blue-500" />
                                                <p className="text-xs font-bold mt-1">36.8°C</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Medical Profile</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Allergies:</span>
                                                <Badge variant="outline" className="text-[10px] border-red-200 text-red-700 bg-red-50">Lactose</Badge>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Meds:</span>
                                                <span className="font-medium">None</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">History:</span>
                                                <span className="font-medium">Asthma (Childhood)</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t space-y-4">
                                        <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                                            <h4 className="text-[10px] font-bold text-primary uppercase mb-2">Live Guidance</h4>
                                            <div className="space-y-2">
                                                {instructions.map(inst => (
                                                    <div key={inst.id} className="flex gap-2">
                                                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${inst.isKeyAdvice ? 'text-primary' : 'text-muted-foreground/30'}`} />
                                                        <p className={`text-[11px] leading-tight ${inst.isKeyAdvice ? 'font-bold' : ''}`}>{inst.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </CardContent>
                        <CardFooter className="p-3 bg-muted/5 border-t">
                            <Button variant="ghost" size="sm" className="w-full text-xs gap-2 text-muted-foreground">
                                <HelpCircle className="w-3.5 h-3.5" />
                                Support
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col gap-4">
                    {/* Video Feed */}
                    <div className="relative flex-1 bg-neutral-900 rounded-3xl overflow-hidden border border-border group shadow-2xl shadow-primary/5">
                        {/* Doctor Content */}
                        {!isVideoOff ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-white space-y-6 animate-in zoom-in-95 duration-700">
                                <img
                                    src={consultation.doctor_profile?.metadata?.avatar_url || "https://i.pravatar.cc/400?u=doc"}
                                    className="w-44 h-44 rounded-full border-8 border-primary/20 object-cover shadow-2xl"
                                    alt="Doctor"
                                />
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <h2 className="text-2xl font-bold">{doctorName}</h2>
                                        <ShieldCheck className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <p className="text-sm text-white/50">{consultation.doctor_profile?.specialties?.[0] || 'Medical Specialist'}</p>
                                    <Badge className="bg-green-500 scale-90">Live Feed</Badge>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full bg-neutral-800 flex flex-col items-center justify-center text-neutral-400 space-y-4">
                                <div className="w-20 h-20 rounded-full bg-neutral-700 flex items-center justify-center">
                                    <VideoOff className="w-10 h-10" />
                                </div>
                                <p className="text-sm italic">Video connection paused</p>
                            </div>
                        )}

                        {/* Patient Thumbnail */}
                        <div className="absolute top-6 left-6 w-32 h-44 bg-neutral-800 rounded-2xl border-2 border-white/20 shadow-2xl overflow-hidden backdrop-blur-md">
                            {localStream && !isVideoOff ? (
                                <video
                                    ref={localVideoCallbackRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-full object-cover mirror"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/50 bg-gradient-to-br from-neutral-700 to-neutral-800">
                                    <User className="w-8 h-8" />
                                    <p className="text-[10px] mt-2 font-medium">{isVideoOff ? 'Camera Off' : 'Connecting...'}</p>
                                </div>
                            )}
                        </div>

                        {/* Main Call Controls Overlay */}
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 bg-black/30 backdrop-blur-xl rounded-full border border-white/10 opacity-60 hover:opacity-100 transition-all scale-90 hover:scale-100">
                            <Button
                                variant={isMuted ? "destructive" : "secondary"}
                                size="icon"
                                className="rounded-full w-12 h-12 shadow-inner"
                                onClick={toggleMute}
                            >
                                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full w-11 h-11 bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setStatus('ended')}>
                                <PhoneOff className="w-5 h-5 rotate-[135deg]" />
                            </Button>
                            <Button
                                variant={isVideoOff ? "destructive" : "secondary"}
                                size="icon"
                                className="rounded-full w-12 h-12 shadow-inner"
                                onClick={toggleVideo}
                            >
                                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                            </Button>
                        </div>

                    </div>
                </div>

                {/* Right Panel: Doctor & Chat */}
                <div className="flex flex-col w-full lg:w-80 gap-4">
                    {/* Doctor Info Card */}
                    <Card className="border-muted-foreground/10 overflow-hidden shadow-none">
                        <CardHeader className="p-4 bg-muted/20 border-b pb-3">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Certified Provider</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 py-3 space-y-3">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] gap-1 px-2 border-primary/30">
                                        <Award className="w-3 h-3 text-primary" />
                                        Lic: MD-129302
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] gap-1 px-2">
                                        <Languages className="w-3 h-3 text-primary" />
                                        English, Yoruba
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Over <span className="text-foreground font-bold italic">12 years</span> of experience in clinical medicine and emergency care.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Chat Area */}
                    <Card className="flex flex-col flex-1 overflow-hidden border-muted-foreground/10 shadow-none bg-muted/10">
                        <CardContent className="flex-1 p-0 overflow-hidden">
                            <ScrollArea ref={scrollAreaRef} className="h-full p-4">
                                <div className="space-y-4">
                                    {messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.role === 'patient' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'patient' ? 'items-end' : 'items-start'}`}>
                                                <div
                                                    className={`rounded-2xl px-3 py-2 text-[13px] ${msg.role === 'patient'
                                                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                        : 'bg-background border rounded-tl-none'
                                                        }`}
                                                >
                                                    {msg.content}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>

                        <CardFooter className="p-3 bg-background border-t">
                            <form
                                className="flex w-full gap-2"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSendMessage();
                                }}
                            >
                                <Input
                                    placeholder="Ask a question..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    className="h-9 text-xs bg-muted/30 border-none shadow-none"
                                />
                                <Button type="submit" size="icon" className="h-9 w-9 shrink-0 shadow-sm" disabled={!inputText.trim()}>
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
