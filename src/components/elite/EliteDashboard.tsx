/**
 * EliteDashboard — Full-page Premium Health Coach dashboard.
 * Shows 4 health indices with trend arrows + confidence, daily insight,
 * AI coach chat, alert escalation, Recharts time-series, and vitals entry form.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Sparkles, Activity, Heart, Shield, Zap, TrendingUp, TrendingDown, Minus,
    ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Bluetooth, FileText,
    Stethoscope, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    useLatestScores, useActiveAlerts, useRecentNormalizedVitals, useResolveAlert,
    useComputeScores, useGenerateClinicalPacket, useActiveAlertEvents,
    useStabilityHistory,
} from '@/services/elite/EliteApi';
import { useEliteVitals } from '@/hooks/useEliteVitals';
import { ConsultationService } from '@/services/ConsultationService';
import { dailyInsightPrompt } from '@/services/elite/elitePrompts';
import type { EliteScores, EliteAlert, AlertEvent } from '@/services/EliteService';
import VitalsEntryForm from './VitalsEntryForm';
import EliteCoachChat from './EliteCoachChat';
import { AlertEventBanner } from './AlertEventBanner';

// =============================================================================
// Score Index Card
// =============================================================================

interface ScoreCardProps {
    label: string;
    sublabel: string;
    icon: React.FC<{ className?: string }>;
    value: number | null;
    prev?: number | null;
    confidence: number;
    color: string;       // tailwind gradient class
    inverse?: boolean;      // if true, lower = better (default higher = better)
}

function ScoreCard({ label, sublabel, icon: Icon, value, prev, confidence, color }: ScoreCardProps) {
    const pct = value ?? 100;

    // New model: 100 is perfect, lower is worse
    const isGood = pct >= 85;
    const isFair = pct >= 70 && pct < 85;
    const isAttention = pct < 70;

    const statusColor = isGood ? 'text-emerald-400' : isFair ? 'text-amber-400' : 'text-rose-400';
    const statusLabel = isGood ? 'Optimal' : isFair ? 'Stable' : 'Attention';

    const delta = (value !== null && prev !== null && prev !== undefined) ? value - prev : null;

    return (
        <div className={cn(
            'relative overflow-hidden rounded-2xl p-4',
            'bg-gradient-to-br from-white/8 to-white/3',
            'border border-white/10',
            'transition-all duration-200 hover:border-white/20'
        )}>
            {/* Background glow based on status */}
            <div className={cn(
                'absolute inset-0 opacity-10 pointer-events-none',
                isGood ? 'bg-emerald-500' : isFair ? 'bg-amber-500' : 'bg-rose-500'
            )} />

            <div className="relative">
                <div className="flex items-start justify-between mb-2">
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br', color)}>
                        <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-1">
                        {delta !== null && (
                            delta > 2 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> :
                                delta < -2 ? <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> :
                                    <Minus className="w-3.5 h-3.5 text-white/40" />
                        )}
                        <span className={cn('text-xs font-bold', statusColor)}>{statusLabel}</span>
                    </div>
                </div>

                <div className="text-2xl font-bold text-white tabular-nums mb-0.5">
                    {value !== null ? value : '–'}
                    <span className="text-xs text-white/40 font-normal ml-1">/100</span>
                </div>

                <div className="text-xs font-semibold text-white/80 mb-0.5">{label}</div>
                <div className="text-[10px] text-white/40 mb-2">{sublabel}</div>

                {/* Progress bar */}
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            'h-full rounded-full transition-all duration-500',
                            isGood ? 'bg-emerald-400' : isFair ? 'bg-amber-400' : 'bg-rose-400'
                        )}
                        style={{ width: `${pct}%` }}
                    />
                </div>

                <div className="mt-1 text-[9px] text-white/30">
                    Confidence: {Math.round(confidence * 100)}%
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// Early Warning Banner
// =============================================================================
function EarlyWarningBanner({ warning }: { warning: any }) {
    if (!warning || !warning.active) return null;

    return (
        <div className="rounded-2xl p-4 bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-indigo-200 mb-1">
                    Companion Insight
                </div>
                <p className="text-[11px] text-indigo-100/70 leading-relaxed">{warning.message}</p>
            </div>
        </div>
    );
}

