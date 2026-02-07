
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Navigation, ShoppingCart, Plus, Minus, Trash2, CreditCard, Loader2 } from "lucide-react";
import { PharmacyService, InventoryItem, Pharmacy } from "@/services/PharmacyService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CartItem {
    inventoryItem: InventoryItem;
    pharmacy: Pharmacy;
    quantity: number;
}

export default function MedicationMarketplace() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<{ item: InventoryItem; pharmacy: Pharmacy; distance?: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [shippingAddress, setShippingAddress] = useState("");

    // Mock User Location (Lagos Mainland)
    const userLocation = { lat: 6.5244, lng: 3.3792 };

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;

        setLoading(true);
        setHasSearched(true);
        try {
            const data = await PharmacyService.searchDrugs(searchTerm, userLocation);
            setResults(data);
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item: InventoryItem, pharmacy: Pharmacy) => {
        setCart(prev => {
            const existing = prev.find(c => c.inventoryItem.id === item.id);
            if (existing) {
                return prev.map(c => c.inventoryItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
            }
            return [...prev, { inventoryItem: item, pharmacy, quantity: 1 }];
        });
        toast.success("Added to cart");
    };

    const updateQuantity = (itemId: string, delta: number) => {
        setCart(prev => prev.map(c => {
            if (c.inventoryItem.id === itemId) {
                const newQty = Math.max(1, c.quantity + delta);
                // Check stock limit if needed (item.stock)
                if (newQty > c.inventoryItem.stock) {
                    toast.error("Max stock reached");
                    return c;
                }
                return { ...c, quantity: newQty };
            }
            return c;
        }));
    };

    const removeFromCart = (itemId: string) => {
        setCart(prev => prev.filter(c => c.inventoryItem.id !== itemId));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.inventoryItem.price * item.quantity), 0);

    const handleCheckout = async () => {
        if (!user) {
            toast.error("Please login to checkout");
            return;
        }
        if (!shippingAddress.trim()) {
            toast.error("Please enter a shipping address");
            return;
        }

        try {
            setIsCheckingOut(true);
            const itemsToBuy = cart.map(c => ({
                drugId: c.inventoryItem.drugId,
                quantity: c.quantity,
                price: c.inventoryItem.price
            }));

            await PharmacyService.checkout(user.id, itemsToBuy, cartTotal, shippingAddress);

            toast.success("Order placed successfully!");
            setCart([]);
            setIsCartOpen(false);
            setShippingAddress("");
        } catch (error) {
            console.error("Checkout failed", error);
            toast.error("Failed to place order. Please try again.");
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-1 max-w-lg">
                    <Input
                        placeholder="Search for medications (e.g., Paracetamol)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="flex-1"
                    />
                    <Button onClick={handleSearch} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                        Search
                    </Button>
                </div>

                <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="relative">
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Cart
                            {cart.length > 0 && (
                                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 rounded-full">
                                    {cart.length}
                                </Badge>
                            )}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Shopping Cart</DialogTitle>
                            <DialogDescription>Review your items before checkout.</DialogDescription>
                        </DialogHeader>

                        {cart.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Your cart is empty</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <ScrollArea className="h-[240px] pr-4">
                                    <div className="space-y-3">
                                        {cart.map((item) => (
                                            <div key={item.inventoryItem.id} className="flex justify-between items-start space-x-2 border-b pb-3 last:border-0">
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-bold">{item.inventoryItem.drug.name}</h4>
                                                    <p className="text-xs text-muted-foreground">{item.pharmacy.name}</p>
                                                    <p className="text-xs font-medium text-primary mt-1">₦{item.inventoryItem.price.toLocaleString()}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.inventoryItem.id, -1)}>
                                                            <Minus className="w-3 h-3" />
                                                        </Button>
                                                        <span className="text-xs w-4 text-center">{item.quantity}</span>
                                                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.inventoryItem.id, 1)}>
                                                            <Plus className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => removeFromCart(item.inventoryItem.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <Separator />
                                <div className="space-y-2">
                                    <Label>Shipping Address</Label>
                                    <Input
                                        placeholder="Enter delivery address"
                                        value={shippingAddress}
                                        onChange={(e) => setShippingAddress(e.target.value)}
                                    />
                                </div>
                                <div className="flex justify-between items-center font-bold text-lg pt-2">
                                    <span>Total</span>
                                    <span>₦{cartTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            <Button className="w-full" onClick={handleCheckout} disabled={cart.length === 0 || isCheckingOut}>
                                {isCheckingOut ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="w-4 h-4 mr-2" />
                                        Checkout Now
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-4">
                {hasSearched && results.length === 0 && !loading && (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>No medications found matching "{searchTerm}" nearby.</p>
                    </div>
                )}

                {results.map(({ item, pharmacy, distance }) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-0">
                            <div className="flex flex-col sm:flex-row">
                                <div className="p-6 flex-1 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-lg text-primary">{item.drug.name}</h3>
                                            <p className="text-sm text-muted-foreground">{item.drug.description}</p>
                                        </div>
                                        <Badge variant={item.stock > 0 ? "outline" : "destructive"}>
                                            {item.stock > 0 ? "In Stock" : "Out of Stock"}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-4 h-4" />
                                            <span className="font-medium text-foreground">{pharmacy.name}</span>
                                        </div>
                                        {distance !== undefined && (
                                            <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                <Navigation className="w-3 h-3" />
                                                <span>{distance.toFixed(1)} km away</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-xs text-muted-foreground">
                                        {pharmacy.address}
                                    </div>
                                </div>

                                <div className="bg-muted/30 p-6 flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-4 min-w-[150px] border-t sm:border-t-0 sm:border-l">
                                    <div className="text-center">
                                        <p className="text-sm text-muted-foreground">Price</p>
                                        <p className="text-xl font-bold">₦{item.price.toLocaleString()}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => addToCart(item, pharmacy)}
                                        disabled={item.stock <= 0}
                                    >
                                        <ShoppingCart className="w-4 h-4 mr-2" />
                                        Add to Cart
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
