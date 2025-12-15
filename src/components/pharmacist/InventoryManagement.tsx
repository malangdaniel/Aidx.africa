
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast"; // Correct path for use-toast based on list_dir
import { PharmacyService, InventoryItem, Drug } from "@/services/PharmacyService";
import { Plus, Search, Package } from "lucide-react";

export default function InventoryManagement() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [availableDrugs, setAvailableDrugs] = useState<Drug[]>([]);

    // Form State
    const [selectedDrug, setSelectedDrug] = useState("");
    const [price, setPrice] = useState("");
    const [stock, setStock] = useState("");

    const { toast } = useToast();

    useEffect(() => {
        loadInventory();
        loadDrugs();
    }, []);

    const loadInventory = async () => {
        try {
            setLoading(true);
            // Mocking pharmacy ID 'p1' for current user
            const data = await PharmacyService.getInventory('p1');
            setInventory(data);
        } catch (error) {
            console.error("Failed to load inventory", error);
        } finally {
            setLoading(false);
        }
    };

    const loadDrugs = async () => {
        const drugs = await PharmacyService.getAllDrugs();
        setAvailableDrugs(drugs);
    };

    const handleAddItem = async () => {
        if (!selectedDrug || !price || !stock) {
            toast({
                title: "Missing fields",
                description: "Please fill all fields",
                variant: "destructive"
            });
            return;
        }

        try {
            await PharmacyService.addToInventory('p1', selectedDrug, Number(price), Number(stock));
            toast({
                title: "Success",
                description: "Product added to inventory"
            });
            setIsAddOpen(false);
            resetForm();
            loadInventory();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to add product",
                variant: "destructive"
            });
        }
    };

    const resetForm = () => {
        setSelectedDrug("");
        setPrice("");
        setStock("");
    };

    const filteredInventory = inventory.filter(item =>
        item.drug.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search inventory..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Product
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Product to Inventory</DialogTitle>
                            <DialogDescription>
                                Select a drug from the database and set your price and stock quantity.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Drug Name</Label>
                                <Select value={selectedDrug} onValueChange={setSelectedDrug}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a drug" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableDrugs.map(drug => (
                                            <SelectItem key={drug.id} value={drug.id}>{drug.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Price (₦)</Label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Stock Quantity</Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={stock}
                                        onChange={(e) => setStock(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddItem}>Add Product</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product Name</TableHead>
                            <TableHead>Category</TableHead>
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
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredInventory.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.drug.name}</TableCell>
                                    <TableCell>{item.drug.category}</TableCell>
                                    <TableCell>₦{item.price.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <span className={item.stock < 10 ? "text-red-500 font-bold" : ""}>
                                            {item.stock}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">Edit</Button>
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
