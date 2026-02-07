import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Order {
    id: string;
    customer: string;
    items: string[];
    total: number;
    status: 'pending' | 'paid' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
    date: string;
    parentOrderId: string;
}

export default function OrderManagement() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }

            const { data: pharmacy } = await supabase
                .from('pharmacies')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!pharmacy) { setLoading(false); return; }

            const { data, error } = await supabase
                .from('child_orders')
                .select(`
                    id, status, total_amount, created_at, parent_order_id,
                    orders:parent_order_id (
                        user_id,
                        profiles:user_id (first_name, last_name)
                    )
                `)
                .eq('pharmacy_id', pharmacy.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch order items for these orders
            const parentOrderIds = [...new Set((data || []).map(d => d.parent_order_id))];
            let itemsByOrder = new Map<string, string[]>();

            if (parentOrderIds.length > 0) {
                const { data: itemsData } = await supabase
                    .from('order_items')
                    .select('order_id, quantity, drugs:drug_id (name)')
                    .eq('pharmacy_id', pharmacy.id)
                    .in('order_id', parentOrderIds);

                (itemsData || []).forEach((item: any) => {
                    const orderId = item.order_id;
                    const itemStr = `${item.drugs?.name || 'Unknown'} (x${item.quantity})`;
                    if (!itemsByOrder.has(orderId)) itemsByOrder.set(orderId, []);
                    itemsByOrder.get(orderId)!.push(itemStr);
                });
            }

            const mapped: Order[] = (data || []).map((d: any) => ({
                id: d.id,
                customer: `${d.orders?.profiles?.first_name || 'Unknown'} ${d.orders?.profiles?.last_name || ''}`.trim(),
                items: itemsByOrder.get(d.parent_order_id) || ['No items listed'],
                total: d.total_amount,
                status: d.status || 'pending',
                date: new Date(d.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }),
                parentOrderId: d.parent_order_id,
            }));

            setOrders(mapped);
        } catch (error) {
            console.error('Error fetching orders:', error);
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (orderId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('child_orders')
                .update({ status: newStatus as any })
                .eq('id', orderId);

            if (error) throw error;

            setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o));
            toast.success("Order Updated", {
                description: `Order moved to ${newStatus.replace(/_/g, ' ')}`
            });
        } catch (error) {
            console.error('Error updating order:', error);
            toast.error('Failed to update order status');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <Badge variant="secondary">Pending</Badge>;
            case 'paid': return <Badge variant="default" className="bg-blue-500">Paid</Badge>;
            case 'processing': return <Badge variant="default" className="bg-purple-500">Processing</Badge>;
            case 'out_for_delivery': return <Badge variant="default" className="bg-orange-500">Out for Delivery</Badge>;
            case 'delivered': return <Badge variant="default" className="bg-green-500">Delivered</Badge>;
            case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {orders.map(order => (
                <Card key={order.id}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20">
                        <div className="flex items-center gap-4">
                            <CardTitle className="text-base">#{order.id.slice(0, 8)}</CardTitle>
                            {getStatusBadge(order.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">{order.date}</div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div>
                                <p className="font-semibold mb-1">{order.customer}</p>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    {order.items.map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-2">
                                            <Package className="w-3 h-3" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className="font-bold text-lg mb-2">₦{order.total.toLocaleString()}</div>
                                <div className="flex gap-2">
                                    {(order.status === 'pending' || order.status === 'paid') && (
                                        <Button size="sm" onClick={() => updateStatus(order.id, 'processing')}>
                                            <Clock className="w-4 h-4 mr-2" />
                                            Start Processing
                                        </Button>
                                    )}
                                    {order.status === 'processing' && (
                                        <Button size="sm" onClick={() => updateStatus(order.id, 'out_for_delivery')}>
                                            <Truck className="w-4 h-4 mr-2" />
                                            Ship Order
                                        </Button>
                                    )}
                                    {order.status === 'out_for_delivery' && (
                                        <Button size="sm" onClick={() => updateStatus(order.id, 'delivered')}>
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Mark Delivered
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}

            {orders.length === 0 && (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">No orders found.</p>
                    <p className="text-xs text-muted-foreground mt-1">Orders from customers will appear here.</p>
                </div>
            )}
        </div>
    );
}