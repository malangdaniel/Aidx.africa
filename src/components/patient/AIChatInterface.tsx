import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { Bot, User, Send, RefreshCw, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import DiagnosisResult, { Diagnosis } from './DiagnosisResult';
import { sendMessageToAI, generateDiagnosis as getAIDiagnosis, ChatMessage } from '@/services/ai';
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
    onBookConsult?: (specialist: string) => void;
    onPharmacyRedirect?: () => void;
}

export default function AIChatInterface({
    sessionId: initialSessionId,
    onBack,
    onConsultationComplete,
    onBookConsult,
    onPharmacyRedirect
}: AIChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm your AI Health Assistant. I can help you understand your symptoms and suggest next steps. Please describe what you're feeling today."
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAssessmentComplete, setIsAssessmentComplete] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
    const [sessionTitle, setSessionTitle] = useState<string>('');
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Mock Diagnosis State
    const [diagnosisData, setDiagnosisData] = useState<{
        diagnoses: Diagnosis[];
        specialist: string;
        meds: Array<{ name: string; type: string }>;
    } | null>(null);

    // Load history if sessionId exists
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
                const historyMessages: Message[] = [];
                // Add initial welcome if not in DB (or just always keep it)
                historyMessages.push({
                    id: 'welcome',
                    role: 'assistant',
                    content: "Hello! I'm your AI Health Assistant. I can help you understand your symptoms and suggest next steps. Please describe what you're feeling today."
                });

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

                // If there are many messages, check if assessment was done
                // (This is a simplification, ideally status is in a sessions table)
                if (data.length >= 5) {
                    // Logic to see if assessment was finished could go here
                }
            }
        } catch (error) {
            console.error('Error loading history:', error);
            toast.error('Failed to load chat history.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Auto-scroll to bottom
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages, isAssessmentComplete]);

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

        // If it's a new session, use first message as title
        const currentTitle = sessionTitle || inputText.slice(0, 50) + (inputText.length > 50 ? '...' : '');
        if (!sessionTitle) setSessionTitle(currentTitle);

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        try {
            // Convert UI messages to API format for context
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

            setMessages(prev => [...prev, aiMessage]);

            // Save to Database
            const { error: saveError } = await supabase
                .from('ai_chats')
                .insert({
                    user_id: user.id,
                    session_id: currentSessionId,
                    title: currentTitle,
                    message: userMessage.content,
                    response: responseText
                });

            if (saveError) console.error("Error saving chat turn:", saveError);

            // Trigger diagnosis heuristic
            const userMsgCount = newMessages.filter(m => m.role === 'user').length;
            const isReady = responseText.toLowerCase().includes("ready to provide an assessment") || userMsgCount >= 5;

            if (isReady) {
                setIsAssessmentComplete(true);
                generateDiagnosis(newMessages.map(m => `${m.role}: ${m.content}`).join('\n') + `\nassistant: ${responseText}`);
            }

        } catch (error) {
            console.error("Failed to get AI response", error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm sorry, I'm having trouble connecting right now. Please try again."
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const generateDiagnosis = async (conversationHistory: string) => {
        setIsLoading(true);
        try {
            const result = await getAIDiagnosis(conversationHistory);
            if (result) {
                setDiagnosisData(result);
                if (onConsultationComplete) onConsultationComplete();

                // Save diagnosis metadata if needed to ai_diagnoses
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('ai_diagnoses').insert({
                        user_id: user.id,
                        condition: result.diagnoses?.[0]?.condition,
                        diagnosis_data: result,
                        rationale: result.diagnoses?.[0]?.explanation
                    });
                }
            }
        } catch (error) {
            console.error("Error parsing diagnosis", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestart = () => {
        setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm your AI Health Assistant. I can help you understand your symptoms and suggest next steps. Please describe what you're feeling today."
        }]);
        setIsAssessmentComplete(false);
        setDiagnosisData(null);
        setSessionId(null);
        setSessionTitle('');
    };

    return (
        <div className="flex flex-col h-[600px] gap-4">
            {/* Chat Area */}
            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="py-3 px-4 border-b bg-muted/40 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                        {onBack && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        )}
                        <CardTitle className="text-md flex items-center gap-2">
                            <Bot className="w-5 h-5 text-primary" />
                            {sessionTitle || "AI Health Chat"}
                        </CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleRestart} title="Restart Chat">
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
                                    <div className={`flex gap-2 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <Avatar className="w-8 h-8">
                                            {msg.role === 'assistant' ? (
                                                <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground">
                                                    <Bot className="w-5 h-5" />
                                                </div>
                                            ) : (
                                                <div className="w-full h-full bg-secondary flex items-center justify-center text-secondary-foreground">
                                                    <User className="w-5 h-5" />
                                                </div>
                                            )}
                                        </Avatar>
                                        <div
                                            className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${msg.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'
                                                }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="flex gap-2 max-w-[80%]">
                                        <Avatar className="w-8 h-8">
                                            <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground">
                                                <Bot className="w-5 h-5" />
                                            </div>
                                        </Avatar>
                                        <div className="bg-muted rounded-lg p-3 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>

                <CardFooter className="p-4 border-t bg-background">
                    <form
                        className="flex w-full gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSendMessage();
                        }}
                    >
                        <Input
                            placeholder={isAssessmentComplete ? "Chat session ended. Restart to start over." : "Type your symptoms..."}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            disabled={isLoading || isAssessmentComplete}
                        />
                        <Button type="submit" disabled={isLoading || isAssessmentComplete}>
                            <Send className="w-4 h-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
                </CardFooter>
            </Card>

            {/* Results Area */}
            {isAssessmentComplete && diagnosisData && (
                <div className="animate-in fade-in slide-in-from-bottom duration-500">
                    <DiagnosisResult
                        diagnoses={diagnosisData.diagnoses}
                        recommendedSpecialist={diagnosisData.specialist}
                        recommendedMeds={diagnosisData.meds}
                        onBookConsult={() => onBookConsult && onBookConsult(diagnosisData.specialist)}
                        onOrderMeds={() => onPharmacyRedirect && onPharmacyRedirect()}
                    />
                </div>
            )}
        </div>
    );
}
