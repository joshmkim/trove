import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchRecentOrders } from "@/lib/clover";

export const dynamic = "force-dynamic";

// Default: Jan 1 2023 00:00:00 UTC
const DEFAULT_SINCE_MS = 1_672_531_200_000;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const sinceMs = searchParams.get("since") ? Number(searchParams.get("since")) : DEFAULT_SINCE_MS;

  console.log(`[clover/backfill] Fetching all orders since ${new Date(sinceMs).toISOString()} …`);

  let orders;
  try {
    orders = await fetchRecentOrders(sinceMs);
  } catch (err) {
    console.error("[clover/backfill] fetchRecentOrders failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  console.log(`[clover/backfill] Fetched ${orders.length} orders from Clover.`);

  const supabase = getSupabase();

  // Fetch already-stored order IDs in one query to avoid N+1 checks
  const { data: existing } = await supabase
    .from("clover_processed_orders")
    .select("clover_order_id");

  const existingIds = new Set((existing ?? []).map((r: { clover_order_id: string }) => r.clover_order_id));

  const toInsert = orders.filter((o) => !existingIds.has(o.id));

  if (toInsert.length === 0) {
    return NextResponse.json({
      inserted: 0,
      skipped: orders.length,
      total: orders.length,
      message: "All orders already stored.",
    });
  }

  // Insert in batches of 100 — no deductIngredients, just raw order data for training
  const BATCH = 100;
  let inserted = 0;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH).map((order) => {
      const lineItems = order.lineItems?.elements ?? [];
      return {
        clover_order_id: order.id,
        merchant_id: process.env.CLOVER_MERCHANT_ID ?? "",
        line_item_count: lineItems.length,
        order_created_at: order.createdTime
          ? new Date(order.createdTime).toISOString()
          : new Date().toISOString(),
        line_items: lineItems,
        deducted: [], // no deductions for historical backfill
      };
    });

    const { error } = await supabase.from("clover_processed_orders").insert(batch);
    if (error) {
      console.error(`[clover/backfill] Insert batch ${i}–${i + BATCH} failed:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`[clover/backfill] Done — inserted ${inserted}, skipped ${orders.length - inserted}.`);

  return NextResponse.json({
    inserted,
    skipped: orders.length - inserted,
    total: orders.length,
  });
}
