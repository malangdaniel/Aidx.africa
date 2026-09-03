import { supabase } from '@/integrations/supabase/client';

export interface GeoLocation {
    lat: number;
    lng: number;
}

export interface Pharmacy {
    id: string;
    name: string;
    location: GeoLocation;
    address: string;
    rating: number;
    isOpen: boolean;
}

export interface Drug {
    id: string;
    name: string;
    description: string;
    category: string;
    image?: string;
    requiresPrescription: boolean;
}

export interface DoctorPrescription {
    id: string;
    createdAt: string;
    notes: string;
    doctorName: string;
    medications: string[];
}

export interface InventoryItem {
    id: string; // effectively the drug record ID in this schema
    pharmacyId: string;
    drugId: string; // same as id
    drug: Drug;
    price: number;
    stock: number;
    discount?: number;
}

// Helper to parse Point type from Supabase (if needed) or just default
const parseLocation = (loc: any): GeoLocation => {
    // Supabase Point is often returned as a string "(x,y)" or object. 
    // For now, defaulting to Lagos coordinates if null/unparsable 
    // because proper PostGIS handling in JS requires more parsing logic.
    // Ideally we would use st_asgeojson or similar in the query.
    if (typeof loc === 'string' && loc.startsWith('(')) {
        const parts = loc.replace(/[()]/g, '').split(',');
        return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
    }
    return { lat: 6.5244, lng: 3.3792 };
};

