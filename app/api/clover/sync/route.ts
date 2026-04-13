import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchRecentOrders } from "@/lib/clover";
import { deductIngredients } from "@/lib/deductIngredients";
import type { DeductionResult } from "@/lib/deductIngredients";

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: Request) {
  const supabase = getSupabase();

  // Allow ?since=<unixMs> override for backfilling; default is today's midnight
  const { searchParams } = new URL(req.url);
  const sinceOverride = searchParams.get("since");
  const sinceMs = sinceOverride ? Number(sinceOverride) : startOfTodayMs();

  // Fetch all paid orders from Clover since midnight today
  let orders;
  try {
    orders = await fetchRecentOrders(sinceMs);
  } catch (err) {
    console.error("[clover/sync] fetchRecentOrders failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  let processed = 0;
  let alreadyProcessed = 0;
  const results: DeductionResult[] = [];

  for (const order of orders) {
    // Idempotency check
    const { data: existing } = await supabase
      .from("clover_processed_orders")
      .select("clover_order_id")
      .eq("clover_order_id", order.id)
      .maybeSingle();

    if (existing) {
      alreadyProcessed++;
      continue;
    }

    const lineItems = order.lineItems?.elements ?? [];

    let result: DeductionResult;
    try {
      result = await deductIngredients(order.id, lineItems, supabase);
    } catch (err) {
      console.error(`[clover/sync] deductIngredients failed for order ${order.id}:`, err);
      continue;
    }

    await supabase.from("clover_processed_orders").insert({
      clover_order_id: order.id,
      merchant_id: process.env.CLOVER_MERCHANT_ID ?? "",
      line_item_count: lineItems.length,
      order_created_at: order.createdTime ? new Date(order.createdTime).toISOString() : new Date().toISOString(),
      line_items: lineItems,
      deducted: result.deducted,
    });

    results.push(result);
    processed++;
  }

  const now = new Date().toISOString();
  await supabase
    .from("clover_sync_state")
    .update({ last_synced_at: now })
    .eq("id", 1);

  return NextResponse.json({
    processed,
    alreadyProcessed,
    lastSyncedAt: now,
    results,
  });
}
