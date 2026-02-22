/**
 * EliteCoachChat — Interactive daily coaching chat widget.
 * AI asks 1-2 clarifying questions per day based on vitals/insight context.
 * Uses Gemini via the AI service for adaptive responses.
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { followUpQuestionPrompt, type FollowUpInput } from '@/services/elite/elitePrompts';
import type { EliteScores } from '@/services/EliteService';

interface Message {
    id: string;
    role: 'coach' | 'user';
    content: string;
    timestamp: Date;
    isQuestion?: boolean;
}

interface EliteCoachChatProps {
    todayInsight: string | null;
    latestScores: EliteScores | null;
    className?: string;
}

const MAX_DAILY_QUESTIONS = 2;
const STORAGE_KEY = 'aidx_elite_chat_session';

interface ChatSession {
    date: string;
    questionCount: number;
    messages: Message[];
}

function loadSession(): ChatSession {
    const today = new Date().toISOString().slice(0, 10);
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const s: ChatSession = JSON.parse(stored);
            if (s.date === today) return s;
        }
    } catch (_) { /* ignore */ }
    return { date: today, questionCount: 0, messages: [] };
}

function saveSession(session: ChatSession): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (_) { /* ignore */ }
}

export default function EliteCoachChat({ todayInsight, latestScores, className }: EliteCoachChatProps) {
    const [session, setSession] = useState<ChatSession>(() => loadSession());
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [session.messages]);

    // Show initial coach question if no messages yet and we have insight
    useEffect(() => {
        if (session.messages.length === 0 && todayInsight) {
            const msg: Message = {
                id: 'coach-init',
                role: 'coach',
                content: `${todayInsight}\n\nHow are you feeling overall today compared to how you've been feeling this past week?`,
                timestamp: new Date(),
                isQuestion: true,
            };
            const updated = { ...session, messages: [msg], questionCount: 1 };
            setSession(updated);
            saveSession(updated);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todayInsight]);

    const canAskMoreQuestions = session.questionCount < MAX_DAILY_QUESTIONS;

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || isTyping) return;

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: new Date(),
        };

        const updatedMessages = [...session.messages, userMsg];
        const updatedSession = { ...session, messages: updatedMessages };
        setSession(updatedSession);
        saveSession(updatedSession);
        setInput('');
        setIsTyping(true);

        try {
            const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!geminiKey) {
                throw new Error('Gemini API key not configured.');
            }

            const previousInsight = session.messages.find(m => m.role === 'coach')?.content ?? todayInsight ?? '';
            const questionNum = (session.questionCount >= 1 ? 2 : 1) as 1 | 2;

            const promptInput: FollowUpInput = {
                previousInsight,
                userAnswer: text,
                questionNumber: questionNum,
                scores: latestScores,
            };

            const genai = new GoogleGenerativeAI(geminiKey);
            const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(followUpQuestionPrompt(promptInput));
            const coachResponse = result.response.text();

            const coachMsg: Message = {
                id: `coach-${Date.now()}`,
                role: 'coach',
                content: coachResponse,
                timestamp: new Date(),
                isQuestion: canAskMoreQuestions && questionNum === 1,
            };

            const finalSession: ChatSession = {
                ...updatedSession,
                messages: [...updatedMessages, coachMsg],
                questionCount: session.questionCount + 1,
            };

            setSession(finalSession);
            saveSession(finalSession);
        } catch (err: any) {
            const errMsg: Message = {
                id: `coach-err-${Date.now()}`,
                role: 'coach',
                content: "I'm having trouble connecting right now. Please try again in a moment.",
                timestamp: new Date(),
            };
            const errorSession = { ...updatedSession, messages: [...updatedMessages, errMsg] };
            setSession(errorSession);
            saveSession(errorSession);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const dailyLimitReached = !canAskMoreQuestions && session.messages.length > 0;

    return (
        <div className={cn('flex flex-col', className)}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 max-h-72">
                {session.messages.length === 0 && !todayInsight && (
                    <div className="text-center py-8">
                        <Sparkles className="w-6 h-6 text-violet-400 mx-auto mb-2 opacity-60" />
                        <p className="text-xs text-white/40">Log your vitals to start a coaching session.</p>
                    </div>
                )}

                {session.messages.map(msg => (
                    <div
                        key={msg.id}
                        className={cn(
                            'flex gap-2',
                            msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                        )}
                    >
                        {/* Avatar */}
                        <div className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                            msg.role === 'coach'
                                ? 'bg-gradient-to-br from-violet-500 to-indigo-600'
                                : 'bg-white/10'
                        )}>
                            {msg.role === 'coach'
                                ? <Bot className="w-3.5 h-3.5 text-white" />
                                : <User className="w-3.5 h-3.5 text-white/70" />
                            }
                        </div>

                        {/* Bubble */}
                        <div className={cn(
                            'max-w-[80%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed',
                            msg.role === 'coach'
                                ? 'bg-white/8 border border-white/10 text-white/90 rounded-tl-sm'
                                : 'bg-violet-600/40 border border-violet-500/30 text-white rounded-tr-sm'
                        )}>
                            {msg.content}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                            <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="bg-white/8 border border-white/10 rounded-2xl rounded-tl-sm px-3 py-2">
                            <Loader2 className="w-3.5 h-3.5 text-violet-300 animate-spin" />
                        </div>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Input area */}
            {dailyLimitReached ? (
                <div className="mt-3 text-center py-2 px-3 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-[10px] text-white/40">
                        Daily coaching check-in complete. See you tomorrow! ✨
                    </p>
                </div>
            ) : (
                <div className="mt-3 flex gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Reply to your coach…"
                        disabled={isTyping}
                        className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/50 disabled:opacity-50"
                    />
                    <Button
                        size="icon"
                        onClick={sendMessage}
                        disabled={!input.trim() || isTyping}
                        className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 text-white flex-shrink-0 shadow-lg shadow-violet-900/30"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
}
