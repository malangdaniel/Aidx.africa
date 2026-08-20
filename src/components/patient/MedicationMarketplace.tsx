
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Navigation, ShoppingCart, Plus, Minus, Trash2, CreditCard, Loader2, Wallet, ShieldAlert, CheckCircle2 } from "lucide-react";
import { PharmacyService, InventoryItem, Pharmacy } from "@/services/PharmacyService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CartItem {
    inventoryItem: InventoryItem;
    pharmacy: Pharmacy;
    quantity: number;
}

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

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
    const [wallet, setWallet] = useState<{ balance: number; escrow: number } | null>(null);
    const [lastOrderId, setLastOrderId] = useState<string | null>(null);

    // Default user location (Lagos) — used only for distance sorting
    const userLocation = { lat: 6.5244, lng: 3.3792 };

    const loadWallet = async () => {
        try {
            setWallet(await PharmacyService.getWallet());
        } catch (e) {
            console.error("Failed to load wallet", e);
        }
    };

    useEffect(() => {
        if (user) loadWallet();
    }, [user]);

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;

        setLoading(true);
        setHasSearched(true);
        try {
            const data = await PharmacyService.searchDrugs(searchTerm, userLocation);
            setResults(data);
        } catch (error) {
            console.error("Search failed", error);
            toast.error("Search failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item: InventoryItem, pharmacy: Pharmacy) => {
        setCart(prev => {
            const existing = prev.find(c => c.inventoryItem.id === item.id);
            if (existing) {
                if (existing.quantity + 1 > item.stock) {
                    toast.error("Max stock reached");
                    return prev;
                }
                return prev.map(c => c.inventoryItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
            }
            return [...prev, { inventoryItem: item, pharmacy, quantity: 1 }];
        });
        toast.success(`${item.drug.name} added to cart`);
    };

    const updateQuantity = (itemId: string, delta: number) => {
        setCart(prev => prev.map(c => {
            if (c.inventoryItem.id === itemId) {
                const newQty = Math.max(1, c.quantity + delta);
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
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const pharmacyCount = new Set(cart.map(c => c.pharmacy.id)).size;
    const rxItems = cart.filter(c => c.inventoryItem.drug.requiresPrescription);
    const insufficientFunds = wallet !== null && cartTotal > wallet.balance;

    const handleCheckout = async () => {
        if (!user) {
            toast.error("Please sign in to checkout");
            return;
        }
        if (shippingAddress.trim().length < 5) {
            toast.error("Please enter a valid delivery address");
            return;
        }

        try {
            setIsCheckingOut(true);
            const result = await PharmacyService.checkout(
                cart.map(c => ({ drugId: c.inventoryItem.drugId, quantity: c.quantity })),
                shippingAddress.trim()
            );

            setLastOrderId(result.orderId);
            toast.success(
                result.pharmacies > 1
                    ? `Order placed and split across ${result.pharmacies} pharmacies. Funds held in escrow.`
                    : "Order placed. Funds held in escrow until delivery."
            );
            setCart([]);
            setShippingAddress("");
            setIsCartOpen(false);
            loadWallet();
            // refresh availability shown on screen
            if (searchTerm.trim()) handleSearch();
        } catch (error) {
            console.error("Checkout failed", error);
            toast.error(error instanceof Error ? error.message : "Failed to place order.");
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex gap-2 flex-1 min-w-0">
                    <Input
                        placeholder="Search medications (e.g., Paracetamol)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="flex-1 min-w-0"
                    />
                    <Button onClick={handleSearch} disabled={loading} className="shrink-0">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        <span className="ml-2 hidden sm:inline">Search</span>
                    </Button>
                </div>

                <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="relative w-full sm:w-auto shrink-0">
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Cart
                            {cartCount > 0 && (
                                <Badge className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 px-1 rounded-full">
                                    {cartCount}
                                </Badge>
                            )}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
                        <DialogHeader>
                            <DialogTitle>Checkout</DialogTitle>
                            <DialogDescription>
                                Payment is held in escrow and released to the pharmacy after delivery.
                            </DialogDescription>
                        </DialogHeader>

                        {cart.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Your cart is empty</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <ScrollArea className="h-[220px] pr-3">
                                    <div className="space-y-3">
                                        {cart.map((item) => (
                                            <div key={item.inventoryItem.id} className="flex justify-between items-start gap-2 border-b pb-3 last:border-0">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-semibold truncate">{item.inventoryItem.drug.name}</h4>
                                                    <p className="text-xs text-muted-foreground truncate">{item.pharmacy.name}</p>
                                                    <p className="text-xs font-medium text-primary mt-1">
                                                        {naira(item.inventoryItem.price)} × {item.quantity} = {naira(item.inventoryItem.price * item.quantity)}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2 shrink-0">
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

                                {rxItems.length > 0 && (
                                    <div className="flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 p-2 text-xs">
                                        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                                        <span>
                                            {rxItems.length} item{rxItems.length > 1 ? 's' : ''} require a prescription. The pharmacy will verify it before dispatch.
                                        </span>
                                    </div>
                                )}

                                <Separator />

                                <div className="space-y-2">
                                    <Label htmlFor="delivery-address">Delivery address</Label>
                                    <Textarea
                                        id="delivery-address"
                                        placeholder="House number, street, area, city"
                                        value={shippingAddress}
                                        maxLength={500}
                                        rows={2}
                                        onChange={(e) => setShippingAddress(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Items ({cartCount})</span>
                                        <span>{naira(cartTotal)}</span>
                                    </div>
                                    {pharmacyCount > 1 && (
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Pharmacies</span>
                                            <span>Split into {pharmacyCount} orders</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-bold text-base pt-1">
                                        <span>Total</span>
                                        <span>{naira(cartTotal)}</span>
                                    </div>
                                </div>

                                <div className={`flex items-center justify-between rounded-md border p-2 text-xs ${insufficientFunds ? 'border-destructive/40 bg-destructive/10' : 'bg-muted/40'}`}>
                                    <span className="flex items-center gap-2">
                                        <Wallet className="w-4 h-4" />
                                        Wallet balance
                                    </span>
                                    <span className="font-semibold">{wallet ? naira(wallet.balance) : '—'}</span>
                                </div>
                                {insufficientFunds && (
                                    <p className="text-xs text-destructive">
                                        Insufficient balance. Top up your wallet to complete this order.
                                    </p>
                                )}
                            </div>
                        )}

                        <DialogFooter>
                            <Button
                                className="w-full"
                                onClick={handleCheckout}
                                disabled={cart.length === 0 || isCheckingOut || insufficientFunds}
                            >
                                {isCheckingOut ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="w-4 h-4 mr-2" />
                                        Pay {naira(cartTotal)}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {lastOrderId && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span>Order #{lastOrderId.slice(0, 8)} confirmed — track it in the Orders tab.</span>
                </div>
            )}

            <div className="space-y-4">
                {hasSearched && results.length === 0 && !loading && (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>No medications found matching "{searchTerm}".</p>
                    </div>
                )}

                {results.map(({ item, pharmacy, distance }) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-0">
                            <div className="flex flex-col sm:flex-row">
                                <div className="p-4 sm:p-6 flex-1 min-w-0 space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-base sm:text-lg text-primary truncate">{item.drug.name}</h3>
                                            <p className="text-sm text-muted-foreground line-clamp-2">{item.drug.description}</p>
                                        </div>
                                        <Badge variant={item.stock > 0 ? "outline" : "destructive"} className="shrink-0">
                                            {item.stock > 0 ? `${item.stock} in stock` : "Out of Stock"}
                                        </Badge>
                                    </div>

                                    {item.drug.requiresPrescription && (
                                        <Badge variant="secondary" className="text-[10px]">Prescription required</Badge>
                                    )}

                                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground pt-2">
                                        <div className="flex items-center gap-1 min-w-0">
                                            <MapPin className="w-4 h-4 shrink-0" />
                                            <span className="font-medium text-foreground truncate">{pharmacy.name}</span>
                                        </div>
                                        {distance !== undefined && (
                                            <div className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full">
                                                <Navigation className="w-3 h-3" />
                                                <span>{distance.toFixed(1)} km away</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-xs text-muted-foreground truncate">{pharmacy.address}</div>
                                </div>

                                <div className="bg-muted/30 p-4 sm:p-6 flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-4 sm:min-w-[160px] border-t sm:border-t-0 sm:border-l">
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground">Price</p>
                                        <p className="text-xl font-bold">{naira(item.price)}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => addToCart(item, pharmacy)}
                                        disabled={item.stock <= 0}
                                    >
                                        <ShoppingCart className="w-4 h-4 mr-2" />
                                        Add
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