// =============================================================================
// Alert Banner
// =============================================================================
function AlertBanner({ alerts, onOpenConsult }: { alerts: EliteAlert[]; onOpenConsult: (a: EliteAlert) => void }) {
    if (!alerts.length) return null;
    const highest = alerts[0];
    const isCritical = highest.alert_level === 'critical';

    return (
        <div className={cn(
            'rounded-2xl p-4 border flex items-start gap-3',
            isCritical
                ? 'bg-rose-950/60 border-rose-500/60'
                : 'bg-amber-950/50 border-amber-500/40'
        )}>
            <AlertTriangle className={cn('w-5 h-5 flex-shrink-0 mt-0.5', isCritical ? 'text-rose-400' : 'text-amber-400')} />
            <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white mb-1">
                    {isCritical ? '🚨 Attention Required' : '⚠️ Health Notice'}
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">{highest.reason}</p>
                <p className="text-[10px] text-white/40 mt-1">
                    This is not a diagnosis. Please speak with a healthcare provider for medical advice.
                </p>
            </div>
            <Button
                size="sm"
                onClick={() => onOpenConsult(highest)}
                className="flex-shrink-0 text-[11px] h-8 px-3 bg-rose-600/80 hover:bg-rose-600 border-0 rounded-xl"
            >
                <Stethoscope className="w-3 h-3 mr-1" /> Book Doctor
            </Button>
        </div>
    );
}

