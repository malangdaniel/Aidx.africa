import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { Bot, User, Send, RefreshCw, ArrowLeft, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sendMessageToAI, generateDiagnosis as getAIDiagnosis, ChatMessage } from '@/services/ai';
import { ClinicalAssessmentData } from '@/types/clinicalAssessment';
import { toast } from 'sonner';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface AIChatInterfaceProps {
    sessionId?: string | null;
    onBack?: () => void;
    onConsultationComplete?: () => void;
    onViewAssessment?: (data: ClinicalAssessmentData) => void;
    onBookConsult?: (specialist: string) => void;
    onPharmacyRedirect?: (medicationName: string) => void;
}

export default function AIChatInterface({
    sessionId: initialSessionId,
    onBack,
    onConsultationComplete,
    onViewAssessment,
    onBookConsult,
    onPharmacyRedirect
}: AIChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm Sanari AI, your AI health companion. Please describe what you're feeling today."
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);
    const [isAssessmentReady, setIsAssessmentReady] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
    const [sessionTitle, setSessionTitle] = useState<string>('');
    const [assessmentResult, setAssessmentResult] = useState<ClinicalAssessmentData | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialSessionId) {
            loadChatHistory(initialSessionId);
        }
    }, [initialSessionId]);

    const loadChatHistory = async (id: string) => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('ai_chats')
                .select('id, message, response, session_id, title, created_at')
                .eq('session_id', id)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                const historyMessages: Message[] = [
                    {
                        id: 'welcome',
                        role: 'assistant',
                        content: "Hello! I'm Sanari AI, your AI health companion. Please describe what you're feeling today."
                    }
                ];

                data.forEach((row) => {
                    historyMessages.push({
                        id: `${row.id}-user`,
                        role: 'user',
                        content: row.message
                    });
                    if (row.response) {
                        historyMessages.push({
                            id: `${row.id}-assistant`,
                            role: 'assistant',
                            content: row.response
                        });
                    }
                });

                setMessages(historyMessages);
                setSessionTitle(data[0].title || '');
            }
        } catch (error) {
            console.error('Error loading history:', error);
            toast.error('Failed to load chat history.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages, isGeneratingAssessment, isAssessmentReady]);

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error('You must be logged in to chat.');
            return;
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputText
        };

        const currentSessionId = sessionId || crypto.randomUUID();
        if (!sessionId) setSessionId(currentSessionId);

        const currentTitle = sessionTitle || inputText.slice(0, 50) + (inputText.length > 50 ? '...' : '');
        if (!sessionTitle) setSessionTitle(currentTitle);

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        try {
            const apiHistory: ChatMessage[] = messages
                .filter(m => m.id !== 'welcome')
                .map(m => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content }]
                }));

            const responseText = await sendMessageToAI(apiHistory, userMessage.content);

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText
            };

            const updatedMessages = [...newMessages, aiMessage];
            setMessages(updatedMessages);

            // Save turn to Supabase
            await supabase.from('ai_chats').insert({
                user_id: user.id,
                session_id: currentSessionId,
                title: currentTitle,
                message: userMessage.content,
                response: responseText
            });

            // Trigger clinical assessment generation after 4 user responses or explicit AI trigger
            const userMsgCount = updatedMessages.filter(m => m.role === 'user').length;
            const isReady = responseText.toLowerCase().includes("assessment complete") || userMsgCount >= 4;

            if (isReady && !isAssessmentReady) {
                triggerAssessmentGeneration(updatedMessages, currentSessionId);
            }

        } catch (error) {
            console.error("Failed to get AI response", error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm sorry, I'm having trouble connecting right now. Please try again."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const triggerAssessmentGeneration = async (chatMessages: Message[], assessmentSessionId: string) => {
        setIsGeneratingAssessment(true);
        const fullHistory = chatMessages.map(m => `${m.role}: ${m.content}`).join('\n');

        // Simulate brief 2.5s loading animation for UX feedback
        setTimeout(async () => {
            try {
                const assessmentData = await getAIDiagnosis(fullHistory);
                if (assessmentData) {
                    setAssessmentResult(assessmentData);
                    setIsAssessmentReady(true);
                    if (onConsultationComplete) onConsultationComplete();

                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        await supabase.from('ai_diagnoses').insert({
                            user_id: user.id,
                            session_id: assessmentSessionId,
                            condition: assessmentData.conditions?.[0]?.name || "Assessment Completed",
                            diagnosis_data: assessmentData as any,
                            rationale: assessmentData.clinicalSummaryText
                        });
                    }
                }
            } catch (err) {
                console.error("Error generating assessment:", err);
            } finally {
                setIsGeneratingAssessment(false);
            }
        }, 2500);
    };

    const handleRestart = () => {
        setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm Sanari AI, your AI health companion. Please describe what you're feeling today."
        }]);
        setIsGeneratingAssessment(false);
        setIsAssessmentReady(false);
        setAssessmentResult(null);
        setSessionId(null);
        setSessionTitle('');
    };

    return (
        <div className="flex flex-col h-[650px] gap-4 max-w-4xl mx-auto">
            <Card className="flex-1 flex flex-col overflow-hidden border-border shadow-sm">
                <CardHeader className="py-3 px-4 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                        {onBack && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        )}
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Bot className="w-5 h-5 text-primary" />
                            {sessionTitle || "AI Clinical Consultation"}
                        </CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleRestart} title="Start New Consultation">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </CardHeader>

                <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea ref={scrollAreaRef} className="h-full p-4">
                        <div className="space-y-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <Avatar className="w-8 h-8 shrink-0">
                                            {msg.role === 'assistant' ? (
                                                <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground">
                                                    <Bot className="w-4 h-4" />
                                                </div>
                                            ) : (
                                                <div className="w-full h-full bg-secondary flex items-center justify-center text-secondary-foreground">
                                                    <User className="w-4 h-4" />
                                                </div>
                                            )}
                                        </Avatar>
                                        <div
                                            className={`rounded-2xl p-3.5 text-xs leading-relaxed whitespace-pre-wrap ${
                                                msg.role === 'user'
                                                    ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                    : 'bg-muted/70 text-foreground rounded-tl-none border border-border/40'
                                            }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Loading Indicator for AI Turn */}
                            {isLoading && !isGeneratingAssessment && (
                                <div className="flex justify-start">
                                    <div className="flex gap-2 max-w-[80%]">
                                        <Avatar className="w-8 h-8">
                                            <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground">
                                                <Bot className="w-4 h-4" />
                                            </div>
                                        </Avatar>
                                        <div className="bg-muted rounded-2xl p-3.5 flex items-center gap-1.5">
                                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Phase 1: Generating Clinical Assessment Skeleton State */}
                            {isGeneratingAssessment && (
                                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in duration-300">
                                    <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                                        <Sparkles className="w-4 h-4 animate-spin" />
                                        Assessment Complete
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        We've gathered enough information. Generating your clinical assessment...
                                    </p>
                                    <div className="h-1.5 w-full bg-primary/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary animate-pulse w-3/4 rounded-full" />
                                    </div>
                                </div>
                            )}

                            {/* Phase 1 Complete: View Assessment CTA */}
                            {isAssessmentReady && assessmentResult && (
                                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3 animate-in fade-in duration-500">
                                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Clinical Assessment Ready
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Your findings have been structured into interactive clinical dashboard cards.
                                    </p>
                                    <Button
                                        className="w-full gap-2 h-10 font-semibold text-xs shadow-sm"
                                        onClick={() => onViewAssessment && onViewAssessment(assessmentResult)}
                                    >
                                        View Clinical Assessment Dashboard
                                        <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>

                <CardFooter className="p-3 border-t bg-background">
                    <form
                        className="flex w-full gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSendMessage();
                        }}
                    >
                        <Input
                            placeholder={
                                isAssessmentReady
                                    ? "Assessment complete. Reopen dashboard to review findings."
                                    : "Describe your symptoms..."
                            }
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            disabled={isLoading || isGeneratingAssessment || isAssessmentReady}
                            className="text-xs h-10"
                        />
                        <Button type="submit" disabled={isLoading || isGeneratingAssessment || isAssessmentReady} className="h-10 px-4">
                            <Send className="w-4 h-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    );
}
