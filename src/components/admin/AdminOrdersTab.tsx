import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    ShoppingCart,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    AlertCircle,
    FileCheck2,
    Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminRpcService, AdminOrderRow } from '@/services/AdminRpcService';

const PAGE_SIZE = 25;

export default function AdminOrdersTab() {
    const [orders, setOrders] = useState<AdminOrderRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(0);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const data = await AdminRpcService.listOrders({
                status: statusFilter === 'all' ? null : statusFilter,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });
            setOrders(data);
        } catch (err: any) {
            console.error('Error listing orders:', err);
            toast.error(err.message || 'Failed to load pharmacy orders.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, [page, statusFilter]);

    const getTrackingBadge = (trackingStatus: string) => {
        switch (trackingStatus) {
            case 'delivered':
                return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Delivered</Badge>;
            case 'out_for_delivery':
                return <Badge variant="default" className="bg-blue-600">Out for Delivery</Badge>;
            case 'ready_for_dispatch':
                return <Badge variant="outline" className="border-indigo-400 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30">Ready for Dispatch</Badge>;
            case 'processing':
                return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30">Processing</Badge>;
            case 'prescription_review':
                return <Badge variant="outline" className="border-purple-400 text-purple-700 bg-purple-50 dark:bg-purple-950/30">Rx Review</Badge>;
            case 'cancelled':
            case 'rejected':
                return <Badge variant="destructive" className="capitalize">{trackingStatus}</Badge>;
            default:
                return <Badge variant="outline">{trackingStatus?.replace('_', ' ') || 'Received'}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Pharmacy Orders</h2>
                    <p className="text-xs text-muted-foreground">
                        Order logistics, prescription verifications, and pharmacy settlement tracking
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
                        <SelectTrigger className="w-[180px] text-xs">
                            <SelectValue placeholder="All Tracking Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tracking Status</SelectItem>
                            <SelectItem value="order_received">Order Received</SelectItem>
                            <SelectItem value="prescription_review">Prescription Review</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="ready_for_dispatch">Ready for Dispatch</SelectItem>
                            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading} className="gap-1.5">
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
                            <p className="text-sm text-muted-foreground">Loading orders...</p>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-16 space-y-2 text-muted-foreground">
                            <ShoppingCart className="w-10 h-10 mx-auto opacity-40" />
                            <p className="text-sm font-medium">No pharmacy orders found</p>
                            <p className="text-xs">No records match the current status filter.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-muted/30 text-muted-foreground">
                                    <th className="p-3 font-semibold">Sub-Order ID</th>
                                    <th className="p-3 font-semibold">Buyer</th>
                                    <th className="p-3 font-semibold">Pharmacy</th>
                                    <th className="p-3 font-semibold">Total</th>
                                    <th className="p-3 font-semibold">Rx / Prescription</th>
                                    <th className="p-3 font-semibold">Tracking Status</th>
                                    <th className="p-3 font-semibold">Settlement</th>
                                    <th className="p-3 font-semibold">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {orders.map((o) => {
                                    const isLegacySettlement = o.settlement_status === 'legacy';
                                    const hasRx = Boolean(o.has_rx_items);

                                    return (
                                        <tr
                                            key={o.child_order_id}
                                            className={`transition-colors hover:bg-muted/10 ${hasRx ? 'bg-purple-50/20 dark:bg-purple-950/10' : ''
                                                } ${isLegacySettlement ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''}`}
                                        >
                                            <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                                {o.child_order_id.slice(0, 8)}...
                                            </td>
                                            <td className="p-3 font-semibold text-foreground">
                                                {o.buyer_name || 'Customer'}
                                            </td>
                                            <td className="p-3 text-foreground">
                                                {o.pharmacy_name || 'Fulfilling Pharmacy'}
                                            </td>
                                            <td className="p-3 font-bold text-foreground">
                                                ₦{Number(o.total_amount || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                {hasRx ? (
                                                    <Badge variant="outline" className="border-purple-500 text-purple-700 bg-purple-50 dark:bg-purple-950/40 gap-1 font-semibold">
                                                        <FileCheck2 className="w-3 h-3" />
                                                        Rx Required
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">OTC</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                {getTrackingBadge(o.tracking_status)}
                                            </td>
                                            <td className="p-3">
                                                {isLegacySettlement ? (
                                                    <Badge variant="destructive" className="bg-amber-600 text-white hover:bg-amber-700 text-[10px]">
                                                        Legacy Settlement
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="capitalize text-[10px]">
                                                        {o.settlement_status || 'Escrow'}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap text-muted-foreground">
                                                {new Date(o.created_at).toLocaleDateString()}
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
                        Showing page {page + 1} ({orders.length} orders listed)
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
                            disabled={orders.length < PAGE_SIZE || loading}
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
