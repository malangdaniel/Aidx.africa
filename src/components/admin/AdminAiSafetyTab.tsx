import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Brain,
    AlertTriangle,
    CheckCircle,
    XCircle,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminRpcService, AdminFlaggedDiagnosisRow } from '@/services/AdminRpcService';

const PAGE_SIZE = 25;

export default function AdminAiSafetyTab() {
    const [diagnoses, setDiagnoses] = useState<AdminFlaggedDiagnosisRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);

    const loadDiagnoses = async () => {
        setLoading(true);
        try {
            const data = await AdminRpcService.listFlaggedDiagnoses({
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });
            setDiagnoses(data);
        } catch (err: any) {
            console.error('Error listing flagged diagnoses:', err);
            toast.error(err.message || 'Failed to load flagged AI safety records.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDiagnoses();
    }, [page]);

    const getSeverityBadge = (severity: string) => {
        const s = severity?.toLowerCase();
        switch (s) {
            case 'critical':
                return <Badge variant="destructive" className="uppercase font-bold text-[10px]">Critical</Badge>;
            case 'high':
                return <Badge variant="destructive" className="bg-orange-600 hover:bg-orange-700 text-white uppercase text-[10px]">High</Badge>;
            case 'medium':
                return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30 uppercase text-[10px]">Medium</Badge>;
            default:
                return <Badge variant="secondary" className="uppercase text-[10px]">Low</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">AI Diagnostic Safety</h2>
                    <p className="text-xs text-muted-foreground">
                        Audit high-risk, low-confidence, or clinician-flagged AI diagnostic evaluations
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadDiagnoses} disabled={loading} className="gap-1.5 self-start sm:self-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading AI audit logs...</p>
                        </div>
                    ) : diagnoses.length === 0 ? (
                        <div className="text-center py-16 space-y-2 text-muted-foreground">
                            <Brain className="w-10 h-10 mx-auto opacity-40 text-purple-600" />
                            <p className="text-sm font-medium">No flagged diagnoses found</p>
                            <p className="text-xs">No clinical AI outputs have been flagged for administrative review.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-muted/30 text-muted-foreground">
                                    <th className="p-3 font-semibold">Diagnosis ID</th>
                                    <th className="p-3 font-semibold">Condition Identified</th>
                                    <th className="p-3 font-semibold">Severity</th>
                                    <th className="p-3 font-semibold">AI Confidence</th>
                                    <th className="p-3 font-semibold">Flag Reason</th>
                                    <th className="p-3 font-semibold">Doctor Review</th>
                                    <th className="p-3 font-semibold">Agreement</th>
                                    <th className="p-3 font-semibold">Date Flagged</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {diagnoses.map((d) => {
                                    const isReviewed = Boolean(d.reviewed_at);

                                    return (
                                        <tr key={d.id} className="hover:bg-muted/10 transition-colors">
                                            <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                                {d.id.slice(0, 8)}...
                                            </td>
                                            <td className="p-3 font-semibold text-foreground">
                                                {d.condition}
                                            </td>
                                            <td className="p-3">
                                                {getSeverityBadge(d.severity)}
                                            </td>
                                            <td className="p-3 font-mono font-medium">
                                                {d.confidence_percentage ? `${Number(d.confidence_percentage).toFixed(0)}%` : '—'}
                                            </td>
                                            <td className="p-3 text-muted-foreground max-w-xs truncate" title={d.flag_reason}>
                                                {d.flag_reason || '—'}
                                            </td>
                                            <td className="p-3">
                                                {isReviewed ? (
                                                    <Badge variant="outline" className="border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 gap-1 text-[10px]">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Reviewed
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30 gap-1 text-[10px]">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Unreviewed
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                {d.doctor_agreed === true && (
                                                    <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> Agreed
                                                    </span>
                                                )}
                                                {d.doctor_agreed === false && (
                                                    <span className="text-destructive font-semibold text-[11px] flex items-center gap-1">
                                                        <XCircle className="w-3 h-3" /> Disagreed
                                                    </span>
                                                )}
                                                {d.doctor_agreed === null && isReviewed && (
                                                    <span className="text-muted-foreground text-[11px]">Reviewed (Neutral)</span>
                                                )}
                                                {!isReviewed && (
                                                    <span className="text-muted-foreground text-[11px]">—</span>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap text-muted-foreground">
                                                {new Date(d.created_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </CardContent>

                {/* Pagination */}
                <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
                    <div>
                        Showing page {page + 1} ({diagnoses.length} flagged diagnoses listed)
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0 || loading}
                            className="h-8 gap-1"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={diagnoses.length < PAGE_SIZE || loading}
                            className="h-8 gap-1"
                        >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
