
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Navigation, ShoppingCart } from "lucide-react";
import { PharmacyService, InventoryItem, Pharmacy } from "@/services/PharmacyService";

export default function MedicationMarketplace() {
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<{ item: InventoryItem; pharmacy: Pharmacy; distance?: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

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

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <Input
                    placeholder="Search for medications (e.g., Paracetamol)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                />
                <Button onClick={handleSearch} disabled={loading}>
                    {loading ? "Searching..." : <Search className="w-4 h-4 mr-2" />}
                    {loading ? "" : "Search"}
                </Button>
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
                                    <Button size="sm" className="w-full sm:w-auto">
                                        <ShoppingCart className="w-4 h-4 mr-2" />
                                        Buy Now
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
