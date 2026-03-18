// ─── Inventory ───────────────────────────────────────────────────────────────

/** Shape used throughout the UI (camelCase). */
export interface InventoryItem {
  id: string;
  productName: string;
  quantityRemaining: number;
  stockLevel: "Low" | "High";
  qtyIn: number;
  qtyOut: number;
  qtyBalance: number;
  skuId: string;
  imageUrl?: string | null;
  /** Derived: qtyBalance / qtyIn * 100, clamped 0–100 */
  stockPercent: number;
}

/** Raw row returned by Supabase for the `items` table. */
export interface ItemRow {
  id: string;
  product_name: string;
  quantity_remaining: number;
  stock_level: "low" | "high";
  qty_in: number;
  qty_out: number;
  qty_balance: number;
  sku_id: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export function itemRowToInventoryItem(row: ItemRow): InventoryItem {
  const stockPercent =
    row.qty_in > 0 ? Math.round((row.qty_balance / row.qty_in) * 100) : 0;
  return {
    id: row.id,
    productName: row.product_name,
    quantityRemaining: row.quantity_remaining,
    stockLevel: row.stock_level === "low" ? "Low" : "High",
    qtyIn: row.qty_in,
    qtyOut: row.qty_out,
    qtyBalance: row.qty_balance,
    skuId: row.sku_id,
    imageUrl: row.image_url,
    stockPercent: Math.min(100, Math.max(0, stockPercent)),
  };
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  customer: string;
  orderSource: string;
  type: string;
  items: string; // badge label derived from items JSONB
  channel: string;
  location: string;
  orderDate: string; // formatted for display
  status: "active" | "scheduled" | "completed" | "cancelled";
}

/** Raw row returned by Supabase for the `orders` table. */
export interface OrderRow {
  id: string;
  customer: string;
  order_source: string;
  type: string;
  items: { name: string; qty: number }[] | null;
  channel: string;
  location: string;
  order_date: string;
  status: "active" | "scheduled" | "completed" | "cancelled";
  payment_status: string;
  created_at: string;
}

export function orderRowToOrder(row: OrderRow): Order {
  const itemCount = Array.isArray(row.items) ? row.items.length : 0;
  const badge = itemCount > 0 ? String(itemCount) : "—";
  const date = row.order_date
    ? new Date(row.order_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  return {
    id: row.id,
    customer: row.customer,
    orderSource: row.order_source,
    type: row.type,
    items: badge,
    channel: row.channel,
    location: row.location,
    orderDate: date,
    status: row.status,
  };
}
