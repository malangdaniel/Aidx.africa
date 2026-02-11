import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { toast } from 'sonner';

interface VideoCallProps {
    roomId: string; // usually consultationId
    userId: string; // current user id
    userName: string;
    isDoctor: boolean; // to determine who might initiate (optional, but helpful)
    onEndCall: () => void;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ],
};

export default function VideoCall({ roomId, userId, onEndCall }: VideoCallProps) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [status, setStatus] = useState<'initializing' | 'waiting' | 'connected' | 'ended'>('initializing');

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);

    useEffect(() => {
        initializeMedia();
        return () => cleanup();
    }, [roomId]);

    const initializeMedia = async () => {
        console.log("VideoCall: initializeMedia started");
        try {
            console.log("VideoCall: Requesting user media...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log("VideoCall: Media stream obtained", stream.id);
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            setStatus('waiting');

            initializePeerConnection(stream);
            initializeSignaling();
        } catch (err) {
            console.error('VideoCall: Error accessing media devices:', err);
            toast.error('Could not access camera/microphone. Check permissions.');
        }
    };

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
            setStatus('connected');
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({ type: 'candidate', candidate: event.candidate });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
            if (pc.connectionState === 'disconnected') {
                setStatus('ended');
                toast.info("Call disconnected");
            }
        };
    };

    const initializeSignaling = () => {
        const channel = supabase.channel(`call:${roomId}`);
        channelRef.current = channel;

        channel
            .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                if (payload.userId === userId) return; // Ignore own messages

                try {
                    const pc = peerConnectionRef.current;
                    if (!pc) return;

                    if (payload.type === 'offer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        sendSignal({ type: 'answer', answer });
                    } else if (payload.type === 'answer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                    } else if (payload.type === 'candidate') {
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    } else if (payload.type === 'ready') {
                        // Other peer is ready, I am the initiator
                        createOffer();
                    }
                } catch (err) {
                    console.error('Signaling error:', err);
                }
            })
            .subscribe((status) => {
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

    const sendSignal = (payload: any) => {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { ...payload, userId },
        });
    };

    const cleanup = () => {
        localStream?.getTracks().forEach((track) => track.stop());
        peerConnectionRef.current?.close();
        supabase.removeChannel(channelRef.current);
        setStatus('ended');
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
            setIsVideoOff(!isVideoOff);
        }
    };

    return (
        <Card className="relative overflow-hidden bg-black aspect-video flex flex-col items-center justify-center">
            {/* Remote Video (Full Size) */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Status Overlay */}
            {status !== 'connected' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <div className="text-white text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                        <p>{status === 'initializing' ? 'Starting camera...' : 'Waiting for connection...'}</p>
                    </div>
                </div>
            )}

            {/* Local Video (PiP) */}
            <div className="absolute top-4 right-4 w-32 h-24 bg-gray-900 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg z-20">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                />
                {isVideoOff && (
                    <div className="w-full h-full flex items-center justify-center text-white/50 text-xs">
                        Camera Off
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-6 flex gap-4 z-30">
                <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="icon"
                    className="rounded-full h-12 w-12"
                    onClick={toggleMute}
                >
                    {isMuted ? <MicOff /> : <Mic />}
                </Button>
                <Button
                    variant="destructive"
                    size="icon"
                    className="rounded-full h-12 w-12"
                    onClick={() => { cleanup(); onEndCall(); }}
                >
                    <PhoneOff />
                </Button>
                <Button
                    variant={isVideoOff ? "destructive" : "secondary"}
                    size="icon"
                    className="rounded-full h-12 w-12"
                    onClick={toggleVideo}
                >
                    {isVideoOff ? <VideoOff /> : <Video />}
                </Button>
            </div>
        </Card>
    );
}
