import type { SupabaseClient } from "@supabase/supabase-js";

export type VendorStatus = "my_vendor" | "not_onboarded";
export type VendorContactMethod = "phone" | "email" | "website";
export type OrderCadence = "daily" | "weekly" | "biweekly" | "custom_days";

export interface VendorProductOffer {
  itemId: string;
  productName: string;
  pricePerUnit: number;
  unit: string;
  orderCadence: OrderCadence;
  cadenceDays: number | null;
  nextOrderDate: string | null;
  isPrimary: boolean;
}

export interface VendorRecord {
  id: string;
  name: string;
  status: VendorStatus;
  contactMethod: VendorContactMethod;
  contactValue: string;
  reliabilityScore: number;
  leadTimeDays: number;
  responseTimeHours: number;
  advanceOrderDays: number;
  products: VendorProductOffer[];
}

type VendorRow = {
  id: string;
  name: string;
  vendor_status: VendorStatus;
  contact_method: VendorContactMethod;
  contact_value: string;
  reliability_score: number;
  lead_time_days: number;
  response_time_hours: number;
  advance_order_days: number;
};

type VendorProductRow = {
  vendor_id: string;
  item_id: string;
  price_per_unit: number | null;
  unit: string | null;
  order_cadence: OrderCadence;
  cadence_days: number | null;
  next_order_date: string | null;
  is_primary: boolean;
};

type ItemRow = {
  id: string;
  product_name: string;
};

export function normalizeProductName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function cadenceLabel(cadence: OrderCadence, cadenceDays: number | null): string {
  if (cadence === "custom_days") {
    return cadenceDays ? `Every ${cadenceDays} days` : "Custom cadence";
  }
  if (cadence === "daily") return "Daily";
  if (cadence === "weekly") return "Weekly";
  return "Biweekly";
}

/** Earliest `next_order_date` across a vendor's products (ISO `YYYY-MM-DD`); null if none set. */
export function earliestNextOrderDate(v: VendorRecord): string | null {
  let min: string | null = null;
  for (const p of v.products) {
    if (!p.nextOrderDate) continue;
    if (min === null || p.nextOrderDate < min) min = p.nextOrderDate;
  }
  return min;
}

/** Sort soonest order deadline first; vendors with no dates last; tie-break by name. */
export function compareVendorsByUrgency(a: VendorRecord, b: VendorRecord): number {
  const ka = earliestNextOrderDate(a);
  const kb = earliestNextOrderDate(b);
  if (ka === null && kb === null) return a.name.localeCompare(b.name);
  if (ka === null) return 1;
  if (kb === null) return -1;
  const c = ka.localeCompare(kb);
  if (c !== 0) return c;
  return a.name.localeCompare(b.name);
}

export async function fetchVendorsWithProducts(supabase: SupabaseClient): Promise<VendorRecord[]> {
  const { data: vendorRows, error: vendorsError } = await supabase
    .from("vendors")
    .select(
      "id, name, vendor_status, contact_method, contact_value, reliability_score, lead_time_days, response_time_hours, advance_order_days",
    )
    .order("name", { ascending: true });

  if (vendorsError || !vendorRows) {
    throw new Error(vendorsError?.message ?? "Failed to load vendors");
  }

  const ids = (vendorRows as VendorRow[]).map((v) => v.id);
  if (ids.length === 0) return [];

  const { data: vpRows, error: vpError } = await supabase
    .from("vendor_products")
    .select(
      "vendor_id, item_id, price_per_unit, unit, order_cadence, cadence_days, next_order_date, is_primary",
    )
    .in("vendor_id", ids);

  if (vpError || !vpRows) {
    throw new Error(vpError?.message ?? "Failed to load vendor products");
  }

  const itemIds = Array.from(new Set((vpRows as VendorProductRow[]).map((r) => r.item_id)));
  const itemNameById = new Map<string, string>();

  if (itemIds.length > 0) {
    const { data: itemRows, error: itemError } = await supabase
      .from("items")
      .select("id, product_name")
      .in("id", itemIds);

    if (itemError || !itemRows) {
      throw new Error(itemError?.message ?? "Failed to load item names");
    }
    (itemRows as ItemRow[]).forEach((item) => itemNameById.set(item.id, item.product_name));
  }

  const offersByVendor = new Map<string, VendorProductOffer[]>();
  (vpRows as VendorProductRow[]).forEach((row) => {
    const next = offersByVendor.get(row.vendor_id) ?? [];
    next.push({
      itemId: row.item_id,
      productName: itemNameById.get(row.item_id) ?? "Unknown item",
      pricePerUnit: row.price_per_unit ?? 0,
      unit: row.unit ?? "unit",
      orderCadence: row.order_cadence,
      cadenceDays: row.cadence_days,
      nextOrderDate: row.next_order_date,
      isPrimary: row.is_primary,
    });
    offersByVendor.set(row.vendor_id, next);
  });

  return (vendorRows as VendorRow[]).map((v) => ({
    id: v.id,
    name: v.name,
    status: v.vendor_status,
    contactMethod: v.contact_method,
    contactValue: v.contact_value,
    reliabilityScore: v.reliability_score,
    leadTimeDays: v.lead_time_days,
    responseTimeHours: v.response_time_hours,
    advanceOrderDays: v.advance_order_days,
    products: offersByVendor.get(v.id) ?? [],
  }));
}
