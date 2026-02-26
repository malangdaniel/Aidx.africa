import React from 'react';
import { AlertTriangle, ThumbsUp, ThumbsDown, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSubmitAlertFeedback } from '@/services/elite/EliteApi';
import type { AlertEvent } from '@/services/EliteService';

interface AlertEventBannerProps {
    alert: AlertEvent;
    onOpenConsult: (a: any) => void;
}

export function AlertEventBanner({ alert, onOpenConsult }: AlertEventBannerProps) {
    const { mutate: submitFeedback, isPending } = useSubmitAlertFeedback();
    const isCritical = alert.severity === 'critical' || alert.severity === 'high';
    const hasFeedback = !!alert.feedback;

    const handleFeedback = (feedback: 'helpful' | 'not_helpful') => {
        if (hasFeedback) return;
        submitFeedback({ alertId: alert.id, feedback });
    };

    return (
        <div className={cn(
            'rounded-2xl p-4 border flex flex-col gap-3 transition-all duration-300',
            isCritical
                ? 'bg-rose-950/60 border-rose-500/60'
                : 'bg-amber-950/50 border-amber-500/40'
        )}>
            <div className="flex items-start gap-3">
                <AlertTriangle className={cn('w-5 h-5 flex-shrink-0 mt-0.5', isCritical ? 'text-rose-400' : 'text-amber-400')} />
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white mb-1">
                        {isCritical ? '🚨 Attention Required' : '⚠️ Health Notice'}
                    </div>
                    <p className="text-[11px] text-white/70 leading-relaxed">
                        {alert.meta?.output?.insight || `Significant deviation in ${alert.metric?.replace('_', ' ') || 'physiological stats'}.`}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
                            Confidence: {Math.round(alert.confidence_score * 100)}%
                        </span>
                        {alert.early_warning && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Early Warning
                            </span>
                        )}
                    </div>
                </div>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenConsult(alert)}
                    className="flex-shrink-0 text-[11px] h-8 px-3 bg-white/5 hover:bg-white/10 text-white border-white/10 rounded-xl"
                >
                    <Stethoscope className="w-3 h-3 mr-1" /> Advice
                </Button>
            </div>

            <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                <span className="text-[10px] text-white/40 italic">Was this alert helpful?</span>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={hasFeedback || isPending}
                        onClick={() => handleFeedback('helpful')}
                        className={cn(
                            "h-7 px-2 rounded-lg gap-1.5 text-[10px]",
                            alert.feedback === 'helpful' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-white/40 hover:text-white/60"
                        )}
                    >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        Helpful
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={hasFeedback || isPending}
                        onClick={() => handleFeedback('not_helpful')}
                        className={cn(
                            "h-7 px-2 rounded-lg gap-1.5 text-[10px]",
                            alert.feedback === 'not_helpful' ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "text-white/40 hover:text-white/60"
                        )}
                    >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        Noisy
                    </Button>
                </div>
            </div>
        </div>
    );
}
