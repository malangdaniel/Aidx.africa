
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

export interface InventoryItem {
    id: string;
    pharmacyId: string;
    drugId: string;
    drug: Drug;
    price: number;
    stock: number;
    discount?: number;
}

// Mock Data
const MOCK_PHARMACIES: Pharmacy[] = [
    {
        id: 'p1',
        name: "HealthPlus Pharmacy",
        location: { lat: 6.5244, lng: 3.3792 }, // Mainland
        address: "123 Herbert Macaulay Way, Yaba",
        rating: 4.5,
        isOpen: true
    },
    {
        id: 'p2',
        name: "MedSquare Pharmacy",
        location: { lat: 6.4281, lng: 3.4219 }, // VI
        address: "45 Adetokunbo Ademola, VI",
        rating: 4.8,
        isOpen: true
    },
    {
        id: 'p3',
        name: "Neighborhood Chemist",
        location: { lat: 6.6018, lng: 3.3515 }, // Ikeja
        address: "88 Allen Avenue, Ikeja",
        rating: 4.2,
        isOpen: true
    }
];

const MOCK_DRUGS: Drug[] = [
    {
        id: 'd1',
        name: "Paracetamol 500mg",
        description: "Pain reliever and fever reducer",
        category: "Pain Relief",
        requiresPrescription: false
    },
    {
        id: 'd2',
        name: "Amoxicillin 500mg",
        description: "Antibiotic used to treat bacterial infections",
        category: "Antibiotics",
        requiresPrescription: true
    },
    {
        id: 'd3',
        name: "Vitamin C 1000mg",
        description: "Immune system support supplement",
        category: "Supplements",
        requiresPrescription: false
    },
    {
        id: 'd4',
        name: "Ibuprofen 400mg",
        description: "Non-steroidal anti-inflammatory drug",
        category: "Pain Relief",
        requiresPrescription: false
    }
];

let MOCK_INVENTORY: InventoryItem[] = [
    {
        id: 'inv1',
        pharmacyId: 'p1',
        drugId: 'd1',
        drug: MOCK_DRUGS[0],
        price: 500,
        stock: 100
    },
    {
        id: 'inv2',
        pharmacyId: 'p1',
        drugId: 'd2',
        drug: MOCK_DRUGS[1],
        price: 1500,
        stock: 50
    },
    {
        id: 'inv3',
        pharmacyId: 'p2',
        drugId: 'd1',
        drug: MOCK_DRUGS[0],
        price: 550,
        stock: 200
    },
    {
        id: 'inv4',
        pharmacyId: 'p3',
        drugId: 'd3',
        drug: MOCK_DRUGS[2],
        price: 1200,
        stock: 30
    }
];

export const PharmacyService = {
    getPharmacies: async (): Promise<Pharmacy[]> => {
        return new Promise((resolve) => setTimeout(() => resolve(MOCK_PHARMACIES), 500));
    },

    getAllDrugs: async (): Promise<Drug[]> => {
        return new Promise((resolve) => setTimeout(() => resolve(MOCK_DRUGS), 500));
    },

    searchDrugs: async (query: string, userLocation?: GeoLocation): Promise<{ item: InventoryItem; pharmacy: Pharmacy; distance?: number }[]> => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        const lowerQuery = query.toLowerCase();
        const results: { item: InventoryItem; pharmacy: Pharmacy; distance?: number }[] = [];

        MOCK_INVENTORY.forEach(item => {
            if (item.drug.name.toLowerCase().includes(lowerQuery) || item.drug.description.toLowerCase().includes(lowerQuery)) {
                const pharmacy = MOCK_PHARMACIES.find(p => p.id === item.pharmacyId);
                if (pharmacy) {
                    let distance = 0;
                    if (userLocation) {
                        distance = calculateDistance(userLocation.lat, userLocation.lng, pharmacy.location.lat, pharmacy.location.lng);
                    }
                    results.push({ item, pharmacy, distance });
                }
            }
        });

        if (userLocation) {
            // Sort by distance if location provided
            results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        }

        return results;
    },

    getInventory: async (pharmacyId: string): Promise<InventoryItem[]> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(MOCK_INVENTORY.filter(i => i.pharmacyId === pharmacyId));
            }, 500);
        });
    },

    addToInventory: async (pharmacyId: string, drugId: string, price: number, stock: number): Promise<InventoryItem> => {
        return new Promise((resolve) => {
            const drug = MOCK_DRUGS.find(d => d.id === drugId);
            if (!drug) throw new Error("Drug not found");

            const newItem: InventoryItem = {
                id: `inv${Date.now()}`,
                pharmacyId,
                drugId,
                drug,
                price,
                stock
            };
            MOCK_INVENTORY.push(newItem);
            setTimeout(() => resolve(newItem), 500);
        });
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
