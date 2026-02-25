/**
 * AICoachCard — Compact daily insight card for the Patient Dashboard home screen.
 * Shows today's primary insight, leading health index, and a CTA button.
 */

import { Sparkles, ChevronRight, AlertTriangle, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLatestScores, useActiveAlerts } from '@/services/elite/EliteApi';
import { Skeleton } from '@/components/ui/skeleton';

interface AICoachCardProps {
    insight: string | null;
    isLoadingInsight?: boolean;
    onOpenDashboard: () => void;
}

function TrendIcon({ value, prev }: { value: number | null; prev?: number | null }) {
    if (value === null || prev === null || prev === undefined) return <Minus className="w-3.5 h-3.5 text-white/40" />;
    if (value < prev - 3) return <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />;
    if (value > prev + 3) return <TrendingUp className="w-3.5 h-3.5 text-rose-400" />;
    return <Minus className="w-3.5 h-3.5 text-white/50" />;
}

function IndexBadge({ label, value, confidence }: { label: string; value: number | null; confidence?: number }) {
    const pct = value ?? 100;
    const color = pct >= 80 ? 'from-emerald-500/80 to-emerald-600/80'
        : pct >= 60 ? 'from-amber-500/80 to-amber-600/80'
            : 'from-rose-500/80 to-rose-600/80';

    return (
        <div className="flex flex-col items-center gap-0.5">
            <div className={cn('text-[10px] font-bold text-white tabular-nums')}>
                {value !== null ? value : '—'}
            </div>
            <div className="text-[9px] text-white/50 text-center leading-tight max-w-[48px]">{label}</div>
            {confidence !== undefined && (
                <div className="text-[8px] text-white/30">{Math.round(confidence * 100)}% conf.</div>
            )}
        </div>
    );
}

export default function AICoachCard({ insight, isLoadingInsight, onOpenDashboard }: AICoachCardProps) {
    const { data: scores, isLoading: scoresLoading } = useLatestScores(1);
    const { data: alerts } = useActiveAlerts();

    const latest = scores?.[0] ?? null;
    const hasAlerts = (alerts?.length ?? 0) > 0;
    const latestConf = latest?.confidence_json ?? {};
    const backendInsight = latestConf.insight ?? insight;
    const severity = latestConf.severity ?? 'normal';

    const severityStyles = {
        normal: "border-violet-500/30 shadow-violet-900/20",
        early_watch: "border-indigo-500/40 shadow-indigo-900/20",
        watch: "border-amber-500/40 shadow-amber-900/20",
        attention: "border-amber-500/60 shadow-amber-900/30",
        high: "border-rose-500/60 shadow-rose-900/30",
        critical: "border-rose-600 shadow-rose-900/40 animate-pulse",
    };

    const currentStyle = hasAlerts ? severityStyles.high : (severityStyles[severity as keyof typeof severityStyles] || severityStyles.normal);

    return (
        <div
            onClick={onOpenDashboard}
            className={cn(
                "relative overflow-hidden rounded-2xl cursor-pointer select-none",
                "bg-gradient-to-br from-[#1a0533] via-[#1e0a4a] to-[#0d1550]",
                "border transition-all duration-200",
                currentStyle,
                "shadow-xl hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99]"
            )}
        >
            {/* Radial glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="relative p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-white tracking-wide">AiDx Elite</div>
                            <div className="text-[9px] text-violet-300/80">Health Coach</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {hasAlerts && (
                            <div className="flex items-center gap-1 bg-rose-500/20 border border-rose-500/40 rounded-full px-2 py-0.5">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                                <span className="text-[9px] font-medium text-rose-300">{alerts!.length}</span>
                            </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-white/40" />
                    </div>
                </div>

                {/* Score indices row */}
                {scoresLoading ? (
                    <div className="flex gap-3 mb-3">
                        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-12 rounded-lg bg-white/5" />)}
                    </div>
                ) : latest ? (
                    <div className="flex justify-between mb-3 bg-white/5 rounded-xl p-2.5">
                        <IndexBadge label="Stability" value={latest.physiological_stability} confidence={0.9} />
                        <div className="w-px bg-white/10" />
                        <IndexBadge label="Immune" value={latest.immune_activation} confidence={0.9} />
                        <div className="w-px bg-white/10" />
                        <IndexBadge label="Cardio" value={latest.cardiovascular_strain} confidence={0.9} />
                        <div className="w-px bg-white/10" />
                        <IndexBadge label="Recovery" value={latest.recovery_efficiency} confidence={0.9} />
                    </div>
                ) : (
                    <div className="mb-3 bg-white/5 rounded-xl p-3 text-center">
                        <p className="text-[11px] text-white/50">
                            Log vitals for 7 days to see your personal health indices.
                        </p>
                    </div>
                )}

                {/* Insight text */}
                <div className="min-h-[42px]">
                    {isLoadingInsight ? (
                        <div className="space-y-1.5">
                            <Skeleton className="h-3 w-full rounded bg-white/5" />
                            <Skeleton className="h-3 w-3/4 rounded bg-white/5" />
                        </div>
                    ) : backendInsight ? (
                        <p className="text-[11px] leading-relaxed text-white/80 line-clamp-3">
                            {backendInsight}
                        </p>
                    ) : (
                        <p className="text-[11px] text-white/40 italic">
                            Tap to open your Elite Health Coach.
                        </p>
                    )}
                </div>

                {/* CTA */}
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-[9px] text-violet-300/60 uppercase tracking-widest">
                        Daily Insight
                    </span>
                    <span className="text-[9px] text-violet-300 font-medium flex items-center gap-0.5">
                        View Full Report <ChevronRight className="w-3 h-3" />
                    </span>
                </div>
            </div>
        </div>
    );
}
