import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Shield,
    Search,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    Activity,
    Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { AuditLogRow } from '@/services/AdminRpcService';

const PAGE_SIZE = 50;

export default function AdminAuditLogTab() {
    const [logs, setLogs] = useState<AuditLogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchAction, setSearchAction] = useState('');
    const [page, setPage] = useState(0);
    const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

    const loadAuditLogs = async () => {
        setLoading(true);
        try {
            let query = (supabase as any)
                .from('audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (searchAction.trim()) {
                query = query.ilike('action', `%${searchAction.trim()}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setLogs((data || []) as AuditLogRow[]);
        } catch (err: any) {
            console.error('Error fetching audit logs:', err);
            toast.error(err.message || 'Failed to load system audit log.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAuditLogs();
    }, [page]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(0);
        loadAuditLogs();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">System Audit Log</h2>
                    <p className="text-xs text-muted-foreground">
                        Immutable historical journal of critical administrative and monetary state mutations
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadAuditLogs} disabled={loading} className="gap-1.5 self-start sm:self-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Log
                </Button>
            </div>

            {/* Filter Search */}
            <Card>
                <CardContent className="p-3">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                            <Input
                                placeholder="Filter by action name (e.g. withdrawal, role, setting)..."
                                value={searchAction}
                                onChange={(e) => setSearchAction(e.target.value)}
                                className="pl-9 h-9 text-xs"
                            />
                        </div>
                        <Button type="submit" size="sm" className="h-9 text-xs">
                            Filter
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading audit records...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-16 space-y-2 text-muted-foreground">
                            <Shield className="w-10 h-10 mx-auto opacity-40 text-primary" />
                            <p className="text-sm font-medium">No audit entries found</p>
                            <p className="text-xs">No records matched your action search query.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-muted/30 text-muted-foreground">
                                    <th className="p-3 font-semibold">Timestamp</th>
                                    <th className="p-3 font-semibold">Action</th>
                                    <th className="p-3 font-semibold">Entity Type</th>
                                    <th className="p-3 font-semibold">Entity ID</th>
                                    <th className="p-3 font-semibold">Actor User ID</th>
                                    <th className="p-3 font-semibold">IP Address</th>
                                    <th className="p-3 font-semibold text-right">Payload</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="p-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-3 font-semibold text-foreground font-mono">
                                            {log.action}
                                        </td>
                                        <td className="p-3">
                                            <Badge variant="outline" className="capitalize text-[10px]">
                                                {log.entity_type || 'system'}
                                            </Badge>
                                        </td>
                                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                            {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : '—'}
                                        </td>
                                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                            {log.user_id ? `${log.user_id.slice(0, 8)}...` : 'System / Service'}
                                        </td>
                                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                            {log.ip_address || '—'}
                                        </td>
                                        <td className="p-3 text-right">
                                            {(log.old_values || log.new_values) ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedLog(log)}
                                                    className="h-7 text-xs gap-1"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Diff
                                                </Button>
                                            ) : (
                                                <span className="text-muted-foreground text-[10px]">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>

                {/* Pagination */}
                <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
                    <div>
                        Showing page {page + 1} ({logs.length} entries on page)
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
                            disabled={logs.length < PAGE_SIZE || loading}
                            className="h-8 gap-1"
                        >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Diff / Payload Inspector Modal */}
            {selectedLog && (
                <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle className="font-mono text-sm">Action: {selectedLog.action}</DialogTitle>
                            <DialogDescription className="text-xs">
                                Performed at {new Date(selectedLog.created_at).toLocaleString()}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-2 text-xs">
                            {selectedLog.old_values && (
                                <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground uppercase font-bold">Previous State (old_values)</Label>
                                    <pre className="p-3 bg-muted rounded-lg font-mono text-[11px] overflow-x-auto max-h-40 border">
                                        {JSON.stringify(selectedLog.old_values, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.new_values && (
                                <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground uppercase font-bold">New State (new_values)</Label>
                                    <pre className="p-3 bg-muted rounded-lg font-mono text-[11px] overflow-x-auto max-h-40 border">
                                        {JSON.stringify(selectedLog.new_values, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedLog(null)}>
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
