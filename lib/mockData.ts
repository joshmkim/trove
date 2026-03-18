export interface InventoryItem {
  id: string;
  productName: string;
  quantityRemaining: number;
  stockLevel: "Low" | "High";
  qtyIn: number;
  qtyOut: number;
  qtyBalance: number;
  skuId: string;
  stockPercent: number; // 0–100, used for the progress bar
}

export const mockInventory: InventoryItem[] = [
  {
    id: "1",
    productName: "All-Purpose Flour",
    quantityRemaining: 12,
    stockLevel: "Low",
    qtyIn: 50,
    qtyOut: 38,
    qtyBalance: 12,
    skuId: "SKU-001",
    stockPercent: 24,
  },
  {
    id: "2",
    productName: "Unsalted Butter",
    quantityRemaining: 48,
    stockLevel: "High",
    qtyIn: 60,
    qtyOut: 12,
    qtyBalance: 48,
    skuId: "SKU-002",
    stockPercent: 80,
  },
  {
    id: "3",
    productName: "Granulated Sugar",
    quantityRemaining: 8,
    stockLevel: "Low",
    qtyIn: 40,
    qtyOut: 32,
    qtyBalance: 8,
    skuId: "SKU-003",
    stockPercent: 20,
  },
  {
    id: "4",
    productName: "Heavy Cream",
    quantityRemaining: 30,
    stockLevel: "High",
    qtyIn: 36,
    qtyOut: 6,
    qtyBalance: 30,
    skuId: "SKU-004",
    stockPercent: 83,
  },
  {
    id: "5",
    productName: "Free-Range Eggs",
    quantityRemaining: 6,
    stockLevel: "Low",
    qtyIn: 30,
    qtyOut: 24,
    qtyBalance: 6,
    skuId: "SKU-005",
    stockPercent: 20,
  },
  {
    id: "6",
    productName: "Vanilla Extract",
    quantityRemaining: 22,
    stockLevel: "High",
    qtyIn: 24,
    qtyOut: 2,
    qtyBalance: 22,
    skuId: "SKU-006",
    stockPercent: 92,
  },
  {
    id: "7",
    productName: "Baking Powder",
    quantityRemaining: 15,
    stockLevel: "High",
    qtyIn: 20,
    qtyOut: 5,
    qtyBalance: 15,
    skuId: "SKU-007",
    stockPercent: 75,
  },
  {
    id: "8",
    productName: "Cocoa Powder",
    quantityRemaining: 4,
    stockLevel: "Low",
    qtyIn: 18,
    qtyOut: 14,
    qtyBalance: 4,
    skuId: "SKU-008",
    stockPercent: 22,
  },
];
