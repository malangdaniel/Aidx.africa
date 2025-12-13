import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { Bot, User, Send, RefreshCw } from 'lucide-react';
import DiagnosisResult, { Diagnosis } from './DiagnosisResult';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface AIChatInterfaceProps {
    onConsultationComplete?: () => void;
    onBookConsult?: (specialist: string) => void;
    onPharmacyRedirect?: () => void;
}

export default function AIChatInterface({
    onConsultationComplete,
    onBookConsult,
    onPharmacyRedirect
}: AIChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hello! I'm your AI Health Assistant. I can help you understand your symptoms and suggest next steps. Please describe what you're feeling today."
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAssessmentComplete, setIsAssessmentComplete] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Mock Diagnosis State
    const [diagnosisData, setDiagnosisData] = useState<{
        diagnoses: Diagnosis[];
        specialist: string;
        meds: Array<{ name: string; type: string }>;
    } | null>(null);

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

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputText
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        // Simulate AI processing and decision making
        setTimeout(() => {
            let aiResponse: Message;
            const lowerInput = userMessage.content.toLowerCase();

            // Simple mock logic flow
            if (messages.length < 3) {
                // Still gathering info
                if (lowerInput.includes('headache')) {
                    aiResponse = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: "I understand you have a headache. Is it localized to one side, or is it all over? How long has it been persisting?"
                    };
                } else if (lowerInput.includes('chest') || lowerInput.includes('heart')) {
                    aiResponse = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: "Chest pain can be serious. Are you experiencing any shortness of breath or radiating pain to your arm or jaw?"
                    };
                } else if (lowerInput.includes('stomach') || lowerInput.includes('belly')) {
                    aiResponse = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: "Stomach issues can vary. Do you have any nausea, vomiting, or fever accompanying the pain?"
                    };
                } else {
                    aiResponse = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: "Could you tell me more about the severity of your symptoms on a scale of 1 to 10? And do you have any pre-existing conditions?"
                    };
                }
                setMessages(prev => [...prev, aiResponse]);
            } else {
                // End of mock assessment
                const finalMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "Thank you for providing those details. I've analyzed your symptoms and generated a preliminary assessment. Please review the results below."
                };
                setMessages(prev => [...prev, finalMessage]);
                setIsAssessmentComplete(true);
                generateDiagnosis(lowerInput);
                if (onConsultationComplete) onConsultationComplete();
            }
            setIsLoading(false);
        }, 1500);
    };

    const generateDiagnosis = (lastInput: string) => {
        // Mock diagnosis generation based on conversation context (simplified)
        const history = messages.map(m => m.content.toLowerCase()).join(' ');

        if (history.includes('chest') || history.includes('heart')) {
            setDiagnosisData({
                diagnoses: [
                    { condition: 'Angina Pectoris', probability: 75, rationale: 'Symptoms match typical presentation of stable angina including chest discomfort.' },
                    { condition: 'Gastroesophageal Reflux Disease (GERD)', probability: 15, rationale: 'Burning sensation could mimic heart pain.' },
                    { condition: 'Costochondritis', probability: 10, rationale: 'Possible inflammation of chest cartilage.' }
                ],
                specialist: 'Cardiologist',
                meds: [{ name: 'Aspirin (Low Dose)', type: 'OTC' }, { name: 'Nitroglycerin', type: 'Prescription' }]
            });
        } else if (history.includes('headache')) {
            setDiagnosisData({
                diagnoses: [
                    { condition: 'Migraine', probability: 60, rationale: 'Unilateral throbbing pain with sensitivity.' },
                    { condition: 'Tension Headache', probability: 30, rationale: 'Stress-related muscle tightness.' },
                    { condition: 'Sinusitis', probability: 10, rationale: 'Possible congestion related pressure.' }
                ],
                specialist: 'Neurologist',
                meds: [{ name: 'Ibuprofen', type: 'OTC' }, { name: 'Sumatriptan', type: 'Prescription' }]
            });
        } else {
            setDiagnosisData({
                diagnoses: [
                    { condition: 'Viral Gastroenteritis', probability: 45, rationale: 'Common stomach bug symptoms.' },
                    { condition: 'Food Poisoning', probability: 35, rationale: 'Acute onset after eating.' },
                    { condition: 'Gastritis', probability: 20, rationale: 'Inflammation of stomach lining.' }
                ],
                specialist: 'Gastroenterologist',
                meds: [{ name: 'Antacids', type: 'OTC' }, { name: 'Probiotics', type: 'OTC' }]
            });
        }
    };

    const handleRestart = () => {
        setMessages([{
            id: Date.now().toString(),
            role: 'assistant',
            content: "Hello! I'm your AI Health Assistant. I can help you understand your symptoms and suggest next steps. Please describe what you're feeling today."
        }]);
        setIsAssessmentComplete(false);
        setDiagnosisData(null);
    };

    return (
        <div className="flex flex-col h-[600px] gap-4">
            {/* Chat Area */}
            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="py-3 px-4 border-b bg-muted/40 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-md flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary" />
                        AI Diagnostic Chat
                    </CardTitle>
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
                                            className={`rounded-lg p-3 text-sm ${msg.role === 'user'
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
