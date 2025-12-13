import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Minus, Search, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
    id: string;
    name: string;
    category: string;
    price: number;
    image: string;
    requiresPrescription: boolean;
}

const PRODUCTS: Product[] = [
    {
        id: '1',
        name: 'Paracetamol 500mg',
        category: 'Pain Relief',
        price: 500,
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=2030&auto=format&fit=crop',
        requiresPrescription: false
    },
    {
        id: '2',
        name: 'Amoxicillin 500mg',
        category: 'Antibiotics',
        price: 1500,
        image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?q=80&w=2070&auto=format&fit=crop',
        requiresPrescription: true
    },
    {
        id: '3',
        name: 'Vitamin C 1000mg',
        category: 'Supplements',
        price: 2500,
        image: 'https://images.unsplash.com/photo-1550572017-07f95de33575?q=80&w=2000&auto=format&fit=crop',
        requiresPrescription: false
    },
    {
        id: '4',
        name: 'Ibuprofen 400mg',
        category: 'Pain Relief',
        price: 800,
        image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?q=80&w=2070&auto=format&fit=crop',
        requiresPrescription: false
    }
];

export default function MedicationMarketplace() {
    const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
    const [activeTab, setActiveTab] = useState<'shop' | 'cart' | 'orders'>('shop');

    const addToCart = (product: Product) => {
        const existing = cart.find(item => item.product.id === product.id);
        if (existing) {
            setCart(cart.map(item =>
                item.product.id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, { product, quantity: 1 }]);
        }
        toast.success("Added to Cart", {
            description: `${product.name} added.`
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.product.id === productId) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    const handleCheckout = () => {
        setActiveTab('orders');
        setCart([]);
        toast.success("Order Placed Successfully!", {
            description: "Your medications will be delivered shortly."
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex bg-muted p-1 rounded-lg w-fit">
                <Button
                    variant={activeTab === 'shop' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('shop')}
                >
                    Shop
                </Button>
                <Button
                    variant={activeTab === 'cart' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('cart')}
                    className="relative"
                >
                    Cart
                    {cart.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                            {cart.reduce((a, b) => a + b.quantity, 0)}
                        </span>
                    )}
                </Button>
                <Button
                    variant={activeTab === 'orders' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('orders')}
                >
                    My Orders
                </Button>
            </div>

            {activeTab === 'shop' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {PRODUCTS.map(product => (
                        <Card key={product.id} className="overflow-hidden flex flex-col">
                            <div className="h-40 bg-gray-100 relative">
                                <img
                                    src={product.image}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                />
                                {product.requiresPrescription && (
                                    <Badge variant="destructive" className="absolute top-2 right-2 text-[10px]">
                                        Rx Required
                                    </Badge>
                                )}
                            </div>
                            <CardContent className="p-4 flex-1">
                                <div className="text-xs text-muted-foreground mb-1">{product.category}</div>
                                <h3 className="font-semibold">{product.name}</h3>
                                <div className="font-bold text-lg mt-1">₦{product.price.toLocaleString()}</div>
                            </CardContent>
                            <CardFooter className="p-4 pt-0">
                                <Button className="w-full" onClick={() => addToCart(product)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {activeTab === 'cart' && (
                <Card>
                    <CardHeader><CardTitle>Shopping Cart</CardTitle></CardHeader>
                    <CardContent>
                        {cart.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Your cart is empty.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {cart.map(item => (
                                    <div key={item.product.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 bg-muted rounded overflow-hidden">
                                                <img src={item.product.image} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">{item.product.name}</h4>
                                                <p className="text-sm text-muted-foreground">₦{item.product.price.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center border rounded-md">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" onClick={() => updateQuantity(item.product.id, -1)}>
                                                    <Minus className="w-3 h-3" />
                                                </Button>
                                                <span className="w-8 text-center text-sm">{item.quantity}</span>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" onClick={() => updateQuantity(item.product.id, 1)}>
                                                    <Plus className="w-3 h-3" />
                                                </Button>
                                            </div>
                                            <div className="font-bold w-20 text-right">₦{(item.product.price * item.quantity).toLocaleString()}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                    {cart.length > 0 && (
                        <CardFooter className="flex justify-between items-center border-t bg-muted/20 p-6">
                            <div className="text-lg">
                                Total: <span className="font-bold">₦{total.toLocaleString()}</span>
                            </div>
                            <Button size="lg" onClick={handleCheckout}>Checkout</Button>
                        </CardFooter>
                    )}
                </Card>
            )}

            {activeTab === 'orders' && (
                <Card>
                    <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="border rounded-lg p-4">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                                    <div>
                                        <span className="text-sm text-muted-foreground">Order #12345</span>
                                        <div className="text-sm text-muted-foreground">Dec 12, 2024</div>
                                    </div>
                                    <Badge className="bg-blue-500 hover:bg-blue-600">Processing</Badge>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Package className="w-4 h-4 text-muted-foreground" />
                                        <span>Paracetamol 500mg x 1</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Package className="w-4 h-4 text-muted-foreground" />
                                        <span>Vitamin C 1000mg x 2</span>
                                    </div>
                                </div>
                                <div className="pt-4 mt-2 flex justify-end">
                                    <Button variant="outline" size="sm">Track Order</Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
