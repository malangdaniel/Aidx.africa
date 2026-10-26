import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { InventoryItem, Pharmacy } from "@/services/PharmacyService";
import {
    ShoppingCart, Plus, Minus, MapPin, Star, Phone, Pill,
    Building2, ShieldAlert, AlertTriangle, Calendar, Package
} from "lucide-react";

interface DrugDetailModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: InventoryItem | null;
    pharmacy: Pharmacy | null;
    onAddToCart: (item: InventoryItem, pharmacy: Pharmacy, quantity: number) => void;
}

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='system-ui' font-size='48'%3E💊%3C/text%3E%3C/svg%3E";

export default function DrugDetailModal({ open, onOpenChange, item, pharmacy, onAddToCart }: DrugDetailModalProps) {
    const isMobile = useIsMobile();
    const [quantity, setQuantity] = useState(1);

    // Reset quantity when item changes
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) setQuantity(1);
        onOpenChange(newOpen);
    };

    if (!item || !pharmacy) return null;

    const drug = item.drug;
    const imageUrl = drug.image && drug.image.length > 10 ? drug.image : PLACEHOLDER_IMAGE;

    const handleAddToCart = () => {
        onAddToCart(item, pharmacy, quantity);
        handleOpenChange(false);
    };

    const content = (
        <ScrollArea className="max-h-[70vh] md:max-h-[75vh]">
            <div className="space-y-5 px-4 pb-6 pt-2 md:px-6">
                {/* Image */}
                <div className="flex justify-center">
                    <div className="w-full max-w-[280px] aspect-square rounded-xl overflow-hidden border bg-muted/30">
                        <img
                            src={imageUrl}
                            alt={drug.name}
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                        />
                    </div>
                </div>

                {/* Name + Badges */}
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-foreground">{drug.name}</h2>
                    <div className="flex flex-wrap gap-2">
                        {drug.requiresPrescription && (
                            <Badge variant="secondary" className="gap-1 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                <ShieldAlert className="w-3 h-3" />
                                Prescription required
                            </Badge>
                        )}
                        {item.verification_status === 'unverified' && (
                            <Badge variant="destructive" className="gap-1 text-xs">
                                <AlertTriangle className="w-3 h-3" />
                                Unverified
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Drug Details */}
                <div className="space-y-3">
                    {drug.generic_name && (
                        <DetailRow label="Generic Name" value={drug.generic_name} />
                    )}
                    {drug.brand_name && (
                        <DetailRow label="Brand Name" value={drug.brand_name} />
                    )}
                    {(drug.strength || drug.dosage_form) && (
                        <DetailRow
                            label="Strength / Form"
                            value={[drug.strength, drug.dosage_form].filter(Boolean).join(' · ')}
                        />
                    )}
                    {drug.route && (
                        <DetailRow label="Route" value={drug.route} />
                    )}
                    {drug.manufacturer && (
                        <DetailRow label="Manufacturer" value={drug.manufacturer} />
                    )}
                    {drug.nafdac_registration_number && (
                        <DetailRow label="NAFDAC Reg. No." value={drug.nafdac_registration_number} />
                    )}
                </div>

                {drug.description && (
                    <>
                        <Separator />
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</p>
                            <p className="text-sm text-foreground leading-relaxed">{drug.description}</p>
                        </div>
                    </>
                )}

                <Separator />

                {/* Price + Expiry */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground">Price</p>
                        <p className="text-2xl font-bold text-primary">{naira(item.price)}</p>
                    </div>
                    {item.expiry_date && (
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                <Calendar className="w-3 h-3" /> Expiry Date
                            </p>
                            <p className="text-sm font-medium">
                                {new Date(item.expiry_date).toLocaleDateString('en-NG', {
                                    year: 'numeric', month: 'short', day: 'numeric'
                                })}
                            </p>
                        </div>
                    )}
                </div>

                <Separator />

                {/* Pharmacy Info */}
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> Pharmacy
                    </p>
                    <div className="space-y-2">
                        <p className="font-semibold text-sm">{pharmacy.name}</p>
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{pharmacy.address || 'Location not provided'}</span>
                        </div>
                        {pharmacy.rating > 0 && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                <span className="font-medium">{pharmacy.rating.toFixed(1)}</span>
                            </div>
                        )}
                        {pharmacy.license_number && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Package className="w-3.5 h-3.5 shrink-0" />
                                <span>License No. {pharmacy.license_number}</span>
                            </div>
                        )}
                        {pharmacy.phone && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <Phone className="w-3.5 h-3.5 shrink-0 text-primary" />
                                <a
                                    href={`tel:${pharmacy.phone}`}
                                    className="text-primary hover:underline font-medium"
                                >
                                    {pharmacy.phone}
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                <Separator />

                {/* Quantity Selector + Add to Cart */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Quantity</p>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                disabled={quantity <= 1}
                            >
                                <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-8 text-center font-semibold tabular-nums">{quantity}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setQuantity(q => Math.min(item.stock, q + 1))}
                                disabled={quantity >= item.stock}
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-right">{item.stock} in stock</p>

                    <Button className="w-full gap-2" size="lg" onClick={handleAddToCart}>
                        <ShoppingCart className="w-4 h-4" />
                        Add to cart · {naira(item.price * quantity)}
                    </Button>
                </div>
            </div>
        </ScrollArea>
    );

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={handleOpenChange}>
                <DrawerContent className="max-h-[90vh]">
                    <DrawerHeader className="pb-0">
                        <DrawerTitle className="sr-only">{drug.name}</DrawerTitle>
                    </DrawerHeader>
                    {content}
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] max-w-lg p-0 gap-0 overflow-hidden">
                <DialogHeader className="sr-only">
                    <DialogTitle>{drug.name}</DialogTitle>
                    <DialogDescription>Drug details</DialogDescription>
                </DialogHeader>
                {content}
            </DialogContent>
        </Dialog>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <p className="text-xs text-muted-foreground shrink-0">{label}</p>
            <p className="text-sm font-medium text-right">{value}</p>
        </div>
    );
}