// =============================================================================
// Recharts time-series component
// =============================================================================
function MetricsChart({ vitals }: { vitals: any[] }) {
    // Pivot vitals data for Recharts: [{time, heart_rate, spo2, ...}]
    const chartData = vitals
        .reduce((acc: Record<string, any>[], v) => {
            const dateKey = new Date(v.timestamp).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
            const existing = acc.find(r => r.date === dateKey);
            if (existing) {
                existing[v.metric] = +v.normalized_value.toFixed(1);
            } else {
                acc.push({ date: dateKey, [v.metric]: +v.normalized_value.toFixed(1) });
            }
            return acc;
        }, [])
        .reverse()
        .slice(-14);

    const metricConfig: Array<{ key: string; color: string; label: string }> = [
        { key: 'heart_rate', color: '#f472b6', label: 'HR (bpm)' },
        { key: 'spo2', color: '#60a5fa', label: 'SpO₂ (%)' },
        { key: 'temperature', color: '#fb923c', label: 'Temp (°C)' },
        { key: 'systolic_bp', color: '#a78bfa', label: 'Systolic' },
    ].filter(m => chartData.some(d => d[m.key] != null));

    if (chartData.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-xs text-white/40">No vitals data to chart yet.</p>
            </div>
        );
    }

    return (
        <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} />
                    <Tooltip
                        contentStyle={{ background: '#1e0a4a', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, fontSize: 11 }}
                        labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }} />
                    {metricConfig.map(m => (
                        <Line key={m.key} type="monotone" dataKey={m.key} name={m.label}
                            stroke={m.color} strokeWidth={1.5} dot={false} connectNulls />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// =============================================================================
// EliteDashboard — Main component
// =============================================================================
export default function EliteDashboard() {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showEntryForm, setShowEntryForm] = useState(false);

    const { data: scores } = useLatestScores(7);
    const { data: alerts } = useActiveAlerts();
    const { data: alertEvents } = useActiveAlertEvents();
    const { data: vitals } = useRecentNormalizedVitals(7);
    const { data: stabilityHistory } = useStabilityHistory(7);
    const resolveAlert = useResolveAlert();
    const computeScores = useComputeScores();
    const genPacket = useGenerateClinicalPacket();

    const { ingestVitals, isIngesting, syncWearable } = useEliteVitals();

    const latest = scores?.[0] ?? null;
    const prev = scores?.[1] ?? null;
    const hasData = !!latest;

    // --- Insights from backend scores -------------------------------------------
    const todayInsight = latest?.confidence_json?.insight ??
        (hasData ? "Stay consistent with your vitals tracking to see more detailed insights." : null);
    const guidance = latest?.confidence_json?.guidance ?? null;
    const severity = latest?.confidence_json?.severity ?? 'normal';
    const earlyWarning = latest?.confidence_json?.early_warning ?? null;

    // --- Handle doctor escalation -------------------------------------------
    const handleBookDoctor = async (alert: EliteAlert) => {
        try {
            const packet = await genPacket.mutateAsync(alert.score_id ?? undefined);
            const packetNote = [
                '--- AiDx Elite Clinical Packet ---',
                `Generated: ${packet.generatedAt}`,
                `Scores: Physio=${packet.scores?.physiological_stability ?? 'N/A'}, Immune=${packet.scores?.immune_activation ?? 'N/A'}, Cardio=${packet.scores?.cardiovascular_strain ?? 'N/A'}, Recovery=${packet.scores?.recovery_efficiency ?? 'N/A'}`,
                `Alert: [${alert.alert_level.toUpperCase()}] ${alert.reason}`,
                '--- END ---',
            ].join('\n');

            await (ConsultationService as any).openFromElite?.({ ...packet, geminiSummary: packetNote });
            toast.success('Consultation prefilled from Elite Health data. Opening doctor search…');
        } catch (err: any) {
            toast.error(err.message ?? 'Unable to open consultation at this time.');
        }
    };

    // --- Wearable sync -------------------------------------------------------
    const handleSync = async () => {
        const result = await syncWearable();
        if (result.synced > 0) {
            toast.success(`Synced ${result.synced} data points from ${result.source}.`);
            computeScores.mutate();
        } else {
            toast.info('No new wearable data found. You can log vitals manually below.');
        }
    };

    // =========================================================================
    return (
        <div className="min-h-screen bg-[#0d0421] text-white">
            {/* ---------- Header ---------- */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-indigo-900/30 to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-72 h-72 bg-violet-600/8 rounded-full blur-3xl -translate-y-1/4 translate-x-1/4 pointer-events-none" />

                <div className="relative px-4 pt-5 pb-4">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/60">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-base font-bold tracking-tight">AiDx Elite</h1>
                                <p className="text-[10px] text-violet-300/70">Premium Health Coach</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleSync}
                                className="h-7 px-2.5 text-[10px] text-violet-300/70 hover:text-violet-200 hover:bg-white/5"
                            >
                                <Bluetooth className="w-3 h-3 mr-1" /> Sync
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => computeScores.mutate()}
                                className="h-7 px-2.5 text-[10px] text-violet-300/70 hover:text-violet-200 hover:bg-white/5"
                            >
                                <RefreshCw className={cn('w-3 h-3', computeScores.isPending && 'animate-spin')} />
                            </Button>
                        </div>
                    </div>

                    {/* Warm-up notice */}
                    {!hasData && (
                        <div className="mt-3 flex gap-2 items-start bg-white/5 border border-white/10 rounded-xl p-3">
                            <Info className="w-4 h-4 text-violet-300/70 flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-white/60 leading-relaxed">
                                Log vitals daily for 7 days to build your personal baseline and see your health indices.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ---------- Stability Index Hero ---------- */}
            <div className="px-4">
                {latest?.stability_index ? (
                    <StabilityHero index={latest.stability_index} />
                ) : (
                    <div className="rounded-3xl p-6 bg-white/5 border border-white/10 mb-4 animate-pulse">
                        <div className="h-4 w-24 bg-white/10 rounded mb-4" />
                        <div className="h-8 w-16 bg-white/10 rounded mb-4" />
                        <div className="h-12 w-full bg-white/10 rounded" />
                    </div>
                )}
            </div>

            {/* ---------- Alert Banner ---------- */}
            {(alerts && alerts.length > 0) || (alertEvents && alertEvents.length > 0) || (earlyWarning && earlyWarning.active) ? (
                <div className="px-4 mb-2 space-y-2">
                    {alertEvents && alertEvents.map(ae => (
                        <AlertEventBanner
                            key={ae.id}
                            alert={ae}
                            onOpenConsult={handleBookDoctor}
                        />
                    ))}
                    {(alertEvents?.length === 0) && alerts && alerts.length > 0 && (
                        <AlertBanner alerts={alerts} onOpenConsult={handleBookDoctor} />
                    )}
                    {earlyWarning && earlyWarning.active && (
                        <EarlyWarningBanner warning={earlyWarning} />
                    )}
                </div>
            ) : null}

            {/* ---------- 4 Score Indices ---------- */}
            <div className="px-4 pb-3">
                <div className="grid grid-cols-2 gap-2.5">
                    <ScoreCard
                        label="Stability" sublabel="Physiological balance"
                        icon={Activity} value={latest?.physiological_stability ?? null}
                        prev={prev?.physiological_stability}
                        confidence={latest?.confidence_json?.physiological_stability ?? 0.5}
                        color="from-violet-500 to-indigo-600"
                    />
                    <ScoreCard
                        label="Immune" sublabel="Activation status"
                        icon={Shield} value={latest?.immune_activation ?? null}
                        prev={prev?.immune_activation}
                        confidence={latest?.confidence_json?.immune_activation ?? 0.5}
                        color="from-rose-500 to-pink-600"
                    />
                    <ScoreCard
                        label="Cardio" sublabel="Cardiovascular strain"
                        icon={Heart} value={latest?.cardiovascular_strain ?? null}
                        prev={prev?.cardiovascular_strain}
                        confidence={latest?.confidence_json?.cardiovascular_strain ?? 0.5}
                        color="from-red-500 to-rose-600"
                    />
                    <ScoreCard
                        label="Recovery" sublabel="Restoration efficiency"
                        icon={Zap} value={latest?.recovery_efficiency ?? null}
                        prev={prev?.recovery_efficiency}
                        confidence={latest?.confidence_json?.recovery_efficiency ?? 0.5}
                        color="from-emerald-500 to-teal-600"
                    />
                </div>

                {/* Score date */}
                {latest && (
                    <p className="text-center text-[10px] text-white/30 mt-2">
                        Last computed: {new Date(latest.computed_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                )}
            </div>

            {/* ---------- AI Coach Chat ---------- */}
            <div className="px-4 pb-3">
                <div className="bg-gradient-to-br from-[#1a0a35] to-[#110730] border border-violet-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-violet-400" />
                        <span className="text-xs font-semibold text-white/80">Your Coach</span>
                    </div>

                    {guidance && (
                        <div className="mb-4 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                            <p className="text-[11px] text-violet-200 font-medium mb-1">Recommended for you:</p>
                            <p className="text-[11px] text-white/80 leading-relaxed">{guidance}</p>
                        </div>
                    )}

                    <EliteCoachChat
                        todayInsight={todayInsight}
                        latestScores={latest}
                    />
                </div>
            </div>

            {/* ---------- Log Vitals Form ---------- */}
            <div className="px-4 pb-3">
                <button
                    onClick={() => setShowEntryForm(v => !v)}
                    className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/8 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-violet-400" />
                        <span className="text-xs font-semibold text-white/80">Log Vitals Manually</span>
                    </div>
                    {showEntryForm ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                </button>

                {showEntryForm && (
                    <div className="mt-2 bg-gradient-to-br from-[#1a0a35] to-[#110730] border border-violet-500/20 rounded-2xl p-4">
                        <VitalsEntryForm onSubmit={ingestVitals} isLoading={isIngesting} />
                    </div>
                )}
            </div>

            {/* ---------- Advanced Data (Recharts) ---------- */}
            <div className="px-4 pb-6">
                <button
                    onClick={() => setShowAdvanced(v => !v)}
                    className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/8 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-semibold text-white/80">Advanced Metrics</span>
                    </div>
                    {showAdvanced ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                </button>

                {showAdvanced && vitals && (
                    <div className="mt-2 bg-gradient-to-br from-[#1a0a35] to-[#110730] border border-violet-500/20 rounded-2xl p-4">
                        <p className="text-[10px] text-white/40 mb-3 uppercase tracking-widest">7-Day Vital Trends</p>
                        <MetricsChart vitals={vitals} />

                        {/* Score history table */}
                        {scores && scores.length > 1 && (
                            <div className="mt-4">
                                <p className="text-[10px] text-white/40 mb-2 uppercase tracking-widest">Score History</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[10px] text-white/60">
                                        <thead>
                                            <tr className="border-b border-white/10">
                                                <th className="text-left py-1.5 pr-2">Date</th>
                                                <th className="text-right px-1">Stability</th>
                                                <th className="text-right px-1">Immune</th>
                                                <th className="text-right px-1">Cardio</th>
                                                <th className="text-right pl-1">Recovery</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scores.slice(0, 7).map(s => (
                                                <tr key={s.id} className="border-b border-white/5">
                                                    <td className="py-1.5 pr-2 text-white/40">{s.score_date}</td>
                                                    <td className="text-right px-1 text-violet-300">{s.physiological_stability ?? '–'}</td>
                                                    <td className="text-right px-1 text-rose-300">{s.immune_activation ?? '–'}</td>
                                                    <td className="text-right px-1 text-red-300">{s.cardiovascular_strain ?? '–'}</td>
                                                    <td className="text-right pl-1 text-emerald-300">{s.recovery_efficiency ?? '–'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
