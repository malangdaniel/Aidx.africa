import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, PhoneOff, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

interface VideoCallProps {
    roomId: string;
    userId: string;
    userName: string;
    isDoctor: boolean;
    onEndCall: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
    ],
    iceCandidatePoolSize: 10,
};

export default function VideoCall({ roomId, userId, isDoctor, onEndCall }: VideoCallProps) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [status, setStatus] = useState<'initializing' | 'waiting' | 'connected' | 'failed' | 'ended'>('initializing');
    const [statusMsg, setStatusMsg] = useState('Starting camera...');

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    // Perfect Negotiation flags
    const makingOffer = useRef(false);
    const ignoreOffer = useRef(false);
    // Polite peer = patient; yields when collision occurs
    const isPolite = !isDoctor;

    // ICE candidate buffer: hold candidates that arrive before remote desc is set
    const iceCandidateBuffer = useRef<RTCIceCandidateInit[]>([]);

    // Ping retry interval
    const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const sendSignal = useCallback((payload: object) => {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { ...payload, userId },
        });
    }, [userId]);

    const stopPingInterval = () => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
    };

    const drainIceCandidateBuffer = async (pc: RTCPeerConnection) => {
        console.log(`VideoCall: draining ${iceCandidateBuffer.current.length} buffered ICE candidates`);
        while (iceCandidateBuffer.current.length > 0) {
            const candidate = iceCandidateBuffer.current.shift();
            try {
                await pc.addIceCandidate(candidate);
            } catch (err) {
                console.warn('VideoCall: error adding buffered candidate:', err);
            }
        }
    };

    // ─── Peer Connection ──────────────────────────────────────────────────────

    const createPeerConnection = useCallback((stream: MediaStream) => {
        if (peerConnectionRef.current) {
            console.log('VideoCall: PC already exists, skipping creation');
            return;
        }

        console.log('VideoCall: Creating RTCPeerConnection');
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // Add local tracks
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // ── Perfect Negotiation: onnegotiationneeded ──────────────────────────
        pc.onnegotiationneeded = async () => {
            if (makingOffer.current) return;
            try {
                console.log('VideoCall: onnegotiationneeded fired, creating offer');
                makingOffer.current = true;
                const offer = await pc.createOffer();
                if (pc.signalingState !== 'stable') return;
                await pc.setLocalDescription(offer);
                sendSignal({ type: 'offer', sdp: pc.localDescription });
            } catch (err) {
                console.error('VideoCall: onnegotiationneeded error:', err);
            } finally {
                makingOffer.current = false;
            }
        };

        // ── Remote Track ──────────────────────────────────────────────────────
        pc.ontrack = (event) => {
            console.log('VideoCall: ontrack fired, kind:', event.track.kind);
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                remoteVideoRef.current.play().catch(e => console.warn('Remote play error:', e));
            }
            setStatus('connected');
            stopPingInterval();
            toast.success('Video call connected!');
        };

        // ── ICE Candidates ────────────────────────────────────────────────────
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({ type: 'candidate', candidate: event.candidate.toJSON() });
            }
        };

        // ── Connection State ──────────────────────────────────────────────────
        pc.onconnectionstatechange = () => {
            console.log('VideoCall: connectionState =', pc.connectionState);
            if (pc.connectionState === 'connected') {
                setStatus('connected');
                stopPingInterval();
            } else if (pc.connectionState === 'failed') {
                setStatus('failed');
                setStatusMsg('Connection failed. Please check your network.');
                toast.error('Video call connection failed');
            } else if (pc.connectionState === 'disconnected') {
                toast.info('Call connection interrupted');
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('VideoCall: iceConnectionState =', pc.iceConnectionState);
        };

    }, [sendSignal]);

    // ─── Signaling Handler ────────────────────────────────────────────────────

    const handleSignal = useCallback(async (payload: any) => {
        if (payload.userId === userId) return;

        const pc = peerConnectionRef.current;

        // ── Ping / Pong ───────────────────────────────────────────────────────
        if (payload.type === 'ping') {
            console.log('VideoCall: received ping, sending pong');
            sendSignal({ type: 'pong' });
            // Create PC on receiving a ping (other peer is ready)
            if (!pc && localStreamRef.current) {
                createPeerConnection(localStreamRef.current);
            }
            return;
        }

        if (payload.type === 'pong') {
            console.log('VideoCall: received pong, peer is ready');
            // Create PC now that we know the other peer is listening
            if (!pc && localStreamRef.current) {
                createPeerConnection(localStreamRef.current);
            }
            return;
        }

        if (!pc) {
            console.warn('VideoCall: received signal but no PC yet, type:', payload.type);
            return;
        }

        // ── Offer ─────────────────────────────────────────────────────────────
        if (payload.type === 'offer') {
            const offerCollision = makingOffer.current || pc.signalingState !== 'stable';
            ignoreOffer.current = !isPolite && offerCollision;

            if (ignoreOffer.current) {
                console.log('VideoCall: ignoring colliding offer (impolite peer)');
                return;
            }

            try {
                console.log('VideoCall: setting remote offer, creating answer');
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                await drainIceCandidateBuffer(pc);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal({ type: 'answer', sdp: pc.localDescription });
            } catch (err) {
                console.error('VideoCall: error handling offer:', err);
            }
            return;
        }

        // ── Answer ────────────────────────────────────────────────────────────
        if (payload.type === 'answer') {
            if (pc.signalingState !== 'have-local-offer') {
                console.warn('VideoCall: received answer but state is', pc.signalingState);
                return;
            }
            try {
                console.log('VideoCall: setting remote answer');
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                await drainIceCandidateBuffer(pc);
            } catch (err) {
                console.error('VideoCall: error handling answer:', err);
            }
            return;
        }

        // ── ICE Candidate ─────────────────────────────────────────────────────
        if (payload.type === 'candidate') {
            if (!pc.remoteDescription) {
                console.log('VideoCall: buffering ICE candidate (no remote desc yet)');
                iceCandidateBuffer.current.push(payload.candidate);
                return;
            }
            try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
                if (!ignoreOffer.current) {
                    console.warn('VideoCall: error adding ICE candidate:', err);
                }
            }
        }
    }, [userId, isPolite, sendSignal, createPeerConnection]);

    // ─── Main Initialisation ──────────────────────────────────────────────────

    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            try {
                setStatusMsg('Accessing camera and microphone...');
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                    audio: true,
                });

                if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return; }

                localStreamRef.current = stream;
                setLocalStream(stream);

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.play().catch(() => {});
                }

                setStatus('waiting');
                setStatusMsg('Connecting to the other participant...');

                // ── Subscribe to signaling channel ───────────────────────────
                const channel = supabase.channel(`call:${roomId}`, {
                    config: { broadcast: { self: false, ack: false } },
                });
                channelRef.current = channel;

                channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
                    handleSignal(payload);
                });

                channel.subscribe((subStatus) => {
                    console.log('VideoCall: channel status =', subStatus);
                    if (subStatus === 'SUBSCRIBED') {
                        // Send an initial ping immediately
                        sendSignal({ type: 'ping' });

                        // Then retry every 2 seconds until we're connected
                        if (!pingIntervalRef.current) {
                            pingIntervalRef.current = setInterval(() => {
                                const state = peerConnectionRef.current?.connectionState;
                                if (state === 'connected') {
                                    stopPingInterval();
                                    return;
                                }
                                console.log('VideoCall: retrying ping...');
                                sendSignal({ type: 'ping' });
                            }, 2000);
                        }
                    }

                    if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
                        console.warn('VideoCall: channel error:', subStatus);
                    }
                });

            } catch (err: any) {
                if (!isMounted) return;
                console.error('VideoCall: media init error:', err);
                if (err.name === 'NotAllowedError') {
                    toast.error('Camera/microphone permission denied. Please allow access in your browser settings.');
                } else if (err.name === 'NotFoundError') {
                    toast.error('No camera or microphone found. Please connect a device and try again.');
                } else {
                    toast.error('Could not start video call. Please check your camera and microphone.');
                }
                setStatus('failed');
                setStatusMsg('Could not access camera or microphone.');
            }
        };

        init();

        return () => {
            isMounted = false;
            stopPingInterval();
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            peerConnectionRef.current?.close();
            peerConnectionRef.current = null;
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, [roomId]);

    // Attach local stream to video element when ref/stream become available
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(() => {});
        }
    }, [localStream]);

    // ─── Controls ─────────────────────────────────────────────────────────────

    const toggleMute = () => {
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
        setIsMuted(m => !m);
    };

    const toggleVideo = () => {
        localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
        setIsVideoOff(v => !v);
    };

    const handleEndCall = () => {
        stopPingInterval();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        if (channelRef.current) supabase.removeChannel(channelRef.current);
        onEndCall();
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <Card className="relative overflow-hidden bg-black w-full h-full min-h-[280px] flex flex-col items-center justify-center rounded-none border-0">

            {/* Remote Video */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Overlay when not yet connected */}
            {status !== 'connected' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-neutral-900/90 text-white gap-4">
                    {status === 'failed' ? (
                        <>
                            <WifiOff className="w-10 h-10 text-red-400" />
                            <p className="text-sm font-medium text-red-300 text-center px-6">{statusMsg}</p>
                        </>
                    ) : (
                        <>
                            <div className="relative">
                                <div className="w-14 h-14 rounded-full border-2 border-white/10 flex items-center justify-center">
                                    <div className="w-10 h-10 rounded-full border-2 border-t-white border-white/20 animate-spin" />
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-sm font-semibold">{statusMsg}</p>
                                <p className="text-xs text-white/40">Ensure camera &amp; microphone are allowed</p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Local Video (PiP) */}
            <div className="absolute top-3 right-3 w-28 h-20 md:w-36 md:h-28 bg-neutral-800 rounded-xl overflow-hidden border border-white/20 shadow-xl z-20">
                {!isVideoOff ? (
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/40 text-[10px] font-medium">
                        Camera Off
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
                <Button
                    variant={isMuted ? 'destructive' : 'secondary'}
                    size="icon"
                    className="rounded-full h-11 w-11 shadow-lg"
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>

                <Button
                    variant="destructive"
                    size="icon"
                    className="rounded-full h-12 w-12 shadow-xl"
                    onClick={handleEndCall}
                    title="End call"
                >
                    <PhoneOff className="w-4 h-4" />
                </Button>

                <Button
                    variant={isVideoOff ? 'destructive' : 'secondary'}
                    size="icon"
                    className="rounded-full h-11 w-11 shadow-lg"
                    onClick={toggleVideo}
                    title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
                >
                    {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </Button>
            </div>
        </Card>
    );
}
