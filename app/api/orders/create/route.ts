import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/twilio";

interface OrderItem {
  itemName: string;
  quantity: number;
  unit: string;
  vendorId: string;
  expectedDeliveryDate?: string | null;
  cadenceSnapshot?: string | null;
}

interface CreateOrderBody {
  items: OrderItem[];
  deliveryBy: string;
}

interface VendorRow {
  id: string;
  name: string;
  contact_method: "phone" | "email" | "website";
  contact_value: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function formatDate(value: string | null | undefined): string {
  if (!value) return "TBD";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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

  const vendorIds = Array.from(new Set(items.map((i) => i.vendorId).filter(Boolean)));
  if (vendorIds.length === 0) {
    return NextResponse.json({ error: "Each item must have an assigned vendor" }, { status: 400 });
  }

  const { data: vendorRows, error: vendorsError } = await supabase
    .from("vendors")
    .select("id, name, contact_method, contact_value")
    .in("id", vendorIds);

  if (vendorsError || !vendorRows) {
    return NextResponse.json({ error: vendorsError?.message ?? "Failed to load vendors" }, { status: 500 });
  }

  const vendorById = new Map((vendorRows as VendorRow[]).map((v) => [v.id, v]));

  const uniqueVendors = new Set(items.map((i) => i.vendorId).filter(Boolean));
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
      { status: 500 },
    );
  }

  const orderId = order.id as string;
  const insertRows = items.map((item) => {
    const vendor = vendorById.get(item.vendorId);
    return {
      order_id: orderId,
      item_name: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      vendor_id: item.vendorId || null,
      vendor_name: vendor?.name ?? null,
      vendor_phone: vendor?.contact_method === "phone" ? vendor.contact_value : null,
      expected_delivery_date: item.expectedDeliveryDate ?? null,
      cadence_snapshot: item.cadenceSnapshot ?? null,
      outreach_status: "pending",
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(insertRows);
  if (itemsError) {
    console.error("[orders/create] insert order_items failed:", itemsError);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const byVendor = new Map<string, { vendor: VendorRow; items: OrderItem[] }>();
  for (const item of items) {
    const vendor = vendorById.get(item.vendorId);
    if (!vendor) continue;
    const current = byVendor.get(vendor.id) ?? { vendor, items: [] };
    current.items.push(item);
    byVendor.set(vendor.id, current);
  }

  const outreachResults = await Promise.allSettled(
    Array.from(byVendor.values()).map(async ({ vendor, items: vendorItems }) => {
      const vendorDelivery = vendorItems
        .map((i) => i.expectedDeliveryDate)
        .filter(Boolean)
        .sort()
        .at(-1);
      const deliveryDisplay = formatDate(vendorDelivery ?? deliveryBy);

      if (vendor.contact_method === "phone") {
        const message =
          `Hi ${vendor.name}, this is Harucake Bakery. We'd like to place an order:\n` +
          `${vendorItems.map((i) => `- ${i.quantity} ${i.unit} ${i.itemName}`).join("\n")}\n` +
          `Delivery needed by: ${deliveryDisplay}\n` +
          `Thank you!`;
        await sendSMS(vendor.contact_value, message);
        await supabase
          .from("order_items")
          .update({
            sms_sent: true,
            sms_sent_at: new Date().toISOString(),
            outreach_channel: "sms",
            outreach_status: "sent",
            outreach_error: null,
          })
          .eq("order_id", orderId)
          .eq("vendor_id", vendor.id);
        return;
      }

      if (vendor.contact_method === "email") {
        const response = await fetch(new URL("/api/email/vendor-outreach", req.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendorName: vendor.name,
            vendorEmail: vendor.contact_value,
            items: vendorItems.map((i) => ({
              itemName: i.itemName,
              quantity: i.quantity,
              unit: i.unit,
            })),
            deliveryBy: vendorDelivery ?? deliveryBy,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error ?? "Email outreach failed");
        }
        await supabase
          .from("order_items")
          .update({
            email_sent: true,
            email_sent_at: new Date().toISOString(),
            outreach_channel: "email",
            outreach_status: "sent",
            outreach_error: null,
          })
          .eq("order_id", orderId)
          .eq("vendor_id", vendor.id);
        return;
      }

      await supabase
        .from("order_items")
        .update({
          manual_outreach_required: true,
          outreach_channel: "website",
          outreach_status: "manual_required",
          outreach_error: null,
        })
        .eq("order_id", orderId)
        .eq("vendor_id", vendor.id);
    }),
  );

  await Promise.all(
    outreachResults.map(async (result, idx) => {
      if (result.status !== "rejected") return;
      const vendor = Array.from(byVendor.values())[idx]?.vendor;
      if (!vendor) return;
      await supabase
        .from("order_items")
        .update({
          outreach_status: "failed",
          outreach_error:
            result.reason instanceof Error ? result.reason.message : String(result.reason),
        })
        .eq("order_id", orderId)
        .eq("vendor_id", vendor.id);
    }),
  );

  return NextResponse.json({ id: orderId });
}
