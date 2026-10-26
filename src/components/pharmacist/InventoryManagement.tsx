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
import { PharmacyService, InventoryItem, DrugCatalogueItem } from "@/services/PharmacyService";
import { supabase } from "@/integrations/supabase/client";
import {
    Plus,
    Search,
    Package,
    Loader2,
    ArrowLeft,
    X,
    CheckCircle2,
    AlertTriangle,
    Upload,
    ImageIcon
} from "lucide-react";

interface DrugFormState {
    name: string;
    generic_name: string;
    brand_name: string;
    active_ingredients: string;
    strength: string;
    dosage_form: string;
    route: string;
    category: string;
    manufacturer: string;
    description: string;
    nafdac_registration_number: string;
    prescription_required: boolean;
    price: string;
    stock_quantity: string;
    expiry_date: string;
    dosage_instructions: string;
    image_url: string;
}

const emptyForm: DrugFormState = {
    name: "",
    generic_name: "",
    brand_name: "",
    active_ingredients: "",
    strength: "",
    dosage_form: "",
    route: "",
    category: "",
    manufacturer: "",
    description: "",
    nafdac_registration_number: "",
    prescription_required: false,
    price: "",
    stock_quantity: "",
    expiry_date: "",
    dosage_instructions: "",
    image_url: "",
};

