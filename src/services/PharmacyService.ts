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
    generic_name?: string | null;
    brand_name?: string | null;
    active_ingredients?: string | null;
    strength?: string | null;
    dosage_form?: string | null;
    route?: string | null;
    manufacturer?: string | null;
    nafdac_registration_number?: string | null;
}

export interface DrugCatalogueItem {
    id: string;
    name: string;
    generic_name: string | null;
    brand_name: string | null;
    active_ingredients: any;
    strength: string | null;
    dosage_form: string | null;
    route: string | null;
    category: string | null;
    manufacturer: string | null;
    description: string | null;
    nafdac_registration_number: string | null;
    prescription_required: boolean | null;
    verification_status: string | null;
    source_of_verification: string | null;
    product_code: string | null;
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
    catalogue_id?: string | null;
    verification_status?: string | null;
    nafdac_registration_number?: string | null;
    expiry_date?: string | null;
    dosage_instructions?: string | null;
    raw?: any;
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

    searchDrugCatalogue: async (query: string): Promise<DrugCatalogueItem[]> => {
        const trimmed = query.trim();
        if (trimmed.length < 2) return [];

        // Query drug_catalogue with ilike on name, generic_name, and brand_name, limit 20
        // READ-ONLY for pharmacists: never insert/update/delete it
        const { data, error } = await supabase
            .from('drug_catalogue')
            .select('*')
            .or(`name.ilike.%${trimmed}%,generic_name.ilike.%${trimmed}%,brand_name.ilike.%${trimmed}%`)
            .limit(20);

        if (error) throw error;
        return (data || []) as DrugCatalogueItem[];
    },

