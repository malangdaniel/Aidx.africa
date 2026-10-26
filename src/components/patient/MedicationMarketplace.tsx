
import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Navigation, ShoppingCart, Plus, Minus, Trash2, CreditCard, Loader2, Wallet, ShieldAlert, CheckCircle2, ArrowUpDown, Star, Pill } from "lucide-react";
import { PharmacyService, InventoryItem, Pharmacy } from "@/services/PharmacyService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import DepositFundsModal from "./DepositFundsModal";
import DrugDetailModal from "./DrugDetailModal";

interface CartItem {
    inventoryItem: InventoryItem;
    pharmacy: Pharmacy;
    quantity: number;
}

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

import { DoctorPrescription } from "@/services/PharmacyService";

interface MedicationMarketplaceProps {
    initialSearchTerm?: string;
    onOrderSuccess?: (orderId: string) => void;
}

export default function MedicationMarketplace({ initialSearchTerm, onOrderSuccess }: MedicationMarketplaceProps) {
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
    const [deliveryInstructions, setDeliveryInstructions] = useState("");
    const [prescriptions, setPrescriptions] = useState<DoctorPrescription[]>([]);
    const [selectedPrescriptionId, setSelectedPrescriptionId] = useState("");
    const [uploadedImagePath, setUploadedImagePath] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [uploadingPrescription, setUploadingPrescription] = useState(false);

    const [wallet, setWallet] = useState<{ balance: number; escrow: number } | null>(null);
    const [lastOrderId, setLastOrderId] = useState<string | null>(null);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

    // Sort control
    const [sortBy, setSortBy] = useState<'price_asc' | 'rating_desc'>('price_asc');

    // Drug detail modal
    const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
    const [detailPharmacy, setDetailPharmacy] = useState<Pharmacy | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Default user location (Lagos) — used only for distance sorting
    const userLocation = { lat: 6.5244, lng: 3.3792 };

    const loadWallet = async () => {
        try {
            setWallet(await PharmacyService.getWallet());
        } catch (e) {
            console.error("Failed to load wallet", e);
        }
    };

    const loadPrescriptions = async () => {
        try {
            const rxList = await PharmacyService.getMyPrescriptions();
            setPrescriptions(rxList);
        } catch (e) {
            console.error("Failed to load prescriptions", e);
        }
    };

    useEffect(() => {
        if (user) {
            loadWallet();
            loadPrescriptions();
        }
    }, [user]);

    useEffect(() => {
        if (isCartOpen && user) {
            loadPrescriptions();
            loadWallet();
        }
    }, [isCartOpen, user]);

    const handleSearch = async (term = searchTerm) => {
        if (!term.trim()) return;

        setLoading(true);
        setHasSearched(true);
        try {
            const data = await PharmacyService.searchDrugs(term, userLocation);
            setResults(data);
        } catch (error) {
            console.error("Search failed", error);
            toast.error("Search failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!initialSearchTerm?.trim()) return;
        setSearchTerm(initialSearchTerm);
        void handleSearch(initialSearchTerm);
    }, [initialSearchTerm]);

    const addToCart = (item: InventoryItem, pharmacy: Pharmacy, qty = 1) => {
        setCart(prev => {
            const existing = prev.find(c => c.inventoryItem.id === item.id);
            if (existing) {
                const newQty = existing.quantity + qty;
                if (newQty > item.stock) {
                    toast.error("Max stock reached");
                    return prev;
                }
                return prev.map(c => c.inventoryItem.id === item.id ? { ...c, quantity: newQty } : c);
            }
            if (qty > item.stock) {
                toast.error("Max stock reached");
                return prev;
            }
            return [...prev, { inventoryItem: item, pharmacy, quantity: qty }];
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

    const handlePrescriptionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setUploadingPrescription(true);
            const path = await PharmacyService.uploadPrescriptionImage(file);
            setUploadedImagePath(path);
            setUploadedFileName(file.name);
            setSelectedPrescriptionId("");
            toast.success("Prescription uploaded successfully");
        } catch (err: any) {
            console.error("Prescription upload error:", err);
            toast.error(err?.message || "Failed to upload prescription");
        } finally {
            setUploadingPrescription(false);
        }
    };

    const rxMissing = rxItems.length > 0 && !selectedPrescriptionId && !uploadedImagePath;

    const handleCheckout = async () => {
        if (!user) {
            toast.error("Please sign in to checkout");
            return;
        }
        if (shippingAddress.trim().length < 5) {
            toast.error("Please enter a valid delivery address");
            return;
        }
        if (rxMissing) {
            toast.error("A prescription is required for prescription-only items in your cart.");
            return;
        }

        try {
            setIsCheckingOut(true);
            const result = await PharmacyService.checkout(
                cart.map(c => ({ drugId: c.inventoryItem.drugId, quantity: c.quantity })),
                shippingAddress.trim(),
                {
                    prescriptionId: selectedPrescriptionId || null,
                    prescriptionImagePath: uploadedImagePath || null,
                    deliveryInstructions: deliveryInstructions.trim() || null,
                }
            );

            setLastOrderId(result.orderId);
            toast.success(
                result.pharmacies > 1
                    ? `Order placed and split across ${result.pharmacies} pharmacies. Funds held in escrow.`
                    : "Order placed. Funds held in escrow until delivery."
            );
            setCart([]);
            setShippingAddress("");
            setDeliveryInstructions("");
            setSelectedPrescriptionId("");
            setUploadedImagePath(null);
            setUploadedFileName(null);
            setIsCartOpen(false);
            loadWallet();
            if (searchTerm.trim()) handleSearch();
            onOrderSuccess?.(result.orderId);
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
                    <Button onClick={() => void handleSearch()} disabled={loading} className="shrink-0">
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
                                    <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                                        <div className="flex items-start gap-2 text-amber-800 dark:text-amber-400 font-semibold">
                                            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                                            <span>Prescription Required ({rxItems.length} item{rxItems.length > 1 ? 's' : ''})</span>
                                        </div>
                                        <p className="text-muted-foreground text-[11px]">
                                            Select an existing prescription from your past consultations or upload a valid prescription image or PDF.
                                        </p>

                                        {prescriptions.length > 0 && (
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-foreground">
                                                    Option A: Select from consultation history
                                                </Label>
                                                <select
                                                    className="w-full text-xs p-2 rounded-md border border-input bg-background text-foreground"
                                                    value={selectedPrescriptionId}
                                                    onChange={(e) => {
                                                        setSelectedPrescriptionId(e.target.value);
                                                        if (e.target.value) {
                                                            setUploadedImagePath(null);
                                                            setUploadedFileName(null);
                                                        }
                                                    }}
                                                >
                                                    <option value="">-- Choose past consultation prescription --</option>
                                                    {prescriptions.map((p) => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.doctorName} ({new Date(p.createdAt).toLocaleDateString()}) - {p.medications.join(', ')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-medium text-foreground">
                                                {prescriptions.length > 0 ? "Option B: Upload prescription image or PDF" : "Upload prescription image or PDF"}
                                            </Label>
                                            <Input
                                                type="file"
                                                accept="image/*,.pdf"
                                                disabled={uploadingPrescription}
                                                onChange={handlePrescriptionUpload}
                                                className="text-xs h-8 file:text-xs"
                                            />
                                            {uploadingPrescription && (
                                                <p className="text-[11px] text-primary flex items-center gap-1 mt-1">
                                                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading prescription...
                                                </p>
                                            )}
                                            {uploadedFileName && (
                                                <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1 font-medium">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded: {uploadedFileName}
                                                </p>
                                            )}
                                        </div>

                                        {rxMissing && (
                                            <p className="text-[11px] font-medium text-destructive">
                                                * You must select or upload a prescription to complete this order.
                                            </p>
                                        )}
                                    </div>
                                )}

                                <Separator />

                                <div className="space-y-2">
                                    <Label htmlFor="delivery-address">Delivery address *</Label>
                                    <Textarea
                                        id="delivery-address"
                                        placeholder="House number, street, area, city"
                                        value={shippingAddress}
                                        maxLength={500}
                                        rows={2}
                                        onChange={(e) => setShippingAddress(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="delivery-instructions">Delivery instructions (Optional)</Label>
                                    <Input
                                        id="delivery-instructions"
                                        placeholder="Gate code, call upon arrival, landmark..."
                                        value={deliveryInstructions}
                                        maxLength={200}
                                        onChange={(e) => setDeliveryInstructions(e.target.value)}
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
                                    <div className="space-y-1.5 pt-1">
                                        <p className="text-xs text-destructive">
                                            Insufficient balance to complete this order.
                                        </p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setIsDepositModalOpen(true)}
                                            className="w-full text-xs gap-1.5 h-8 font-semibold"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Top up Wallet
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter>
                            <Button
                                className="w-full"
                                onClick={handleCheckout}
                                disabled={cart.length === 0 || isCheckingOut || insufficientFunds || rxMissing || shippingAddress.trim().length < 5 || uploadingPrescription}
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

                <DepositFundsModal
                    isOpen={isDepositModalOpen}
                    onClose={() => setIsDepositModalOpen(false)}
                    onDepositSuccess={loadWallet}
                    initialAmount={Math.max(500, Math.ceil(cartTotal - (wallet?.balance || 0)))}
                />
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

                {/* Sort control — show when there are 2+ results */}
                {results.length >= 2 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {results.length} result{results.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex items-center gap-2">
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                            <select
                                className="text-xs p-1.5 pr-6 rounded-md border border-input bg-background text-foreground cursor-pointer"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'price_asc' | 'rating_desc')}
                            >
                                <option value="price_asc">Lowest price</option>
                                <option value="rating_desc">Highest rating</option>
                            </select>
                        </div>
                    </div>
                )}

                {(() => {
                    // Sort results based on sortBy
                    const sorted = [...results].sort((a, b) => {
                        if (sortBy === 'price_asc') return a.item.price - b.item.price;
                        return (b.pharmacy.rating || 0) - (a.pharmacy.rating || 0);
                    });
                    return sorted.map(({ item, pharmacy, distance }) => (
                        <Card
                            key={item.id + '-' + pharmacy.id}
                            className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => {
                                setDetailItem(item);
                                setDetailPharmacy(pharmacy);
                                setIsDetailOpen(true);
                            }}
                        >
                            <CardContent className="p-0">
                                <div className="flex flex-col sm:flex-row">
                                    {/* Drug Image */}
                                    <div className="sm:w-[120px] sm:min-h-[120px] flex items-center justify-center bg-muted/30 border-b sm:border-b-0 sm:border-r p-3">
                                        {item.drug.image && item.drug.image.length > 10 ? (
                                            <img
                                                src={item.drug.image}
                                                alt={item.drug.name}
                                                className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : null}
                                        <div className={`flex items-center justify-center ${item.drug.image && item.drug.image.length > 10 ? 'hidden' : ''}`}>
                                            <Pill className="w-10 h-10 text-muted-foreground/40" />
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4 sm:p-5 flex-1 min-w-0 space-y-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-base sm:text-lg text-primary truncate">{item.drug.name}</h3>
                                                {(item.drug.strength || item.drug.dosage_form) && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {[item.drug.strength, item.drug.dosage_form].filter(Boolean).join(' · ')}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-lg font-bold shrink-0">{naira(item.price)}</p>
                                        </div>

                                        {item.drug.requiresPrescription && (
                                            <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                                <ShieldAlert className="w-3 h-3" />
                                                Prescription required
                                            </Badge>
                                        )}

                                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground pt-1">
                                            <div className="flex items-center gap-1 min-w-0">
                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                <span className="font-medium text-foreground text-xs truncate">{pharmacy.name}</span>
                                            </div>
                                            {pharmacy.address && (
                                                <span className="text-xs truncate max-w-[200px]">{pharmacy.address}</span>
                                            )}
                                            {pharmacy.rating > 0 && (
                                                <div className="flex items-center gap-0.5 text-xs">
                                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                    <span>{pharmacy.rating.toFixed(1)}</span>
                                                </div>
                                            )}
                                            {distance !== undefined && distance > 0 && (
                                                <div className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full">
                                                    <Navigation className="w-3 h-3" />
                                                    <span>{distance.toFixed(1)} km</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Add to cart */}
                                    <div className="bg-muted/20 p-4 sm:p-5 flex items-center justify-center sm:min-w-[120px] border-t sm:border-t-0 sm:border-l">
                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addToCart(item, pharmacy);
                                            }}
                                            disabled={item.stock <= 0}
                                            className="gap-1.5"
                                        >
                                            <ShoppingCart className="w-4 h-4" />
                                            Add to cart
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ));
                })()}
            </div>

            {/* Drug Detail Modal */}
            <DrugDetailModal
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                item={detailItem}
                pharmacy={detailPharmacy}
                onAddToCart={addToCart}
            />
        </div>
    );
}
