import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Order {
    id: string;
    customer: string;
    items: string[];
    total: number;
    status: 'new' | 'processing' | 'shipped' | 'delivered';
    date: string;
}

const MOCK_ORDERS: Order[] = [
    {
        id: 'ORD-001',
        customer: 'John Doe',
        items: ['Paracetamol 500mg (x1)', 'Vitamin C 1000mg (x2)'],
        total: 5500,
        status: 'new',
        date: 'Today, 2:30 PM'
    },
    {
        id: 'ORD-002',
        customer: 'Jane Smith',
        items: ['Amoxicillin 500mg (x1)'],
        total: 1500,
        status: 'processing',
        date: 'Today, 1:00 PM'
    },
];

export default function OrderManagement() {
    const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);

    const updateStatus = (orderId: string, newStatus: Order['status']) => {
        setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        toast.success("Order Updated", {
            description: `Order ${orderId} moved to ${newStatus}`
        });
    };

    const getStatusBadge = (status: Order['status']) => {
        switch (status) {
            case 'new': return <Badge variant="secondary">New</Badge>;
            case 'processing': return <Badge variant="default" className="bg-blue-500">Processing</Badge>;
            case 'shipped': return <Badge variant="default" className="bg-purple-500">Shipped</Badge>;
            case 'delivered': return <Badge variant="default" className="bg-green-500">Delivered</Badge>;
        }
    };

    return (
        <div className="space-y-4">
            {orders.map(order => (
                <Card key={order.id}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20">
                        <div className="flex items-center gap-4">
                            <CardTitle className="text-base">{order.id}</CardTitle>
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
                                    {order.status === 'new' && (
                                        <Button size="sm" onClick={() => updateStatus(order.id, 'processing')}>
                                            <Clock className="w-4 h-4 mr-2" />
                                            Start Processing
                                        </Button>
                                    )}
                                    {order.status === 'processing' && (
                                        <Button size="sm" onClick={() => updateStatus(order.id, 'shipped')}>
                                            <Truck className="w-4 h-4 mr-2" />
                                            Mark Shipped
                                        </Button>
                                    )}
                                    {order.status === 'shipped' && (
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
                    <p className="text-muted-foreground">No orders found.</p>
                </div>
            )}
        </div>
    );
}
