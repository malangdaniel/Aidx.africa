import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Headphones,
    AlertCircle,
    CheckCircle2,
    Clock,
    User,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    Send
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminRpcService, SupportTicketRow } from '@/services/AdminRpcService';

const PAGE_SIZE = 25;

export default function AdminSupportTab() {
    const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [page, setPage] = useState(0);

    // Selected ticket modal
    const [selectedTicket, setSelectedTicket] = useState<SupportTicketRow | null>(null);
    const [newStatus, setNewStatus] = useState<string>('open');
    const [newPriority, setNewPriority] = useState<string>('medium');
    const [resolutionNote, setResolutionNote] = useState<string>('');
    const [updating, setUpdating] = useState(false);

    const loadTickets = async () => {
        setLoading(true);
        try {
            let query = (supabase as any)
                .from('support_tickets')
                .select('*')
                .order('created_at', { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }
            if (priorityFilter !== 'all') {
                query = query.eq('priority', priorityFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setTickets((data || []) as SupportTicketRow[]);
        } catch (err: any) {
            console.error('Error loading support tickets:', err);
            toast.error(err.message || 'Failed to load support tickets.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, [page, statusFilter, priorityFilter]);

    const handleOpenTicket = (ticket: SupportTicketRow) => {
        setSelectedTicket(ticket);
        setNewStatus(ticket.status || 'open');
        setNewPriority(ticket.priority || 'medium');
        setResolutionNote(ticket.resolution_note || '');
    };

    const handleSaveTicket = async () => {
        if (!selectedTicket) return;
        setUpdating(true);
        try {
            await AdminRpcService.updateTicket({
                ticketId: selectedTicket.id,
                status: newStatus,
                priority: newPriority,
                note: resolutionNote.trim() || null,
            });
            toast.success('Ticket updated successfully.');
            setSelectedTicket(null);
            loadTickets();
        } catch (err: any) {
            console.error('Ticket update error:', err);
            toast.error(err.message || 'Failed to update support ticket.');
        } finally {
            setUpdating(false);
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'urgent':
                return <Badge variant="destructive" className="uppercase font-bold text-[10px]">Urgent</Badge>;
            case 'high':
                return <Badge variant="destructive" className="bg-orange-600 hover:bg-orange-700 text-white uppercase text-[10px]">High</Badge>;
            case 'medium':
                return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30 uppercase text-[10px]">Medium</Badge>;
            default:
                return <Badge variant="secondary" className="uppercase text-[10px]">Low</Badge>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'resolved':
                return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Resolved</Badge>;
            case 'in_review':
                return <Badge variant="outline" className="border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/30">In Review</Badge>;
            case 'dismissed':
                return <Badge variant="outline" className="border-muted text-muted-foreground">Dismissed</Badge>;
            default:
                return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30">Open</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Support Tickets & Inquiries</h2>
                    <p className="text-xs text-muted-foreground">
                        Customer inquiries, clinical dispute reports, and platform technical support
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
                        <SelectTrigger className="w-[140px] text-xs">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_review">In Review</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="dismissed">Dismissed</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={priorityFilter} onValueChange={(val) => { setPriorityFilter(val); setPage(0); }}>
                        <SelectTrigger className="w-[140px] text-xs">
                            <SelectValue placeholder="All Priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priority</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm" onClick={loadTickets} disabled={loading} className="gap-1.5">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading support queue...</p>
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center py-16 space-y-2 text-muted-foreground">
                            <Headphones className="w-10 h-10 mx-auto opacity-40 text-blue-600" />
                            <p className="text-sm font-medium">No support tickets found</p>
                            <p className="text-xs">There are no tickets matching the current status and priority filters.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-muted/30 text-muted-foreground">
                                    <th className="p-3 font-semibold">Ticket ID</th>
                                    <th className="p-3 font-semibold">Subject</th>
                                    <th className="p-3 font-semibold">Category</th>
                                    <th className="p-3 font-semibold">Priority</th>
                                    <th className="p-3 font-semibold">Status</th>
                                    <th className="p-3 font-semibold">Created At</th>
                                    <th className="p-3 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {tickets.map((t) => (
                                    <tr key={t.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                            {t.id.slice(0, 8)}...
                                        </td>
                                        <td className="p-3 font-semibold text-foreground max-w-xs truncate">
                                            {t.subject}
                                        </td>
                                        <td className="p-3">
                                            <Badge variant="outline" className="capitalize text-[10px]">
                                                {t.category?.replace('_', ' ') || 'General'}
                                            </Badge>
                                        </td>
                                        <td className="p-3">
                                            {getPriorityBadge(t.priority)}
                                        </td>
                                        <td className="p-3">
                                            {getStatusBadge(t.status)}
                                        </td>
                                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                                            {new Date(t.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleOpenTicket(t)}
                                                className="h-7 text-xs"
                                            >
                                                Details
                                            </Button>
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
                        Showing page {page + 1} ({tickets.length} tickets listed)
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
                            disabled={tickets.length < PAGE_SIZE || loading}
                            className="h-8 gap-1"
                        >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Ticket Detail Modal */}
            {selectedTicket && (
                <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && !updating && setSelectedTicket(null)}>
                    <DialogContent className="sm:max-w-[540px]">
                        <DialogHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="capitalize text-[10px]">
                                    {selectedTicket.category?.replace('_', ' ')}
                                </Badge>
                                {getPriorityBadge(selectedTicket.priority)}
                            </div>
                            <DialogTitle className="text-base font-bold">{selectedTicket.subject}</DialogTitle>
                            <DialogDescription className="text-xs">
                                Submitted on {new Date(selectedTicket.created_at).toLocaleString()}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            {/* Description block */}
                            <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1.5">
                                <p className="font-semibold text-muted-foreground uppercase text-[10px]">Ticket Description</p>
                                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
                            </div>

                            {/* Linked entities */}
                            {(selectedTicket.consultation_id || selectedTicket.order_id) && (
                                <div className="bg-primary/5 border border-primary/10 p-2.5 rounded-lg text-xs space-y-1 font-mono">
                                    {selectedTicket.consultation_id && (
                                        <p><span className="font-sans text-muted-foreground">Linked Consultation:</span> {selectedTicket.consultation_id}</p>
                                    )}
                                    {selectedTicket.order_id && (
                                        <p><span className="font-sans text-muted-foreground">Linked Order:</span> {selectedTicket.order_id}</p>
                                    )}
                                </div>
                            )}

                            {/* Status & Priority controls */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Status</Label>
                                    <Select value={newStatus} onValueChange={setNewStatus}>
                                        <SelectTrigger className="text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="open">Open</SelectItem>
                                            <SelectItem value="in_review">In Review</SelectItem>
                                            <SelectItem value="resolved">Resolved</SelectItem>
                                            <SelectItem value="dismissed">Dismissed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs">Priority</Label>
                                    <Select value={newPriority} onValueChange={setNewPriority}>
                                        <SelectTrigger className="text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="urgent">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Resolution Note */}
                            <div className="space-y-1.5">
                                <Label htmlFor="ticket-note" className="text-xs">Resolution / Admin Internal Note</Label>
                                <Textarea
                                    id="ticket-note"
                                    placeholder="Add resolution explanation or action items..."
                                    value={resolutionNote}
                                    onChange={(e) => setResolutionNote(e.target.value)}
                                    rows={3}
                                    className="text-xs"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setSelectedTicket(null)} disabled={updating}>
                                Close
                            </Button>
                            <Button onClick={handleSaveTicket} disabled={updating}>
                                {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
