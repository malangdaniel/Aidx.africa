import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { PharmacyService, InventoryItem } from "@/services/PharmacyService";
import { Plus, Search, Package, Loader2 } from "lucide-react";

interface FormState {
    name: string;
    category: string;
    description: string;
    manufacturer: string;
    price: string;
    stock: string;
    expiryDate: string;
    prescriptionRequired: boolean;
}

const emptyForm: FormState = {
    name: "",
    category: "",
    description: "",
    manufacturer: "",
    price: "",
    stock: "",
    expiryDate: "",
    prescriptionRequired: false,
};

export default function InventoryManagement() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pharmacyId, setPharmacyId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);

    const { toast } = useToast();

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        setLoading(true);
        try {
            const id = await PharmacyService.getMyPharmacyId();
            setPharmacyId(id);
            if (id) {
                const data = await PharmacyService.getInventory(id);
                setInventory(data);
            }
        } catch (error) {
            console.error("Failed to load inventory", error);
            toast({ title: "Error", description: "Failed to load inventory", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const reload = async () => {
        if (!pharmacyId) return;
        const data = await PharmacyService.getInventory(pharmacyId);
        setInventory(data);
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setIsFormOpen(true);
    };

    const openEdit = (item: InventoryItem & { raw?: any }) => {
        setEditingId(item.id);
        setForm({
            name: item.drug.name,
            category: item.drug.category === "General" ? "" : item.drug.category,
            description: item.drug.description,
            manufacturer: "",
            price: String(item.price ?? ""),
            stock: String(item.stock ?? ""),
            expiryDate: "",
            prescriptionRequired: !!item.drug.requiresPrescription,
        });
        setIsFormOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || form.price === "" || form.stock === "") {
            toast({
                title: "Missing fields",
                description: "Drug name, price and stock quantity are required",
                variant: "destructive"
            });
            return;
        }
        if (!pharmacyId) {
            toast({
                title: "No pharmacy found",
                description: "Your account is not linked to a pharmacy profile yet.",
                variant: "destructive"
            });
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description.trim(),
                category: form.category.trim(),
                manufacturer: form.manufacturer.trim(),
                price: Number(form.price),
                stock: Number(form.stock),
                prescriptionRequired: form.prescriptionRequired,
                expiryDate: form.expiryDate || null,
            };

            if (editingId) {
                await PharmacyService.updateDrug(editingId, payload);
                toast({ title: "Updated", description: `${payload.name} was updated` });
            } else {
                await PharmacyService.createDrug(pharmacyId, payload);
                toast({ title: "Added", description: `${payload.name} was added to your inventory` });
            }

            setIsFormOpen(false);
            setForm(emptyForm);
            setEditingId(null);
            await reload();
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Error",
                description: error?.message || "Failed to save product",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await PharmacyService.deleteDrug(id);
            toast({ title: "Removed", description: "Product removed from inventory" });
            await reload();
        } catch (error: any) {
            toast({ title: "Error", description: error?.message || "Failed to remove product", variant: "destructive" });
        }
    };

    const filteredInventory = inventory.filter(item =>
        item.drug.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search inventory..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={openAdd} className="w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                </Button>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Product" : "Add Product to Inventory"}</DialogTitle>
                        <DialogDescription>
                            Enter the drug details, your price and the stock quantity you have available.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="drug-name">Drug Name *</Label>
                            <Input
                                id="drug-name"
                                placeholder="e.g. Paracetamol 500mg"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="drug-category">Category</Label>
                                <Input
                                    id="drug-category"
                                    placeholder="e.g. Analgesic"
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="drug-manufacturer">Manufacturer</Label>
                                <Input
                                    id="drug-manufacturer"
                                    placeholder="e.g. Emzor"
                                    value={form.manufacturer}
                                    onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="drug-description">Description</Label>
                            <Textarea
                                id="drug-description"
                                placeholder="Short description, dosage form, strength..."
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="drug-price">Price (₦) *</Label>
                                <Input
                                    id="drug-price"
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={form.price}
                                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="drug-stock">Stock Quantity *</Label>
                                <Input
                                    id="drug-stock"
                                    type="number"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={form.stock}
                                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="drug-expiry">Expiry Date</Label>
                            <Input
                                id="drug-expiry"
                                type="date"
                                value={form.expiryDate}
                                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label htmlFor="drug-rx">Prescription required</Label>
                                <p className="text-xs text-muted-foreground">Patients must upload a valid prescription</p>
                            </div>
                            <Switch
                                id="drug-rx"
                                checked={form.prescriptionRequired}
                                onCheckedChange={(v) => setForm({ ...form, prescriptionRequired: v })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {editingId ? "Save Changes" : "Add Product"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {!loading && !pharmacyId && (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No pharmacy profile is linked to your account yet, so inventory can't be saved.
                </div>
            )}

            <div className="border rounded-md overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product Name</TableHead>
                            <TableHead className="hidden sm:table-cell">Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
                            </TableRow>
                        ) : filteredInventory.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <Package className="w-12 h-12 mb-4 opacity-50" />
                                        <p>No products found in inventory.</p>
                                        <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
                                            <Plus className="w-4 h-4 mr-2" /> Add your first product
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredInventory.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {item.drug.name}
                                            {item.drug.requiresPrescription && (
                                                <Badge variant="outline" className="text-[10px]">Rx</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">{item.drug.category}</TableCell>
                                    <TableCell>₦{Number(item.price || 0).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <span className={item.stock < 10 ? "text-destructive font-bold" : ""}>
                                            {item.stock}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>Edit</Button>
                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(item.id)}>Delete</Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
