import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Calendar, Truck, CheckCircle, Clock, ShoppingBag, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OrderItem {
    id: string;
    quantity: number;
    unit_price: number;
    drug: {
        name: string;
    };
}

interface Order {
    id: string;
    created_at: string;
    status: 'pending' | 'paid' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
    total_amount: number;
    order_items: OrderItem[];
}

export default function OrderList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    created_at,
                    status,
                    total_amount,
                    order_items (
                        id,
                        quantity,
                        unit_price,
                        drug_id,
                        drugs (
                            name
                        )
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mapped: Order[] = data.map((o: any) => ({
                id: o.id,
                created_at: o.created_at,
                status: o.status,
                total_amount: o.total_amount,
                order_items: o.order_items.map((item: any) => ({
                    id: item.id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    drug: {
                        name: item.drugs?.name || 'Unknown Item'
                    }
                }))
            }));

            setOrders(mapped);
        } catch (error) {
            console.error('Error fetching orders:', error);
            toast.error('Failed to load order history.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
            case 'paid':
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Paid</Badge>;
            case 'processing':
                return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Processing</Badge>;
            case 'out_for_delivery':
                return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Out for Delivery</Badge>;
            case 'delivered':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Delivered</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
            case 'paid':
            case 'processing':
                return <Clock className="w-4 h-4 text-yellow-600" />;
            case 'out_for_delivery':
                return <Truck className="w-4 h-4 text-orange-600" />;
            case 'delivered':
                return <CheckCircle className="w-4 h-4 text-green-600" />;
            default:
                return <Package className="w-4 h-4 text-muted-foreground" />;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-lg mb-2">No orders found</CardTitle>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                        You haven't made any drug purchases yet. Your order history will appear here.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {orders.map((order) => (
                <Card key={order.id} className="overflow-hidden hover:shadow-sm transition-shadow">
                    <CardContent className="p-0">
                        <div className="p-4 border-b bg-muted/10 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-background border">
                                    <Package className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">Order #{order.id.slice(0, 8)}</h3>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="w-3 h-3" />
                                        <span>{format(new Date(order.created_at), 'MMM dd, yyyy')}</span>
                                    </div>
                                </div>
                            </div>
                            {getStatusBadge(order.status)}
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="space-y-2">
                                {order.order_items.map((item) => (
                                    <div key={item.id} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground font-medium">{item.quantity}x</span>
                                            <span>{item.drug.name}</span>
                                        </div>
                                        <span className="font-medium">₦{(item.quantity * item.unit_price).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-3 border-t flex justify-between items-center">
                                <span className="text-sm font-semibold">Total Amount</span>
                                <span className="text-lg font-bold text-primary">₦{order.total_amount.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="px-4 py-3 bg-muted/5 flex gap-2">
                            <Button variant="outline" size="sm" className="w-full text-xs h-8">
                                Order Details
                            </Button>
                            <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1">
                                <Truck className="w-3 h-3" />
                                Track
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
