import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Video, VideoOff, Mic, MicOff, PhoneOff, Send,
    User, Loader2, ArrowLeft,
    CheckCircle2, Clock, Activity, ShieldCheck,
    Thermometer, Heart,
    Upload, AlertTriangle, FileDown,
    Star, ShoppingCart, AlertOctagon,
    Calendar, Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ],
};

interface Message {
    id: string;
    role: 'patient' | 'doctor';
    content: string;
    timestamp: Date;
}

interface ConsultationRoomProps {
    consultation: any;
    onEnd: () => void;
    onPharmacyRedirect?: () => void;
}

export default function ConsultationRoom({ consultation, onEnd, onPharmacyRedirect }: ConsultationRoomProps) {
    const [status, setStatus] = useState<'waiting' | 'connected' | 'ended'>('waiting');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [duration, setDuration] = useState(0);
    const [rating, setRating] = useState(0);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [summaryData, setSummaryData] = useState<{
        diagnosis: string | null;
        notes: string | null;
        prescriptions: any[];
    } | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);
    const callChannelRef = useRef<any>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const doctorName = `Dr. ${consultation.doctor_profile?.first_name || 'Medical'} ${consultation.doctor_profile?.last_name || 'Specialist'}`;

    // --- Supabase Realtime: Presence + Chat ---
    useEffect(() => {
        const channel = supabase.channel(`consultation:${consultation.id}`, {
            config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        channel
            .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
                if (payload.role === 'doctor') {
                    setMessages(prev => [...prev, {
                        id: payload.id || Date.now().toString(),
                        role: 'doctor',
                        content: payload.content,
                        timestamp: new Date(payload.timestamp),
                    }]);
                }
            })
            .on('broadcast', { event: 'doctor_joined' }, () => {
                setStatus('connected');
                toast.success(`${doctorName} has joined the call.`);
            })
            .on('broadcast', { event: 'consultation_ended' }, () => {
                toast.info('The doctor has ended the consultation.');
                handleConsultationEnded();
            })
            .subscribe(async (subStatus) => {
                if (subStatus === 'SUBSCRIBED') {
                    // Announce patient presence
                    channel.send({
                        type: 'broadcast',
                        event: 'patient_joined',
                        payload: { userId: (await supabase.auth.getUser()).data.user?.id },
                    });
                }
            });

        // Update consultation status to 'ongoing'
        supabase
            .from('consultations')
            .update({ status: 'ongoing', started_at: new Date().toISOString() })
            .eq('id', consultation.id)
            .eq('status', 'scheduled')
            .then(({ error }) => {
                if (error) console.error('Error updating consultation status:', error);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [consultation.id]);

    // Check if doctor is already in the consultation (status = ongoing)
    useEffect(() => {
        const checkStatus = async () => {
            const { data } = await supabase
                .from('consultations')
                .select('status')
                .eq('id', consultation.id)
                .single();

            if (data?.status === 'ongoing') {
                setStatus('connected');
            }
        };
        checkStatus();
    }, [consultation.id]);

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
            toast.error("Could not access camera or microphone. Please check permissions.");
        }
    };

    // --- WebRTC Logic ---
    const initializePeerConnection = (stream: MediaStream) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
            const [remote] = event.streams;
            setRemoteStream(remote);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remote;
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({ type: 'candidate', candidate: event.candidate });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected') {
                toast.info("Video call disconnected");
            }
        };
    };

    const initializeCallSignaling = () => {
        const channel = supabase.channel(`call:${consultation.id}`);
        callChannelRef.current = channel;

        channel
            .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                // Ignore own messages? We need userId to filter properly.
                // Assuming payload includes senderId.
                const { data: { user } } = await supabase.auth.getUser();
                if (payload.userId === user?.id) return;

                try {
                    const pc = peerConnectionRef.current;
                    if (!pc && payload.type !== 'ready') return;

                    // If we get a signal but have no PC, we might need to lazy init?
                    // But we likely init PC with local stream. 
                    // If stream isn't ready, we can't add tracks yet.

                    if (payload.type === 'offer') {
                        if (!pc) return; // Should refrain until stream ready
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        sendSignal({ type: 'answer', answer });
                    } else if (payload.type === 'answer') {
                        if (!pc) return;
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                    } else if (payload.type === 'candidate') {
                        if (!pc) return;
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    } else if (payload.type === 'ready') {
                        // Peer is ready, create offer
                        createOffer();
                    }
                } catch (err) {
                    console.error('Signaling error:', err);
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Announce presence 
                    sendSignal({ type: 'ready' });
                }
            });
    };

    const createOffer = async () => {
        const pc = peerConnectionRef.current;
        if (!pc) return;
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({ type: 'offer', offer });
        } catch (err) {
            console.error("Error creating offer", err);
        }
    };

    const sendSignal = async (payload: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        callChannelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { ...payload, userId: user?.id },
        });
    };

    useEffect(() => {
        if (status === 'connected' && localStream && !peerConnectionRef.current) {
            initializePeerConnection(localStream);
            initializeCallSignaling();
        }
        return () => {
            // cleanup handled in handleEndCall or unmount
        };
    }, [status, localStream]); // waiting for stream


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

    // Auto-scroll chat
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    // Timer
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

    // Send chat message via Realtime broadcast
    const handleSendMessage = async () => {
        if (!inputText.trim()) return;
        const msg: Message = {
            id: Date.now().toString(),
            role: 'patient',
            content: inputText,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, msg]);

        channelRef.current?.send({
            type: 'broadcast',
            event: 'chat_message',
            payload: {
                id: msg.id,
                role: 'patient',
                content: msg.content,
                timestamp: msg.timestamp.toISOString(),
            },
        });

        setInputText('');
    };

    // Fetch real summary data when consultation ends
    const handleConsultationEnded = async () => {
        setSummaryLoading(true);
        try {
            // Fetch updated consultation data (diagnosis, notes)
            const { data: consultData } = await supabase
                .from('consultations')
                .select('diagnosis, notes, ended_at')
                .eq('id', consultation.id)
                .single();

            // Fetch prescriptions
            const { data: rxData } = await supabase
                .from('prescriptions')
                .select('prescription_data, notes')
                .eq('consultation_id', consultation.id);

            const prescriptions = (rxData || []).flatMap((rx: any) => {
                const meds = rx.prescription_data?.medications || [];
                return meds;
            });

            setSummaryData({
                diagnosis: consultData?.diagnosis || null,
                notes: consultData?.notes || null,
                prescriptions,
            });
        } catch (err) {
            console.error('Error fetching consultation summary:', err);
        } finally {
            setSummaryLoading(false);
            setStatus('ended');
        }
    };

    // End call from patient side
    const handleEndCall = async () => {
        // Stop media
        localStream?.getTracks().forEach(track => track.stop());
        peerConnectionRef.current?.close();

        // Notify doctor
        channelRef.current?.send({
            type: 'broadcast',
            event: 'patient_left',
            payload: {},
        });

        if (callChannelRef.current) supabase.removeChannel(callChannelRef.current);

        await handleConsultationEnded();
    };

    // Submit rating
    const handleSubmitRating = async () => {
        if (rating === 0) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase.from('reviews').insert({
                reviewer_id: user.id,
                reviewee_id: consultation.doctor_id,
                consultation_id: consultation.id,
                rating,
                comment: null,
            });
            toast.success('Thank you for your feedback!');
        } catch (err) {
            console.error('Error submitting review:', err);
            toast.error('Could not submit rating.');
        }
    };

    // --- NULL GUARD ---
    if (!consultation) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
                <AlertTriangle className="w-12 h-12 text-yellow-500" />
                <h3 className="text-xl font-bold">Consultation not found</h3>
                <Button onClick={onEnd}>Go Back</Button>
            </div>
        );
    }

    // --- WAITING SCREEN ---
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
                        Please stay on this screen. <span className="font-semibold text-foreground">{doctorName}</span> will join shortly.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                    <Card className="p-4 text-center space-y-1 bg-muted/50 border-none shadow-none">
                        <Clock className="w-4 h-4 mx-auto text-primary" />
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status</p>
                        <p className="text-sm font-bold">Waiting for doctor</p>
                    </Card>
                    <Card className="p-4 text-center space-y-1 bg-muted/50 border-none shadow-none">
                        <Activity className="w-4 h-4 mx-auto text-primary" />
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Session</p>
                        <p className="text-sm font-bold">₦{consultation.price?.toLocaleString() || '0'}</p>
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

    // --- POST-CONSULTATION SUMMARY (from real data) ---
    if (status === 'ended') {
        if (summaryLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading consultation summary...</p>
                </div>
            );
        }

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
                            {/* Diagnosis - from database */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Diagnosis Summary</h3>
                                <div className="p-4 rounded-xl bg-muted/30 border border-muted-foreground/10">
                                    {summaryData?.diagnosis ? (
                                        <>
                                            <p className="font-semibold text-lg">{summaryData.diagnosis}</p>
                                            {summaryData.notes && (
                                                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                                    {summaryData.notes}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">
                                            The doctor has not yet finalized a diagnosis for this session. It will appear here once completed.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Prescriptions - from database */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Prescribed Medications</h3>
                                <div className="space-y-2">
                                    {summaryData?.prescriptions && summaryData.prescriptions.length > 0 ? (
                                        summaryData.prescriptions.map((drug: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-background group hover:border-primary transition-colors">
                                                <div>
                                                    <p className="font-bold text-sm">{drug.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {drug.dosage} {drug.frequency ? `• ${drug.frequency}` : ''} {drug.duration ? `• ${drug.duration}` : ''}
                                                    </p>
                                                </div>
                                                <Button size="icon" variant="ghost" className="text-primary group-hover:bg-primary group-hover:text-primary-foreground" onClick={onPharmacyRedirect}>
                                                    <ShoppingCart className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic p-3">No medications prescribed for this session.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Rating */}
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
                            {rating > 0 && (
                                <Button size="sm" onClick={handleSubmitRating}>Submit Rating</Button>
                            )}
                            <p className="text-[10px] text-muted-foreground italic">Your feedback helps improve our healthcare services</p>
                        </div>
                    </CardContent>

                    <CardFooter className="bg-muted/30 p-4 border-t flex justify-center">
                        <Button onClick={onEnd} variant="link" className="text-muted-foreground hover:text-primary transition-colors">
                            Close & Return to Dashboard
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

    // --- ACTIVE CONSULTATION ---
    return (
        <div className="flex flex-col h-[800px] gap-4 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between bg-background p-1.5 rounded-2xl border px-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Activity className="w-3.5 h-3.5 text-green-500" />
                        Connected
                    </div>
                    <Separator orientation="vertical" className="h-4 hidden sm:block" />
                    <Badge variant="outline" className="font-mono text-[11px] px-2 py-0 border-primary/20 text-primary">
                        {formatTime(duration)}
                    </Badge>
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] hidden md:flex gap-1.5 py-1 px-3">
                        <Wallet className="w-3 h-3" />
                        ₦{consultation.price?.toLocaleString() || '0'}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-red-600 hover:bg-red-50" onClick={handleEndCall}>
                        <PhoneOff className="w-3.5 h-3.5" />
                        End Session
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
                {/* Main Video Area */}
                <div className="flex-1 flex flex-col gap-4">
                    <div className="relative flex-1 bg-neutral-900 rounded-3xl overflow-hidden border border-border group shadow-2xl shadow-primary/5">
                        {/* Doctor feed area */}
                        {!isVideoOff ? (
                            remoteStream ? (
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover animate-in fade-in duration-700"
                                />
                            ) : (
                                <div className="w-full h-full bg-neutral-800 flex flex-col items-center justify-center text-neutral-400 space-y-4">
                                    <div className="w-20 h-20 rounded-full bg-neutral-700 flex items-center justify-center animate-pulse">
                                        <Loader2 className="w-10 h-10 animate-spin" />
                                    </div>
                                    <p className="text-sm italic">Connecting to doctor...</p>
                                </div>
                            )
                        ) : (
                            <div className="w-full h-full bg-neutral-800 flex flex-col items-center justify-center text-neutral-400 space-y-4">
                                <div className="w-20 h-20 rounded-full bg-neutral-700 flex items-center justify-center">
                                    <VideoOff className="w-10 h-10" />
                                </div>
                                <p className="text-sm italic">Video paused</p>
                            </div>
                        )}

                        {/* Patient PIP */}
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

                        {/* Call Controls */}
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 bg-black/30 backdrop-blur-xl rounded-full border border-white/10 opacity-60 hover:opacity-100 transition-all scale-90 hover:scale-100">
                            <Button
                                variant={isMuted ? "destructive" : "secondary"}
                                size="icon"
                                className="rounded-full w-12 h-12 shadow-inner"
                                onClick={toggleMute}
                            >
                                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full w-11 h-11 bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={handleEndCall}>
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

                {/* Right Panel: Chat */}
                <div className="flex flex-col w-full lg:w-80 gap-4">
                    <Card className="border-muted-foreground/10 overflow-hidden shadow-none">
                        <CardHeader className="p-4 bg-muted/20 border-b pb-3">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Doctor</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 py-3 space-y-2">
                            <p className="font-bold text-sm">{doctorName}</p>
                            <p className="text-xs text-muted-foreground">
                                {consultation.doctor_profile?.specialties?.[0] || 'Medical Specialist'}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Chat Area */}
                    <Card className="flex flex-col flex-1 overflow-hidden border-muted-foreground/10 shadow-none bg-muted/10">
                        <CardContent className="flex-1 p-0 overflow-hidden">
                            <ScrollArea ref={scrollAreaRef} className="h-full p-4">
                                <div className="space-y-4">
                                    {messages.length === 0 && (
                                        <p className="text-xs text-muted-foreground text-center py-8">
                                            Chat with your doctor during the session. Messages are sent in real-time.
                                        </p>
                                    )}
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
            </div >
        </div >
    );
}
