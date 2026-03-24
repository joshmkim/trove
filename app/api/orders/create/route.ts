import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/twilio";

interface OrderItem {
  itemName: string;
  quantity: number;
  unit: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
}

interface CreateOrderBody {
  items: OrderItem[];
  deliveryBy: string;
}

// Use service-role key if available so RLS doesn't block server-side writes;
// falls back to anon key for development.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  let body: CreateOrderBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items, deliveryBy } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
  }

  // Count unique vendors
  const uniqueVendors = new Set(items.map((i) => i.vendorId).filter(Boolean));

  // ── 1. Insert order ────────────────────────────────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      status: "pending",
      delivery_by: deliveryBy || null,
      total_vendors: uniqueVendors.size,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[orders/create] insert order failed:", orderError);
    return NextResponse.json(
      { error: orderError?.message ?? "Failed to create order" },
      { status: 500 }
    );
  }

  const orderId = order.id as string;

  // ── 2. Insert order_items ──────────────────────────────────────────────────
  const { error: itemsError } = await supabase.from("order_items").insert(
    items.map((item) => ({
      order_id: orderId,
      item_name: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      vendor_id: item.vendorId || null,
      vendor_name: item.vendorName || null,
      vendor_phone: item.vendorPhone || null,
    }))
  );

  if (itemsError) {
    console.error("[orders/create] insert order_items failed:", itemsError);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // ── 3. Group items by vendor and send one SMS per vendor ───────────────────
  const byVendor = new Map<string, { name: string; phone: string; items: OrderItem[] }>();

  for (const item of items) {
    if (!item.vendorPhone) continue;
    const key = item.vendorPhone;
    if (!byVendor.has(key)) {
      byVendor.set(key, { name: item.vendorName, phone: item.vendorPhone, items: [] });
    }
    byVendor.get(key)!.items.push(item);
  }

  const deliveryDisplay = deliveryBy
    ? new Date(deliveryBy).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  const smsResults = await Promise.allSettled(
    Array.from(byVendor.values()).map(async (vendor) => {
      const lines = vendor.items
        .map((i) => `- ${i.quantity} ${i.unit} ${i.itemName}`)
        .join("\n");

      const message =
        `Hi ${vendor.name}, this is Harucake Bakery. We'd like to place an order:\n` +
        `${lines}\n` +
        `Delivery needed by: ${deliveryDisplay}\n` +
        `Thank you!`;

      await sendSMS(vendor.phone, message);

      // Mark items for this vendor as sms_sent
      await supabase
        .from("order_items")
        .update({ sms_sent: true, sms_sent_at: new Date().toISOString() })
        .eq("order_id", orderId)
        .eq("vendor_phone", vendor.phone);
    })
  );

  // Log any SMS failures but don't fail the request
  smsResults.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`[orders/create] SMS failed for vendor ${i}:`, result.reason);
    }
  });

  return NextResponse.json({ id: orderId });
}
