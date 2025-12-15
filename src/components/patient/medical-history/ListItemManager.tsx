import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus } from 'lucide-react';

interface ListItem {
    id: string;
    [key: string]: any;
}

interface ListItemManagerProps {
    items: ListItem[];
    setItems: (items: ListItem[]) => void;
    fields: { name: string; label: string; placeholder?: string; type?: string }[];
    title?: string;
}

export default function ListItemManager({ items, setItems, fields, title }: ListItemManagerProps) {
    const [newEntry, setNewEntry] = useState<any>({});

    const handleAdd = () => {
        // Check if at least one field is filled
        const hasData = fields.some(field => newEntry[field.name]);
        if (!hasData) return;

        const entry = { id: crypto.randomUUID(), ...newEntry };
        setItems([...items, entry]);
        setNewEntry({});
    };

    const handleRemove = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    return (
        <div className="space-y-4">
            {/* List of existing items */}
            {items.length > 0 && (
                <div className="space-y-2">
                    {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md border">
                            <div className="space-y-1">
                                {fields.map(field => (
                                    item[field.name] && (
                                        <p key={field.name} className="text-sm">
                                            <span className="font-semibold text-muted-foreground">{field.label}:</span> {item[field.name]}
                                        </p>
                                    )
                                ))}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleRemove(item.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Item */}
            <div className="flex gap-2 items-end">
                {fields.map((field) => (
                    <div key={field.name} className="flex-1 space-y-2">
                        <Label htmlFor={field.name}>{field.label}</Label>
                        <Input
                            id={field.name}
                            type={field.type || 'text'}
                            placeholder={field.placeholder}
                            value={newEntry[field.name] || ''}
                            onChange={(e) => setNewEntry({ ...newEntry, [field.name]: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAdd();
                            }}
                        />
                    </div>
                ))}
                <Button onClick={handleAdd} size="icon" className="mb-[2px]">
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