export default function InventoryManagement() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [pharmacyId, setPharmacyId] = useState<string | null>(null);

    // Dialog & Flow State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"search" | "form">("search");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedCatalogue, setSelectedCatalogue] = useState<DrugCatalogueItem | null>(null);
    const [prefilledKeys, setPrefilledKeys] = useState<Set<string>>(new Set());

    // Catalogue Search State
    const [catalogueQuery, setCatalogueQuery] = useState("");
    const [isSearchingCatalogue, setIsSearchingCatalogue] = useState(false);
    const [catalogueResults, setCatalogueResults] = useState<DrugCatalogueItem[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // Form State
    const [form, setForm] = useState<DrugFormState>(emptyForm);
    const [uploadingImage, setUploadingImage] = useState(false);

    const { toast } = useToast();

    useEffect(() => {
        init();
    }, []);

    // Debounced search for drug_catalogue (~300ms, min 2 chars)
    useEffect(() => {
        if (!isFormOpen || dialogMode !== "search") return;

        const trimmed = catalogueQuery.trim();
        if (trimmed.length < 2) {
            setCatalogueResults([]);
            setIsSearchingCatalogue(false);
            setHasSearched(false);
            return;
        }

        setIsSearchingCatalogue(true);
        const timer = setTimeout(async () => {
            try {
                const results = await PharmacyService.searchDrugCatalogue(trimmed);
                setCatalogueResults(results);
                setHasSearched(true);
            } catch (err) {
                console.error("Error searching drug catalogue:", err);
                toast({
                    title: "Catalogue Error",
                    description: "Failed to search the drug catalogue",
                    variant: "destructive"
                });
            } finally {
                setIsSearchingCatalogue(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [catalogueQuery, dialogMode, isFormOpen]);

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
        setSelectedCatalogue(null);
        setPrefilledKeys(new Set());
        setCatalogueQuery("");
        setCatalogueResults([]);
        setHasSearched(false);
        setForm(emptyForm);
        setDialogMode("search");
        setIsFormOpen(true);
    };

    const handleSelectCatalogueItem = (item: DrugCatalogueItem) => {
        setSelectedCatalogue(item);

        const ingredientsStr = Array.isArray(item.active_ingredients)
            ? item.active_ingredients.join(", ")
            : (item.active_ingredients || "");

        const prefilled = new Set<string>();
        const fieldsToCheck: [string, any][] = [
            ["name", item.name],
            ["generic_name", item.generic_name],
            ["brand_name", item.brand_name],
            ["active_ingredients", ingredientsStr],
            ["strength", item.strength],
            ["dosage_form", item.dosage_form],
            ["route", item.route],
            ["category", item.category],
            ["manufacturer", item.manufacturer],
            ["description", item.description],
            ["nafdac_registration_number", item.nafdac_registration_number],
        ];

        fieldsToCheck.forEach(([key, val]) => {
            if (val && String(val).trim().length > 0) {
                prefilled.add(key);
            }
        });

        setPrefilledKeys(prefilled);

        setForm({
            name: item.name || "",
            generic_name: item.generic_name || "",
            brand_name: item.brand_name || "",
            active_ingredients: ingredientsStr,
            strength: item.strength || "",
            dosage_form: item.dosage_form || "",
            route: item.route || "",
            category: item.category || "",
            manufacturer: item.manufacturer || "",
            description: item.description || "",
            nafdac_registration_number: item.nafdac_registration_number || "",
            prescription_required: Boolean(item.prescription_required),
            // Pharmacist-only fields (always blank):
            price: "",
            stock_quantity: "",
            expiry_date: "",
            dosage_instructions: "",
            image_url: "",
        });

        setDialogMode("form");
    };

    const handleAddManually = () => {
        setSelectedCatalogue(null);
        setPrefilledKeys(new Set());
        setForm(emptyForm);
        setDialogMode("form");
    };

    const openEdit = (item: InventoryItem & { raw?: any }) => {
        setEditingId(item.id);
        setSelectedCatalogue(null);
        setPrefilledKeys(new Set());
        const raw = item.raw || {};
        setForm({
            name: item.drug.name || "",
            generic_name: item.drug.generic_name || raw.generic_name || "",
            brand_name: item.drug.brand_name || raw.brand_name || "",
            active_ingredients: raw.active_ingredients || "",
            strength: item.drug.strength || raw.strength || "",
            dosage_form: item.drug.dosage_form || raw.dosage_form || "",
            route: item.drug.route || raw.route || "",
            category: item.drug.category === "General" ? "" : (item.drug.category || ""),
            manufacturer: item.drug.manufacturer || raw.manufacturer || "",
            description: item.drug.description || "",
            nafdac_registration_number: item.nafdac_registration_number || raw.nafdac_registration_number || "",
            prescription_required: Boolean(item.drug.requiresPrescription),
            price: String(item.price ?? ""),
            stock_quantity: String(item.stock ?? ""),
            expiry_date: item.expiry_date || raw.expiry_date || "",
            dosage_instructions: item.dosage_instructions || raw.dosage_instructions || "",
            image_url: item.drug.image || raw.image_url || "",
        });
        setDialogMode("form");
        setIsFormOpen(true);
    };

    const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast({
                title: "Invalid file type",
                description: "Please choose an image file (PNG, JPG, WebP)",
                variant: "destructive"
            });
            return;
        }

        setUploadingImage(true);
        try {
            const fileExt = file.name.split(".").pop();
            const fileName = `${pharmacyId || "pharmacy"}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

            // Try storage upload
            const { error: uploadError } = await supabase.storage
                .from("drugs")
                .upload(fileName, file, { upsert: true });

            if (!uploadError) {
                const { data } = supabase.storage.from("drugs").getPublicUrl(fileName);
                if (data?.publicUrl) {
                    setForm((prev) => ({ ...prev, image_url: data.publicUrl }));
                    toast({ title: "Image Uploaded", description: "Product image uploaded successfully." });
                    return;
                }
            }
        } catch {
            // Fallback to local DataURL
        } finally {
            setUploadingImage(false);
        }

        // Fallback: Read as Data URL
        const reader = new FileReader();
        reader.onloadend = () => {
            setForm((prev) => ({ ...prev, image_url: reader.result as string }));
            toast({ title: "Image Attached", description: "Image attached successfully." });
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast({
                title: "Missing Name",
                description: "Drug name is required.",
                variant: "destructive"
            });
            return;
        }

        const priceNum = Number(form.price);
        if (form.price === "" || isNaN(priceNum) || priceNum <= 0) {
            toast({
                title: "Invalid Price",
                description: "Price must be a valid number greater than ₦0.",
                variant: "destructive"
            });
            return;
        }

        const stockNum = Number(form.stock_quantity);
        if (form.stock_quantity === "" || isNaN(stockNum) || stockNum < 0) {
            toast({
                title: "Invalid Stock",
                description: "Stock quantity must be 0 or greater.",
                variant: "destructive"
            });
            return;
        }

        const isManualEntry = !editingId && !selectedCatalogue;
        if (isManualEntry && !form.nafdac_registration_number.trim()) {
            toast({
                title: "NAFDAC Number Required",
                description: "NAFDAC registration number is required for manual drug listings.",
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
                generic_name: form.generic_name.trim() || null,
                brand_name: form.brand_name.trim() || null,
                active_ingredients: form.active_ingredients.trim() || null,
                strength: form.strength.trim() || null,
                dosage_form: form.dosage_form.trim() || null,
                route: form.route.trim() || null,
                category: form.category.trim() || null,
                manufacturer: form.manufacturer.trim() || null,
                description: form.description.trim() || null,
                nafdac_registration_number: form.nafdac_registration_number.trim() || null,
                prescription_required: form.prescription_required,
                price: priceNum,
                stock: stockNum,
                expiryDate: form.expiry_date || null,
                dosage_instructions: form.dosage_instructions.trim() || null,
                image_url: form.image_url.trim() || null,
                catalogue_id: selectedCatalogue ? selectedCatalogue.id : null,
                verification_status: selectedCatalogue
                    ? (selectedCatalogue.verification_status || "verified")
                    : "unverified",
            };

            if (editingId) {
                await PharmacyService.updateDrug(editingId, payload);
                toast({ title: "Updated", description: `${payload.name} was updated successfully.` });
            } else {
                await PharmacyService.createDrug(pharmacyId, payload);
                toast({ title: "Drug Added", description: `${payload.name} was added to your inventory.` });
            }

            setIsFormOpen(false);
            setForm(emptyForm);
            setEditingId(null);
            setSelectedCatalogue(null);
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

    const filteredInventory = inventory.filter((item) =>
        item.drug.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.drug.generic_name && item.drug.generic_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const renderFieldIndicator = (fieldKey: string) => {
        if (!selectedCatalogue || editingId) return null;

        if (prefilledKeys.has(fieldKey)) {
            return (
                <span className="ml-2 inline-flex items-center text-[10px] font-normal px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Pre-filled
                </span>
            );
        }

        return (
            <span className="ml-2 inline-flex items-center text-[10px] font-normal px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                Empty in catalogue — please complete
            </span>
        );
    };

    const isFieldCatalogueEmpty = (fieldKey: string) => {
        return !!selectedCatalogue && !prefilledKeys.has(fieldKey);
    };

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
                    Add Drug
                </Button>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl sm:max-w-2xl">
                    {dialogMode === "search" ? (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Search className="w-5 h-5 text-primary" />
                                    Add Drug from Catalogue
                                </DialogTitle>
                                <DialogDescription>
                                    Search by drug name, generic name, or brand to pre-fill official specifications.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search catalogue (e.g. Paracetamol, Amoxicillin, Coartem)..."
                                        className="pl-9 pr-8"
                                        value={catalogueQuery}
                                        onChange={(e) => setCatalogueQuery(e.target.value)}
                                        autoFocus
                                    />
                                    {catalogueQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setCatalogueQuery("")}
                                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Results Container */}
                                <div className="min-h-[220px] max-h-[340px] overflow-y-auto rounded-lg border bg-muted/20 p-2 space-y-2">
                                    {isSearchingCatalogue ? (
                                        <div className="flex flex-col items-center justify-center h-48 space-y-2 text-muted-foreground">
                                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                            <p className="text-xs">Searching verified drug catalogue...</p>
                                        </div>
                                    ) : catalogueResults.length > 0 ? (
                                        catalogueResults.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelectCatalogueItem(item)}
                                                className="p-3 rounded-lg border bg-card hover:border-primary hover:bg-primary/5 cursor-pointer transition-all space-y-1.5 shadow-sm group"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                                                        {item.name}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {item.strength && (
                                                            <Badge variant="outline" className="text-[10px] font-mono">
                                                                {item.strength}
                                                            </Badge>
                                                        )}
                                                        {item.dosage_form && (
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                {item.dosage_form}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    {item.generic_name && (
                                                        <span>Generic: <strong className="text-foreground/80">{item.generic_name}</strong></span>
                                                    )}
                                                    {item.brand_name && item.brand_name !== item.name && (
                                                        <span>Brand: <strong className="text-foreground/80">{item.brand_name}</strong></span>
                                                    )}
                                                    {item.manufacturer && (
                                                        <span>Mfr: <span>{item.manufacturer}</span></span>
                                                    )}
                                                </div>

                                                {item.nafdac_registration_number && (
                                                    <div className="text-[10px] text-muted-foreground">
                                                        <span className="font-semibold text-primary">NAFDAC:</span> {item.nafdac_registration_number}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : hasSearched && catalogueQuery.trim().length >= 2 ? (
                                        <div className="flex flex-col items-center justify-center h-48 text-center space-y-3 p-4">
                                            <Package className="w-10 h-10 text-muted-foreground opacity-50" />
                                            <div>
                                                <p className="text-sm font-semibold">No catalogue results found</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    No drugs found matching "{catalogueQuery}".
                                                </p>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={handleAddManually}
                                                className="mt-2 text-xs"
                                            >
                                                <Plus className="w-3.5 h-3.5 mr-1.5" />
                                                Can't find your drug? Add it manually
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-48 text-center space-y-2 text-muted-foreground p-4">
                                            <Search className="w-8 h-8 opacity-40" />
                                            <p className="text-xs">Type at least 2 characters to search the catalogue...</p>
                                            <p className="text-[11px] opacity-75">Search by name, generic name, or brand.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-center gap-2 pt-2 border-t">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAddManually}
                                    className="text-xs text-primary hover:text-primary/80 w-full sm:w-auto"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                                    Can't find your drug? Add it manually
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>
                                    Cancel
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <div className="flex items-center justify-between">
                                    <DialogTitle>
                                        {editingId
                                            ? "Edit Drug"
                                            : selectedCatalogue
                                                ? "Add Drug (from Catalogue)"
                                                : "Add Drug Manually"}
                                    </DialogTitle>
                                    {!editingId && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDialogMode("search")}
                                            className="text-xs h-7 gap-1"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                            Back to Search
                                        </Button>
                                    )}
                                </div>
                                <DialogDescription>
                                    {selectedCatalogue
                                        ? "Review specifications pre-filled from the catalogue and complete your pharmacy pricing and stock."
                                        : editingId
                                            ? "Update pricing, stock availability and drug information."
                                            : "Add a manual listing. NAFDAC registration number is required for unverified entries."}
                                </DialogDescription>
                            </DialogHeader>

                            {selectedCatalogue && (
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <div className="font-semibold text-primary flex items-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            Catalogue Match: {selectedCatalogue.name}
                                        </div>
                                        <p className="text-muted-foreground">
                                            {[selectedCatalogue.strength, selectedCatalogue.dosage_form, selectedCatalogue.manufacturer].filter(Boolean).join(" • ")}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] shrink-0 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                                        {selectedCatalogue.verification_status || "Verified"}
                                    </Badge>
                                </div>
                            )}

                            {!editingId && !selectedCatalogue && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs flex items-center gap-2 text-amber-800 dark:text-amber-300">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                                    <span>
                                        Manual entry: This drug will be listed with an <strong>Unverified</strong> badge until audited. NAFDAC registration number is required.
                                    </span>
                                </div>
                            )}

                            <div className="space-y-4 py-2">
                                {/* Core Drug Identity */}
                                <div className="space-y-2">
                                    <Label htmlFor="form-name" className="flex items-center">
                                        Drug Name *
                                        {renderFieldIndicator("name")}
                                    </Label>
                                    <Input
                                        id="form-name"
                                        placeholder="e.g. Paracetamol 500mg"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className={isFieldCatalogueEmpty("name") ? "border-amber-300 dark:border-amber-700/60" : ""}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="form-generic" className="flex items-center">
                                            Generic Name
                                            {renderFieldIndicator("generic_name")}
                                        </Label>
                                        <Input
                                            id="form-generic"
                                            placeholder="e.g. Acetaminophen"
                                            value={form.generic_name}
                                            onChange={(e) => setForm({ ...form, generic_name: e.target.value })}
                                            className={isFieldCatalogueEmpty("generic_name") ? "border-amber-300 dark:border-amber-700/60" : ""}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="form-brand" className="flex items-center">
                                            Brand Name
                                            {renderFieldIndicator("brand_name")}
                                        </Label>
                                        <Input
                                            id="form-brand"
                                            placeholder="e.g. Panadol"
                                            value={form.brand_name}
                                            onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                                            className={isFieldCatalogueEmpty("brand_name") ? "border-amber-300 dark:border-amber-700/60" : ""}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="form-strength" className="flex items-center">
                                            Strength
                                            {renderFieldIndicator("strength")}
                                        </Label>
                                        <Input
                                            id="form-strength"
                                            placeholder="e.g. 500mg"
                                            value={form.strength}
                                            onChange={(e) => setForm({ ...form, strength: e.target.value })}
                                            className={isFieldCatalogueEmpty("strength") ? "border-amber-300 dark:border-amber-700/60" : ""}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="form-dosage-form" className="flex items-center">
                                            Dosage Form
                                            {renderFieldIndicator("dosage_form")}
                                        </Label>
                                        <Input
                                            id="form-dosage-form"
                                            placeholder="e.g. Tablet, Syrup"
                                            value={form.dosage_form}
                                            onChange={(e) => setForm({ ...form, dosage_form: e.target.value })}
                                            className={isFieldCatalogueEmpty("dosage_form") ? "border-amber-300 dark:border-amber-700/60" : ""}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="form-route" className="flex items-center">
                                            Route
                                            {renderFieldIndicator("route")}
                                        </Label>
                                        <Input
                                            id="form-route"
                                            placeholder="e.g. Oral"
                                            value={form.route}
                                            onChange={(e) => setForm({ ...form, route: e.target.value })}
                                            className={isFieldCatalogueEmpty("route") ? "border-amber-300 dark:border-amber-700/60" : ""}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="form-ingredients" className="flex items-center">
                                        Active Ingredients
                                        {renderFieldIndicator("active_ingredients")}
                                    </Label>
                                    <Input
                                        id="form-ingredients"
                                        placeholder="e.g. Paracetamol 500mg, Caffeine 30mg"
                                        value={form.active_ingredients}
                                        onChange={(e) => setForm({ ...form, active_ingredients: e.target.value })}
                                        className={isFieldCatalogueEmpty("active_ingredients") ? "border-amber-300 dark:border-amber-700/60" : ""}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="form-category" className="flex items-center">
                                            Category
                                            {renderFieldIndicator("category")}
                                        </Label>
                                        <Input
                                            id="form-category"
                                            placeholder="e.g. Analgesics"
                                            value={form.category}
                                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                                            className={isFieldCatalogueEmpty("category") ? "border-amber-300 dark:border-amber-700/60" : ""}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="form-manufacturer" className="flex items-center">
                                            Manufacturer
                                            {renderFieldIndicator("manufacturer")}
                                        </Label>
                                        <Input
                                            id="form-manufacturer"
                                            placeholder="e.g. Emzor Pharmaceuticals"
                                            value={form.manufacturer}
                                            onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                                            className={isFieldCatalogueEmpty("manufacturer") ? "border-amber-300 dark:border-amber-700/60" : ""}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="form-nafdac" className="flex items-center">
                                        NAFDAC Registration Number {!selectedCatalogue && !editingId && "*"}
                                        {renderFieldIndicator("nafdac_registration_number")}
                                    </Label>
                                    <Input
                                        id="form-nafdac"
                                        placeholder="e.g. A4-0123"
                                        value={form.nafdac_registration_number}
                                        onChange={(e) => setForm({ ...form, nafdac_registration_number: e.target.value })}
                                        className={
                                            !selectedCatalogue && !editingId && !form.nafdac_registration_number
                                                ? "border-amber-400 focus-visible:ring-amber-500"
                                                : isFieldCatalogueEmpty("nafdac_registration_number")
                                                    ? "border-amber-300 dark:border-amber-700/60"
                                                    : ""
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="form-description" className="flex items-center">
                                        Description
                                        {renderFieldIndicator("description")}
                                    </Label>
                                    <Textarea
                                        id="form-description"
                                        placeholder="Clinical details, uses, contraindications..."
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        rows={2}
                                        className={isFieldCatalogueEmpty("description") ? "border-amber-300 dark:border-amber-700/60" : ""}
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/10">
                                    <div>
                                        <Label htmlFor="form-rx">Prescription Required</Label>
                                        <p className="text-xs text-muted-foreground">Patients must upload a valid prescription to purchase</p>
                                    </div>
                                    <Switch
                                        id="form-rx"
                                        checked={form.prescription_required}
                                        onCheckedChange={(v) => setForm({ ...form, prescription_required: v })}
                                    />
                                </div>

                                {/* Pharmacist-Only Section */}
                                <div className="pt-3 border-t space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                                            Pharmacy Pricing & Stock (Required)
                                        </h4>
                                        <span className="text-[10px] text-muted-foreground">Always set by your pharmacy</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="form-price">Price (₦) *</Label>
                                            <Input
                                                id="form-price"
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="0.00"
                                                value={form.price}
                                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="form-stock">Stock Quantity *</Label>
                                            <Input
                                                id="form-stock"
                                                type="number"
                                                inputMode="numeric"
                                                placeholder="0"
                                                value={form.stock_quantity}
                                                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="form-expiry">Expiry Date</Label>
                                            <Input
                                                id="form-expiry"
                                                type="date"
                                                value={form.expiry_date}
                                                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="form-instructions">Dosage Instructions</Label>
                                            <Input
                                                id="form-instructions"
                                                placeholder="e.g. 1 tablet twice daily"
                                                value={form.dosage_instructions}
                                                onChange={(e) => setForm({ ...form, dosage_instructions: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Image Upload / URL */}
                                    <div className="space-y-2">
                                        <Label htmlFor="form-image">Product Image</Label>
                                        <div className="flex items-center gap-3">
                                            {form.image_url ? (
                                                <div className="relative w-12 h-12 rounded border overflow-hidden shrink-0 bg-muted">
                                                    <img
                                                        src={form.image_url}
                                                        alt="Drug preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setForm({ ...form, image_url: "" })}
                                                        className="absolute top-0 right-0 bg-black/60 text-white p-0.5 rounded-bl"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-12 h-12 rounded border border-dashed flex items-center justify-center shrink-0 text-muted-foreground bg-muted/20">
                                                    <ImageIcon className="w-5 h-5 opacity-50" />
                                                </div>
                                            )}
                                            <div className="flex-1 space-y-1.5">
                                                <div className="flex gap-2">
                                                    <label className="cursor-pointer">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={uploadingImage}
                                                            className="text-xs h-8"
                                                            asChild
                                                        >
                                                            <span>
                                                                {uploadingImage ? (
                                                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                                ) : (
                                                                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                                                                )}
                                                                Upload Image
                                                            </span>
                                                        </Button>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={handleImageFileSelect}
                                                            disabled={uploadingImage}
                                                        />
                                                    </label>
                                                    <Input
                                                        id="form-image"
                                                        placeholder="Or paste image URL..."
                                                        value={form.image_url}
                                                        onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                                                        className="text-xs h-8 flex-1"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="gap-2 pt-2 border-t">
                                <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {editingId ? "Save Changes" : "Add to Stocks"}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
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
                            <TableHead>Drug Name</TableHead>
                            <TableHead className="hidden sm:table-cell">Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : filteredInventory.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <Package className="w-12 h-12 mb-4 opacity-50" />
                                        <p>No products found in inventory.</p>
                                        <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
                                            <Plus className="w-4 h-4 mr-2" /> Add Drug
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredInventory.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">
                                        <div className="space-y-0.5">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="font-semibold text-foreground">{item.drug.name}</span>
                                                {item.drug.requiresPrescription && (
                                                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Rx</Badge>
                                                )}
                                                {item.verification_status === "unverified" && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                                                    >
                                                        Unverified
                                                    </Badge>
                                                )}
                                            </div>
                                            {(item.drug.generic_name || item.drug.strength || item.drug.dosage_form) && (
                                                <p className="text-xs text-muted-foreground">
                                                    {[item.drug.generic_name, item.drug.strength, item.drug.dosage_form].filter(Boolean).join(" • ")}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">{item.drug.category || "General"}</TableCell>
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