    getInventory: async (pharmacyId: string): Promise<InventoryItem[]> => {
        const { data, error } = await supabase
            .from('drugs')
            .select('*')
            .eq('pharmacy_id', pharmacyId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((d: any) => ({
            id: d.id,
            pharmacyId: pharmacyId,
            drugId: d.id,
            drug: {
                id: d.id,
                name: d.name,
                description: d.description || "",
                category: d.category || "General",
                image: d.image_url,
                requiresPrescription: d.prescription_required,
                generic_name: d.generic_name,
                brand_name: d.brand_name,
                strength: d.strength,
                dosage_form: d.dosage_form,
                route: d.route,
                manufacturer: d.manufacturer,
                nafdac_registration_number: d.nafdac_registration_number,
            },
            price: d.price,
            stock: d.stock_quantity,
            catalogue_id: d.catalogue_id,
            verification_status: d.verification_status,
            nafdac_registration_number: d.nafdac_registration_number,
            expiry_date: d.expiry_date,
            dosage_instructions: d.dosage_instructions,
            raw: d,
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
        generic_name?: string | null;
        brand_name?: string | null;
        active_ingredients?: string | null;
        strength?: string | null;
        dosage_form?: string | null;
        route?: string | null;
        category?: string | null;
        manufacturer?: string | null;
        description?: string | null;
        nafdac_registration_number?: string | null;
        prescription_required?: boolean;
        price: number;
        stock: number;
        expiryDate?: string | null;
        dosage_instructions?: string | null;
        image_url?: string | null;
        catalogue_id?: string | null;
        verification_status?: string | null;
    }): Promise<InventoryItem> => {
        const { data, error } = await supabase
            .from('drugs')
            .insert({
                pharmacy_id: pharmacyId,
                catalogue_id: payload.catalogue_id || null,
                verification_status: payload.verification_status || 'unverified',
                name: payload.name,
                generic_name: payload.generic_name || null,
                brand_name: payload.brand_name || null,
                active_ingredients: payload.active_ingredients || null,
                strength: payload.strength || null,
                dosage_form: payload.dosage_form || null,
                route: payload.route || null,
                category: payload.category || null,
                manufacturer: payload.manufacturer || null,
                description: payload.description || null,
                nafdac_registration_number: payload.nafdac_registration_number || null,
                prescription_required: payload.prescription_required ?? false,
                price: payload.price,
                stock_quantity: payload.stock,
                expiry_date: payload.expiryDate || null,
                dosage_instructions: payload.dosage_instructions || null,
                image_url: payload.image_url || null,
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
                requiresPrescription: data.prescription_required,
                generic_name: data.generic_name,
                brand_name: data.brand_name,
                strength: data.strength,
                dosage_form: data.dosage_form,
                route: data.route,
                manufacturer: data.manufacturer,
                nafdac_registration_number: data.nafdac_registration_number,
            },
            price: data.price,
            stock: data.stock_quantity,
            catalogue_id: data.catalogue_id,
            verification_status: data.verification_status,
            nafdac_registration_number: data.nafdac_registration_number,
            expiry_date: data.expiry_date,
            dosage_instructions: data.dosage_instructions,
            raw: data,
        };
    },

    updateDrug: async (drugId: string, payload: {
        name?: string;
        generic_name?: string | null;
        brand_name?: string | null;
        active_ingredients?: string | null;
        strength?: string | null;
        dosage_form?: string | null;
        route?: string | null;
        category?: string | null;
        manufacturer?: string | null;
        description?: string | null;
        nafdac_registration_number?: string | null;
        prescription_required?: boolean;
        price?: number;
        stock?: number;
        expiryDate?: string | null;
        dosage_instructions?: string | null;
        image_url?: string | null;
        catalogue_id?: string | null;
        verification_status?: string | null;
    }): Promise<void> => {
        const patch: Record<string, any> = {};
        if (payload.name !== undefined) patch.name = payload.name;
        if (payload.generic_name !== undefined) patch.generic_name = payload.generic_name || null;
        if (payload.brand_name !== undefined) patch.brand_name = payload.brand_name || null;
        if (payload.active_ingredients !== undefined) patch.active_ingredients = payload.active_ingredients || null;
        if (payload.strength !== undefined) patch.strength = payload.strength || null;
        if (payload.dosage_form !== undefined) patch.dosage_form = payload.dosage_form || null;
        if (payload.route !== undefined) patch.route = payload.route || null;
        if (payload.category !== undefined) patch.category = payload.category || null;
        if (payload.manufacturer !== undefined) patch.manufacturer = payload.manufacturer || null;
        if (payload.description !== undefined) patch.description = payload.description || null;
        if (payload.nafdac_registration_number !== undefined) patch.nafdac_registration_number = payload.nafdac_registration_number || null;
        if (payload.prescription_required !== undefined) patch.prescription_required = payload.prescription_required;
        if (payload.price !== undefined) patch.price = payload.price;
        if (payload.stock !== undefined) patch.stock_quantity = payload.stock;
        if (payload.expiryDate !== undefined) patch.expiry_date = payload.expiryDate || null;
        if (payload.dosage_instructions !== undefined) patch.dosage_instructions = payload.dosage_instructions || null;
        if (payload.image_url !== undefined) patch.image_url = payload.image_url || null;
        if (payload.catalogue_id !== undefined) patch.catalogue_id = payload.catalogue_id || null;
        if (payload.verification_status !== undefined) patch.verification_status = payload.verification_status || null;

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

        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${user.id}/${Date.now()}-${cleanName}`;
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
        prescription?: { prescriptionId?: string | null; prescriptionImagePath?: string | null; deliveryInstructions?: string | null }
    ) => {
        const { data, error } = await (supabase.rpc as any)('place_pharmacy_order', {
            p_items: items,
            p_delivery_address: deliveryAddress,
            p_delivery_instructions: prescription?.deliveryInstructions || null,
            p_prescription_id: prescription?.prescriptionId || null,
            p_prescription_image_url: prescription?.prescriptionImagePath || null,
        });

        if (error) {
            throw new Error(error.message || 'Failed to place order');
        }

        return data as { orderId: string; totalAmount: number; commissionAmount: number; pharmacies: number; paymentMethod: string };
    },

    updatePharmacyOrderStatus: async (childOrderId: string, status: string, reason = '') => {
        const { data, error } = await (supabase.rpc as any)('pharmacy_set_order_status', {
            p_child_order_id: childOrderId,
            p_new_status: status,
            p_reason: reason || null,
        });
        if (error) throw new Error(error.message || 'Failed to update order status');
        return data;
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
