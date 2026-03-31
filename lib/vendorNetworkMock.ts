export type VendorContact = {
  email?: string;
  phone?: string;
};

export type VendorProductOffer = {
  productName: string;
  pricePerUnit: number;
  unit: "kg" | "g" | "L" | "count" | "box";
  notes?: string;
};

export type Vendor = {
  id: string;
  name: string;
  contact: VendorContact;
  products: VendorProductOffer[];
  reliabilityScore: number; // 0–100
  avgLeadTimeDays: number;
  responseTimeHours: number;
  advanceOrderDays: number;
};

const vendors: Vendor[] = [
  {
    id: "v1",
    name: "Greenfield Dairy Co.",
    contact: { email: "orders@greenfielddairy.com", phone: "+1 (555) 201-1001" },
    products: [
      { productName: "Whole Milk 1L", pricePerUnit: 2.3, unit: "L" },
    ],
    reliabilityScore: 94,
    avgLeadTimeDays: 2,
    responseTimeHours: 4,
    advanceOrderDays: 3,
  },
  {
    id: "v2",
    name: "Sunrise Flour Mill",
    contact: { email: "sales@sunriseflour.com", phone: "+1 (555) 201-2002" },
    products: [
      { productName: "All-Purpose Flour 25kg", pricePerUnit: 0.96, unit: "kg" },
    ],
    reliabilityScore: 88,
    avgLeadTimeDays: 3,
    responseTimeHours: 12,
    advanceOrderDays: 5,
  },
  {
    id: "v3",
    name: "Cocoa Collective",
    contact: { email: "hello@cocoacollective.com", phone: "+1 (555) 201-3003" },
    products: [
      { productName: "Cocoa Powder 1kg", pricePerUnit: 0.0095, unit: "g" },
    ],
    reliabilityScore: 76,
    avgLeadTimeDays: 5,
    responseTimeHours: 24,
    advanceOrderDays: 10,
  },
  {
    id: "v4",
    name: "Harvest Eggs",
    contact: { email: "orders@harvesteggs.com", phone: "+1 (555) 201-4004" },
    products: [
      { productName: "Free-Range Eggs (30ct)", pricePerUnit: 0.24, unit: "count" },
    ],
    reliabilityScore: 91,
    avgLeadTimeDays: 1,
    responseTimeHours: 3,
    advanceOrderDays: 2,
  },
  {
    id: "v5",
    name: "Vanilla Origins",
    contact: { email: "trade@vanillaorigins.com", phone: "+1 (555) 201-5005" },
    products: [
      { productName: "Vanilla Extract 1L", pricePerUnit: 39, unit: "L" },
    ],
    reliabilityScore: 82,
    avgLeadTimeDays: 7,
    responseTimeHours: 8,
    advanceOrderDays: 14,
  },
  {
    id: "v6",
    name: "Urban Produce",
    contact: { email: "fresh@urbanproduce.com", phone: "+1 (555) 201-6006" },
    products: [
      { productName: "Berries Assorted 1kg", pricePerUnit: 11, unit: "kg" },
    ],
    reliabilityScore: 79,
    avgLeadTimeDays: 2,
    responseTimeHours: 6,
    advanceOrderDays: 3,
  },
  {
    id: "v7",
    name: "Creamline Supply",
    contact: { email: "orders@creamline.co", phone: "+1 (555) 201-7007" },
    products: [{ productName: "Cream 35%", pricePerUnit: 4.45, unit: "L" }],
    reliabilityScore: 87,
    avgLeadTimeDays: 3,
    responseTimeHours: 5,
    advanceOrderDays: 4,
  },
  {
    id: "v8",
    name: "Atlas Bread Ingredients",
    contact: { email: "sales@atlasbread.com", phone: "+1 (555) 201-8008" },
    products: [{ productName: "Bread Flour 25kg", pricePerUnit: 1.02, unit: "kg" }],
    reliabilityScore: 90,
    avgLeadTimeDays: 2,
    responseTimeHours: 7,
    advanceOrderDays: 3,
  },
  {
    id: "v9",
    name: "Obsidian Chocolate Works",
    contact: { email: "trade@obsidianchoco.com", phone: "+1 (555) 201-9009" },
    products: [{ productName: "Dark Chocolate 70%", pricePerUnit: 13.5, unit: "kg" }],
    reliabilityScore: 84,
    avgLeadTimeDays: 4,
    responseTimeHours: 10,
    advanceOrderDays: 8,
  },
  {
    id: "v10",
    name: "Seasonal Harvest Boxes",
    contact: { email: "fresh@harvestboxes.com", phone: "+1 (555) 201-1010" },
    products: [{ productName: "Seasonal Fruit Box", pricePerUnit: 18.5, unit: "box" }],
    reliabilityScore: 78,
    avgLeadTimeDays: 2,
    responseTimeHours: 9,
    advanceOrderDays: 4,
  },
  {
    id: "v11",
    name: "PeakBerry Distributors",
    contact: { email: "orders@peakberry.co", phone: "+1 (555) 201-1111" },
    products: [{ productName: "Berries Assorted 1kg", pricePerUnit: 10.75, unit: "kg" }],
    reliabilityScore: 83,
    avgLeadTimeDays: 3,
    responseTimeHours: 6,
    advanceOrderDays: 3,
  },
  {
    id: "v12",
    name: "FarmNest Eggs",
    contact: { email: "hello@farmnesteggs.com", phone: "+1 (555) 201-1212" },
    products: [{ productName: "Free-Range Eggs (30ct)", pricePerUnit: 0.22, unit: "count" }],
    reliabilityScore: 92,
    avgLeadTimeDays: 1,
    responseTimeHours: 4,
    advanceOrderDays: 2,
  },
];

export function getVendorNetwork(): Vendor[] {
  return vendors;
}

export function getAllVendorProducts(): string[] {
  const set = new Set<string>();
  for (const v of vendors) {
    for (const p of v.products) {
      set.add(p.productName);
    }
  }
  return Array.from(set).sort();
}

