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
  // ML / ordering columns (added in migration 006)
  unit: string | null;
  purchase_unit: string | null;
  purchase_unit_size: number | null;
  reorder_threshold: number | null;
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
  unitPrice?: number;
  lineTotal?: number;
}

export interface EditableInvoiceItem {
  id: number;
  productName: string;
  qtyIn: string;
  skuId: string;
  unitPrice: string;
  lineTotal: string;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  customer: string;
  orderSource: string;
  type: string;
  items: string; // badge label — "—" when loaded from DB (requires separate join)
  channel: string;
  location: string;
  orderDate: string; // formatted for display
  deliveryBy: string | null;
  totalVendors: number;
  status: "pending" | "accepted" | "completed" | "cancelled";
}

/** Raw row returned by Supabase for the `orders` table. */
export interface OrderRow {
  id: string;
  customer: string;
  order_source: string;
  type: string;
  channel: string;
  location: string;
  order_date: string;
  delivery_by: string | null;
  total_vendors: number;
  notes: string | null;
  status: "pending" | "accepted" | "completed" | "cancelled";
  payment_status: string | null;
  created_at: string;
}

// ─── Purchase Orders (orders + order_items join) ─────────────────────────────

export interface PurchaseOrderItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  vendorId: string | null;
  vendorName: string | null;
  vendorPhone: string | null;
  smsSent: boolean;
  smsSentAt: string | null;
}

export interface PurchaseOrder {
  id: string;
  status: "pending" | "accepted" | "completed" | "cancelled";
  deliveryBy: string | null;
  totalVendors: number;
  notes: string | null;
  orderDate: string;
  createdAt: string;
  items: PurchaseOrderItem[];
}

/** Raw order_items row as returned by Supabase. */
export interface PurchaseOrderItemRow {
  id: string;
  order_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  vendor_id: string | null;
  vendor_name: string | null;
  vendor_phone: string | null;
  sms_sent: boolean;
  sms_sent_at: string | null;
  created_at: string;
}

/** Raw orders row with nested order_items (select "*, order_items(*)"). */
export interface PurchaseOrderRow {
  id: string;
  status: "pending" | "accepted" | "completed" | "cancelled";
  delivery_by: string | null;
  total_vendors: number;
  notes: string | null;
  payment_status: string | null;
  order_date: string;
  created_at: string;
  updated_at: string;
  order_items: PurchaseOrderItemRow[];
}

export function orderRowToPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
  return {
    id: row.id,
    status: row.status,
    deliveryBy: row.delivery_by,
    totalVendors: row.total_vendors,
    notes: row.notes,
    orderDate: row.order_date,
    createdAt: row.created_at,
    items: (row.order_items ?? []).map((i) => ({
      id: i.id,
      itemName: i.item_name,
      quantity: i.quantity,
      unit: i.unit,
      vendorId: i.vendor_id,
      vendorName: i.vendor_name,
      vendorPhone: i.vendor_phone,
      smsSent: i.sms_sent,
      smsSentAt: i.sms_sent_at,
    })),
  };
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

export function formatUnitLabel(unit: string, quantity: number): string {
  const normalized = (unit || "unit").trim().toLowerCase();
  const isSingular = Math.abs(quantity) === 1;

  if (isSingular) return normalized;

  const irregular: Record<string, string> = {
    loaf: "loaves",
    box: "boxes",
  };

  if (irregular[normalized]) return irregular[normalized];
  if (normalized.endsWith("s")) return normalized;
  return `${normalized}s`;
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
    items: "—",
    channel: row.channel,
    location: row.location,
    orderDate: date,
    deliveryBy: row.delivery_by,
    totalVendors: row.total_vendors,
    status: row.status,
  };
}
