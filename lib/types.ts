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
  sku_id: string | null;
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
    skuId: row.sku_id ?? "",
    imageUrl: row.image_url,
    stockPercent: Math.min(100, Math.max(0, stockPercent)),
  };
}

// ─── Invoice Parsing ─────────────────────────────────────────────────────────

export interface ParsedInvoiceItem {
  productName: string;
  qtyIn: number;
  skuId: string;
}

export interface EditableInvoiceItem {
  id: number;
  productName: string;
  qtyIn: string;
  skuId: string;
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

// ─── Demand Forecasts ────────────────────────────────────────────────────────

export interface DemandForecast {
  id: string;
  ingredientName: string;
  forecastDate: string;
  predictedDemand: number;
  currentStock: number;
  safetyStock: number;
  recommendedOrder: number;
  unit: string;
  confidenceScore: number | null;
}

export interface DemandForecastRow {
  id: string;
  ingredient_name: string;
  forecast_date: string;
  predicted_demand: number;
  current_stock: number | null;
  safety_stock: number | null;
  recommended_order: number | null;
  unit: string;
  confidence_score: number | null;
  created_at: string;
}

export function forecastRowToForecast(row: DemandForecastRow): DemandForecast {
  return {
    id: row.id,
    ingredientName: row.ingredient_name,
    forecastDate: row.forecast_date,
    predictedDemand: row.predicted_demand,
    currentStock: row.current_stock ?? 0,
    safetyStock: row.safety_stock ?? 0,
    recommendedOrder: row.recommended_order ?? 0,
    unit: row.unit,
    confidenceScore: row.confidence_score,
  };
}

export function forecastStatus(
  forecast: DemandForecast
): "critical" | "tight" | "ok" {
  const remaining = forecast.currentStock - forecast.predictedDemand;
  if (remaining < 0) return "critical";
  if (remaining < forecast.safetyStock) return "tight";
  return "ok";
}

// ─────────────────────────────────────────────────────────────────────────────

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
