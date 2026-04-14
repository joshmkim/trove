import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const STORE_UTC_OFFSET_HOURS = -7; // PDT
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Shift a UTC ISO string to store-local date (PDT = UTC-7), return "YYYY-MM-DD". */
function toLocalDate(utcIso: string): string {
  const ms = new Date(utcIso).getTime() + STORE_UTC_OFFSET_HOURS * 3600 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function formatMonth(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export async function GET() {
  const supabase = getSupabase();

  // Page through all clover_processed_orders
  const rows: { order_created_at: string; line_items: { name: string }[] }[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("clover_processed_orders")
      .select("order_created_at, line_items")
      .range(offset, offset + 999);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
    offset += 1000;
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { message: "No Clover orders found. Run the backfill first." },
      { status: 404 }
    );
  }

  // Flatten line items → sales records
  type Record = { orderId: string; product: string; date: string; weekday: string };
  const records: Record[] = [];

  for (const order of rows) {
    const { order_created_at, line_items } = order;
    if (!order_created_at || !Array.isArray(line_items)) continue;
    const localDate = toLocalDate(order_created_at);
    const dow = new Date(localDate + "T12:00:00Z").getDay(); // 0=Sun
    const weekday = WEEKDAYS[(dow + 6) % 7]; // shift so Mon=0

    for (const item of line_items) {
      const name = (item?.name ?? "").trim();
      if (!name) continue;
      records.push({ orderId: order_created_at, product: name, date: localDate, weekday });
    }
  }

  if (records.length === 0) {
    return NextResponse.json({ message: "No usable line items found." }, { status: 400 });
  }

  records.sort((a, b) => a.date.localeCompare(b.date));

  // ── Aggregate ────────────────────────────────────────────────────────────────
  const monthMap  = new Map<string, { units: number; orders: Set<string> }>();
  const dailyMap  = new Map<string, { units: number; orders: Set<string> }>();
  const weekdayMap = new Map<string, number>(WEEKDAYS.map((d) => [d, 0]));
  const productMap = new Map<string, { units: number; orders: Set<string> }>();

  for (const r of records) {
    const monthKey = r.date.slice(0, 7); // "YYYY-MM"

    if (!monthMap.has(monthKey)) monthMap.set(monthKey, { units: 0, orders: new Set() });
    monthMap.get(monthKey)!.units += 1;
    monthMap.get(monthKey)!.orders.add(r.orderId);

    if (!dailyMap.has(r.date)) dailyMap.set(r.date, { units: 0, orders: new Set() });
    dailyMap.get(r.date)!.units += 1;
    dailyMap.get(r.date)!.orders.add(r.orderId);

    weekdayMap.set(r.weekday, (weekdayMap.get(r.weekday) ?? 0) + 1);

    if (!productMap.has(r.product)) productMap.set(r.product, { units: 0, orders: new Set() });
    productMap.get(r.product)!.units += 1;
    productMap.get(r.product)!.orders.add(r.orderId);
  }

  const allOrderIds = new Set(records.map((r) => r.orderId));
  const totalUnits  = records.length;

  const monthlySeries = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      month:  formatMonth(key + "-01"),
      units:  v.units,
      orders: v.orders.size,
    }));

  const recentDailySeries = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, v]) => ({ date, units: v.units, orders: v.orders.size }));

  const weekdaySeries = WEEKDAYS.map((day) => ({
    day:   day.slice(0, 3),
    units: weekdayMap.get(day) ?? 0,
  }));

  const topProducts = Array.from(productMap.entries())
    .map(([product, v]) => ({ product, units: v.units, orders: v.orders.size }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 8);

  return NextResponse.json({
    sourceFile: "Clover POS",
    summary: {
      totalUnits,
      totalOrders:          allOrderIds.size,
      averageUnitsPerOrder: allOrderIds.size > 0 ? totalUnits / allOrderIds.size : 0,
      firstDate: records[0].date,
      lastDate:  records[records.length - 1].date,
      productCount: productMap.size,
    },
    monthlySeries,
    recentDailySeries,
    weekdaySeries,
    topProducts,
  });
}
