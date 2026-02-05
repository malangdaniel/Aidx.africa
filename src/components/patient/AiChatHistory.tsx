import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, MessageSquare, Calendar, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';

interface ChatSession {
    session_id: string;
    title: string;
    created_at: string;
    message_count: number;
}

interface AiChatHistoryProps {
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
}

const MOCK_SESSIONS: ChatSession[] = [
    {
        session_id: 'mock-session-1',
        title: 'Persistent dry cough and fever',
        created_at: subDays(new Date(), 2).toISOString(),
        message_count: 8
    },
    {
        session_id: 'mock-session-2',
        title: 'Mild headache and dizziness',
        created_at: subDays(new Date(), 5).toISOString(),
        message_count: 4
    },
    {
        session_id: 'mock-session-3',
        title: 'Allergy symptoms analysis',
        created_at: subDays(new Date(), 10).toISOString(),
        message_count: 6
    }
];

export default function AiChatHistory({ onSelectSession, onNewChat }: AiChatHistoryProps) {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setSessions(MOCK_SESSIONS);
                return;
            }

            const { data, error } = await supabase
                .from('ai_chats')
                .select('session_id, title, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                const sessionMap = new Map<string, ChatSession>();

                data.forEach((chat: any) => {
                    if (!chat.session_id) return;

                    if (!sessionMap.has(chat.session_id)) {
                        sessionMap.set(chat.session_id, {
                            session_id: chat.session_id,
                            title: chat.title || 'New Conversation',
                            created_at: chat.created_at,
                            message_count: 1
                        });
                    } else {
                        const existing = sessionMap.get(chat.session_id)!;
                        existing.message_count += 1;
                    }
                });

                setSessions(Array.from(sessionMap.values()));
            } else {
                setSessions(MOCK_SESSIONS);
            }
        } catch (error) {
            console.error('Error fetching chat sessions:', error);
            setSessions(MOCK_SESSIONS);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (sessionId.startsWith('mock-')) {
            setSessions(prev => prev.filter(s => s.session_id !== sessionId));
            toast.success('Mock conversation removed.');
            return;
        }

        if (!confirm('Are you sure you want to delete this conversation?')) return;

        try {
            const { error } = await supabase
                .from('ai_chats')
                .delete()
                .eq('session_id', sessionId);

            if (error) throw error;

            setSessions(prev => prev.filter(s => s.session_id !== sessionId));
            toast.success('Conversation deleted.');
        } catch (error) {
            console.error('Error deleting session:', error);
            toast.error('Failed to delete conversation.');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Conversations</h3>
                <Button variant="outline" size="sm" onClick={onNewChat} className="h-8 gap-2">
                    <MessageSquare className="w-4 h-4" />
                    New Chat
                </Button>
            </div>

            {sessions.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Bot className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground max-w-[200px]">
                            No past conversations found. Start a new chat with Sophie!
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {sessions.map((session) => (
                        <Card
                            key={session.session_id}
                            className="cursor-pointer hover:border-primary/50 transition-colors group"
                            onClick={() => onSelectSession(session.session_id)}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm line-clamp-1">{session.title}</h4>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(session.created_at), 'MMM dd')}
                                            </span>
                                            <span>{session.message_count} messages</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => handleDeleteSession(session.session_id, e)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