export const PharmacyService = {
    getPharmacies: async (): Promise<Pharmacy[]> => {
        const { data, error } = await supabase
            .from('pharmacies')
            .select('*');

        if (error) throw error;

        return data.map((p: any) => ({
            id: p.id,
            name: p.business_name,
            location: parseLocation(p.location),
            address: p.address || "",
            rating: p.rating || 0,
            isOpen: true // Defaulted as we don't have operating hours in DB yet
        }));
    },

    getAllDrugs: async (): Promise<Drug[]> => {
        const { data, error } = await supabase
            .from('drugs')
            .select('id, name, description, category, image_url, prescription_required')
            .limit(50); // limit for performance

        if (error) throw error;

        return data.map((d: any) => ({
            id: d.id,
            name: d.name,
            description: d.description || "",
            category: d.category || "General",
            image: d.image_url,
            requiresPrescription: d.prescription_required
        }));
    },

    searchDrugs: async (query: string, userLocation?: GeoLocation): Promise<{ item: InventoryItem; pharmacy: Pharmacy; distance?: number }[]> => {
        // We search the 'drugs' table directly which serves as inventory
        // We also join with 'pharmacies'
        const { data, error } = await supabase
            .from('drugs')
            .select(`
                *,
                pharmacies (
                    id,
                    business_name,
                    address,
                    location,
                    rating
                )
            `)
            .ilike('name', `%${query}%`);

        if (error) throw error;

        const results = data.map((row: any) => {
            const pharmacyData = row.pharmacies;
            const pharmacyLocation = parseLocation(pharmacyData.location);
            const pharmacy: Pharmacy = {
                id: pharmacyData.id,
                name: pharmacyData.business_name,
                address: pharmacyData.address || "",
                rating: pharmacyData.rating || 0,
                location: pharmacyLocation,
                isOpen: true
            };

            const drug: Drug = {
                id: row.id,
                name: row.name,
                description: row.description || "",
                category: row.category || "General",
                image: row.image_url,
                requiresPrescription: row.prescription_required
            };

            const item: InventoryItem = {
                id: row.id,
                pharmacyId: pharmacy.id,
                drugId: row.id,
                drug: drug,
                price: row.price,
                stock: row.stock_quantity
            };

            let distance = 0;
            if (userLocation) {
                distance = calculateDistance(userLocation.lat, userLocation.lng, pharmacyLocation.lat, pharmacyLocation.lng);
            }

            return { item, pharmacy, distance };
        });

        if (userLocation) {
            results.sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
        }

        return results;
    },

    getInventory: async (pharmacyId: string): Promise<InventoryItem[]> => {
        const { data, error } = await supabase
            .from('drugs')
            .select('*')
            .eq('pharmacy_id', pharmacyId);

        if (error) throw error;

        return data.map((d: any) => ({
            id: d.id,
            pharmacyId: pharmacyId,
            drugId: d.id,
            drug: {
                id: d.id,
                name: d.name,
                description: d.description || "",
                category: d.category || "General",
                image: d.image_url,
                requiresPrescription: d.prescription_required
            },
            price: d.price,
            stock: d.stock_quantity
        }));
    },

    getMyPharmacyId: async (): Promise<string | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        const { data, error } = await supabase
            .from('pharmacies')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) throw error;
        return data?.id ?? null;
    },

    createDrug: async (pharmacyId: string, payload: {
        name: string;
        description?: string;
        category?: string;
        price: number;
        stock: number;
        prescriptionRequired?: boolean;
        manufacturer?: string;
        expiryDate?: string | null;
    }): Promise<InventoryItem> => {
        const { data, error } = await supabase
            .from('drugs')
            .insert({
                pharmacy_id: pharmacyId,
                name: payload.name,
                description: payload.description || null,
                category: payload.category || null,
                price: payload.price,
                stock_quantity: payload.stock,
                prescription_required: payload.prescriptionRequired ?? false,
                manufacturer: payload.manufacturer || null,
                expiry_date: payload.expiryDate || null,
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            pharmacyId,
            drugId: data.id,
            drug: {
                id: data.id,
                name: data.name,
                description: data.description || "",
                category: data.category || "General",
                image: data.image_url,
                requiresPrescription: data.prescription_required
            },
            price: data.price,
            stock: data.stock_quantity
        };
    },

    updateDrug: async (drugId: string, payload: {
        name?: string;
        description?: string;
        category?: string;
        price?: number;
        stock?: number;
        prescriptionRequired?: boolean;
        manufacturer?: string;
        expiryDate?: string | null;
    }): Promise<void> => {
        const patch: Record<string, any> = {};
        if (payload.name !== undefined) patch.name = payload.name;
        if (payload.description !== undefined) patch.description = payload.description || null;
        if (payload.category !== undefined) patch.category = payload.category || null;
        if (payload.price !== undefined) patch.price = payload.price;
        if (payload.stock !== undefined) patch.stock_quantity = payload.stock;
        if (payload.prescriptionRequired !== undefined) patch.prescription_required = payload.prescriptionRequired;
        if (payload.manufacturer !== undefined) patch.manufacturer = payload.manufacturer || null;
        if (payload.expiryDate !== undefined) patch.expiry_date = payload.expiryDate || null;

        const { error } = await supabase.from('drugs').update(patch).eq('id', drugId);
        if (error) throw error;
    },

    deleteDrug: async (drugId: string): Promise<void> => {
        const { error } = await supabase.from('drugs').delete().eq('id', drugId);
        if (error) throw error;
    },


    getWallet: async (): Promise<{ balance: number; escrow: number } | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        const { data, error } = await supabase
            .from('wallets')
            .select('balance, escrow_balance')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return { balance: Number(data.balance || 0), escrow: Number(data.escrow_balance || 0) };
    },

    getMyPrescriptions: async (): Promise<DoctorPrescription[]> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('prescriptions')
            .select('id, created_at, notes, prescription_data, doctor_id, consultation_id')
            .eq('patient_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) throw error;

        const doctorIds = [...new Set((data ?? []).map((p: any) => p.doctor_id).filter(Boolean))];
        const nameById = new Map<string, string>();
        if (doctorIds.length) {
            const { data: profs } = await supabase
                .from('profiles')
                .select('user_id, first_name, last_name')
                .in('user_id', doctorIds);
            (profs ?? []).forEach((p: any) =>
                nameById.set(p.user_id, `Dr. ${[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'}`)
            );
        }

        return (data ?? []).map((p: any) => {
            const meds = Array.isArray(p.prescription_data)
                ? p.prescription_data
                : Array.isArray(p.prescription_data?.medications)
                    ? p.prescription_data.medications
                    : [];
            return {
                id: p.id,
                createdAt: p.created_at,
                notes: p.notes || '',
                doctorName: nameById.get(p.doctor_id) || 'Your doctor',
                medications: meds
                    .map((m: any) => (typeof m === 'string' ? m : m?.name || m?.drug || ''))
                    .filter(Boolean),
            };
        });
    },

    uploadPrescriptionImage: async (file: File): Promise<string> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('You must be signed in to upload a prescription');

        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('prescriptions').upload(path, file, { upsert: true });
        if (error) throw error;
        return path;
    },

    getPrescriptionImageUrl: async (path: string): Promise<string | null> => {
        const { data, error } = await supabase.storage.from('prescriptions').createSignedUrl(path, 3600);
        if (error) return null;
        return data?.signedUrl ?? null;
    },

    checkout: async (
        items: { drugId: string; quantity: number }[],
        deliveryAddress: string,
        prescription?: { prescriptionId?: string | null; prescriptionImagePath?: string | null }
    ) => {
        const { data, error } = await supabase.functions.invoke('checkout-order', {
            body: {
                items,
                deliveryAddress,
                paymentMethod: 'wallet',
                prescriptionId: prescription?.prescriptionId ?? null,
                prescriptionImageUrl: prescription?.prescriptionImagePath ?? null,
            },
        });

        if (error) {
            let details = error.message;
            const ctx = (error as any)?.context;
            if (ctx && typeof ctx.text === 'function') {
                try {
                    const raw = await ctx.text();
                    const parsed = JSON.parse(raw);
                    details = parsed.error || raw;
                    if (parsed.details?.length) {
                        details += `: ${parsed.details.map((d: any) => `${d.name} (only ${d.available} left)`).join(', ')}`;
                    }
                } catch {
                    /* keep default message */
                }
            }
            throw new Error(details);
        }

        return data as { orderId: string; totalAmount: number; commissionAmount: number; pharmacies: number };
    }
};

// Haversine formula for distance calculation (in km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}
