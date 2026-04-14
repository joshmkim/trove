import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const OPERATING_HOURS = { start: 7, end: 18 };
// Store is PDT (UTC-7). All timestamps from Clover are UTC.
const STORE_UTC_OFFSET_HOURS = -7;

// ─── Types ────────────────────────────────────────────────────────────────────

type CloverLineItem = { name: string; price: number; quantity?: number };
type CloverDeduction = { ingredient: string; amount: number; unit: string };

type OrderRow = {
  clover_order_id: string;
  order_created_at: string;
  line_item_count: number;
  line_items: CloverLineItem[] | null;
  deducted: CloverDeduction[] | null;
};

type InvoiceRow = {
  filename: string;
  created_at: string;
  parsed_items: unknown;
};

type InvoiceParsedItem = {
  productName: string;
  qtyIn: number;
  unitPrice?: number;
  lineTotal?: number;
};

type OptimizationIngredientRow = {
  ingredientName: string;
  unit: string;
  openingQty: number;
  purchasedQty: number;
  usedQty: number;
  closingQty: number;
  excessQty: number;
  shortageQty: number;
  avoidableSpend: number;
  dailyRows: {
    date: string;
    openingQty: number;
    purchasedQty: number;
    usedQty: number;
    closingQty: number;
    excessQty: number;
    shortageQty: number;
    avoidableSpend: number;
  }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Convert a UTC ISO string to the store's local YYYY-MM-DD. */
function storeLocalDateStr(utcIso: string): string {
  const storeMs = new Date(utcIso).getTime() + STORE_UTC_OFFSET_HOURS * 3_600_000;
  return new Date(storeMs).toISOString().slice(0, 10);
}

/**
 * Returns [startISO, endISO] for a store-local calendar day.
 * e.g. "2026-04-12" PDT → ["2026-04-12T07:00:00.000Z", "2026-04-13T06:59:59.999Z"]
 */
function storeDayRange(date: string): [string, string] {
  const offsetMs = STORE_UTC_OFFSET_HOURS * 3_600_000; // negative for PDT
  const startUtcMs = new Date(`${date}T00:00:00Z`).getTime() - offsetMs;
  const endUtcMs = new Date(`${date}T23:59:59.999Z`).getTime() - offsetMs;
  return [new Date(startUtcMs).toISOString(), new Date(endUtcMs).toISOString()];
}

/** Extract the store-local hour (0-23) from a UTC ISO timestamp. */
function storeLocalHour(utcIso: string): number {
  return ((new Date(utcIso).getUTCHours() + 24 + STORE_UTC_OFFSET_HOURS) % 24);
}

function sanitizeInvoiceItems(input: unknown): InvoiceParsedItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const c = item as Partial<InvoiceParsedItem>;
      const productName = c.productName?.trim() ?? "";
      const qtyIn = Number(c.qtyIn);
      if (!productName || !Number.isFinite(qtyIn) || qtyIn <= 0) return null;
      return {
        productName,
        qtyIn,
        unitPrice: c.unitPrice != null ? Number(c.unitPrice) : undefined,
        lineTotal: c.lineTotal != null ? Number(c.lineTotal) : undefined,
      };
    })
    .filter((x): x is InvoiceParsedItem => x !== null);
}

function emptyOptimizationWindow(from: string, to: string) {
  return {
    fromDate: from,
    toDate: to,
    avoidableSpend: 0,
    patterns: ["Not enough data yet."],
    ingredientRows: [] as OptimizationIngredientRow[],
  };
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ message: "Supabase env vars missing." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Find latest date with order data ────────────────────────────────────────
  const { data: latestRow } = await supabase
    .from("clover_processed_orders")
    .select("order_created_at")
    .not("order_created_at", "is", null)
    .order("order_created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestDataDate = latestRow?.order_created_at
    ? storeLocalDateStr(latestRow.order_created_at)
    : storeLocalDateStr(new Date().toISOString());

  const url = new URL(req.url);
  const reportDate = url.searchParams.get("date") ?? latestDataDate;

  const [dayStart, dayEnd] = storeDayRange(reportDate);

  // ── Parallel fetches ─────────────────────────────────────────────────────────
  const [ordersResp, invoicesResp, itemsResp] = await Promise.all([
    supabase
      .from("clover_processed_orders")
      .select("clover_order_id, order_created_at, line_item_count, line_items, deducted")
      .gte("order_created_at", dayStart)
      .lte("order_created_at", dayEnd)
      .order("order_created_at"),
    supabase.from("invoices").select("filename, created_at, parsed_items").order("created_at"),
    supabase.from("items").select("product_name, unit, purchase_unit, purchase_unit_size"),
  ]);

  const orders = (ordersResp.data ?? []) as OrderRow[];
  const allInvoices = (invoicesResp.data ?? []) as InvoiceRow[];
  type ItemMeta = { product_name: string; unit: string | null; purchase_unit: string | null; purchase_unit_size: number | null };
  const itemsMeta = (itemsResp.data ?? []) as ItemMeta[];
  const itemMetaByName = new Map(itemsMeta.map((i) => [i.product_name, i]));
  const hasData = orders.length > 0;

  // ── Invoice activity for reportDate ─────────────────────────────────────────
  const [invStart, invEnd] = storeDayRange(reportDate);
  const dayInvoices = allInvoices.filter((inv) => {
    const d = inv.created_at;
    return d >= invStart && d <= invEnd;
  });

  const invoiceLineRows = dayInvoices.flatMap((inv) =>
    sanitizeInvoiceItems(inv.parsed_items).map((item) => ({
      itemName: item.productName,
      qtyIn: item.qtyIn,
      spend: money(item.lineTotal ?? (item.unitPrice ? item.unitPrice * item.qtyIn : 0)),
    }))
  );

  const invoiceActivity = {
    invoiceCount: new Set(dayInvoices.map((inv) => inv.filename)).size,
    totalItemsIn: invoiceLineRows.reduce((s, r) => s + r.qtyIn, 0),
    totalSpend: money(invoiceLineRows.reduce((s, r) => s + r.spend, 0)),
    rows: invoiceLineRows,
  };

  // ── No data early return ─────────────────────────────────────────────────────
  if (!hasData) {
    const yesterday = storeLocalDateStr(new Date(Date.now() - 86_400_000).toISOString());
    return NextResponse.json({
      reportDate,
      latestDataDate,
      hasData: false,
      sourceFiles: { sales: "Clover POS", recipes: null, invoices: null },
      summary: {
        unitsSold: 0,
        orderCount: 0,
        revenue: 0,
        estimatedSpend: 0,
        estimatedGrossProfit: 0,
        itemsIn: invoiceActivity.totalItemsIn,
        itemsOut: 0,
        invoiceCount: invoiceActivity.invoiceCount,
      },
      hourlySales: [],
      hourlyProducts: [],
      productBreakdown: [],
      itemMovement: { note: "No orders for this date.", rows: [] },
      invoiceActivity,
      optimizationAnalysis: {
        note: "",
        lastWeek: emptyOptimizationWindow(yesterday, reportDate),
        lastMonth: emptyOptimizationWindow(yesterday, reportDate),
      },
      vendorPricing: { historyAvailable: false, note: "Vendor pricing not configured.", rows: [] },
    });
  }

  // ── Build hourly buckets ─────────────────────────────────────────────────────
  const hourlySalesMap = new Map<number, { units: number; revenue: number }>();
  for (let h = OPERATING_HOURS.start; h < OPERATING_HOURS.end; h++) {
    hourlySalesMap.set(h, { units: 0, revenue: 0 });
  }
  const hourlyProductsMap = new Map<string, Map<string, number>>();

  // ── Build product and totals ─────────────────────────────────────────────────
  let totalUnits = 0;
  let totalRevenueCents = 0;
  const productMap = new Map<string, { unitsSold: number; revenueCents: number }>();

  for (const order of orders) {
    const lineItems = order.line_items ?? [];
    const localHour = storeLocalHour(order.order_created_at);
    const hourKey = `${String(localHour).padStart(2, "0")}:00`;

    for (const li of lineItems) {
      const qty = li.quantity ?? 1;
      const priceCents = li.price ?? 0;

      totalUnits += qty;
      totalRevenueCents += priceCents * qty;

      // hourly
      const bucket = hourlySalesMap.get(localHour);
      if (bucket) {
        bucket.units += qty;
        bucket.revenue += (priceCents / 100) * qty;
      }

      // hourly products
      const hpMap = hourlyProductsMap.get(hourKey) ?? new Map<string, number>();
      hpMap.set(li.name, (hpMap.get(li.name) ?? 0) + qty);
      hourlyProductsMap.set(hourKey, hpMap);

      // product totals
      const prod = productMap.get(li.name) ?? { unitsSold: 0, revenueCents: 0 };
      prod.unitsSold += qty;
      prod.revenueCents += priceCents * qty;
      productMap.set(li.name, prod);
    }
  }

  const hourlySales = Array.from(hourlySalesMap.entries()).map(([h, v]) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    units: v.units,
    revenue: money(v.revenue),
  }));

  const hourlyProducts = Array.from(hourlyProductsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, products]) => ({
      hour,
      products: Array.from(products.entries()).map(([product, quantity]) => ({
        product,
        quantity,
      })),
    }));

  const totalRevenue = totalRevenueCents / 100;

  const productBreakdown = Array.from(productMap.entries()).map(([product, v]) => {
    const revenue = v.revenueCents / 100;
    return {
      product,
      unitsSold: v.unitsSold,
      orderCount: orders.filter((o) => o.line_items?.some((li) => li.name === product)).length,
      avgSellPrice: v.unitsSold > 0 ? money(revenue / v.unitsSold) : 0,
      revenue: money(revenue),
      estimatedSpend: 0,
      estimatedGrossProfit: money(revenue),
      recipeCoverage: 0,
    };
  });

  // ── Ingredient deductions for the day ───────────────────────────────────────
  const deductionMap = new Map<string, { amount: number; unit: string }>();
  for (const order of orders) {
    for (const d of order.deducted ?? []) {
      const existing = deductionMap.get(d.ingredient) ?? { amount: 0, unit: d.unit };
      existing.amount += d.amount;
      deductionMap.set(d.ingredient, existing);
    }
  }

  const itemMovementRows = Array.from(deductionMap.entries()).map(([itemName, v]) => {
    const meta = itemMetaByName.get(itemName);
    const purchaseUnitSize = meta?.purchase_unit_size ?? 1;
    const purchaseUnit = meta?.purchase_unit ?? meta?.unit ?? v.unit;
    const qtyOut = Math.round((v.amount / purchaseUnitSize) * 1000) / 1000;
    return {
      itemName,
      qtyIn: 0,
      qtyOut,
      net: -qtyOut,
      estimatedSpend: 0,
      unit: purchaseUnit,
    };
  });

  // Merge invoice qtyIn into item movement
  for (const row of invoiceLineRows) {
    const existing = itemMovementRows.find((r) => r.itemName === row.itemName);
    if (existing) {
      existing.qtyIn += row.qtyIn;
      existing.net += row.qtyIn;
    } else {
      itemMovementRows.push({
        itemName: row.itemName,
        qtyIn: row.qtyIn,
        qtyOut: 0,
        net: row.qtyIn,
        estimatedSpend: row.spend,
      });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const summary = {
    unitsSold: totalUnits,
    orderCount: orders.length,
    revenue: money(totalRevenue),
    estimatedSpend: 0,
    estimatedGrossProfit: money(totalRevenue),
    itemsIn: invoiceActivity.totalItemsIn,
    itemsOut: Math.round(itemMovementRows.reduce((s, r) => s + r.qtyOut, 0) * 10) / 10,
    invoiceCount: invoiceActivity.invoiceCount,
  };

  // ── Optimization windows ─────────────────────────────────────────────────────
  async function buildWindow(daysBack: number) {
    const windowEnd = new Date(`${reportDate}T23:59:59.999Z`);
    const windowStart = new Date(windowEnd.getTime() - daysBack * 86_400_000);
    const fromDate = storeLocalDateStr(windowStart.toISOString());
    const toDate = reportDate;

    const { data: windowOrders } = await supabase
      .from("clover_processed_orders")
      .select("order_created_at, deducted")
      .gte("order_created_at", windowStart.toISOString())
      .lte("order_created_at", windowEnd.toISOString());

    const { data: windowInvoices } = await supabase
      .from("invoices")
      .select("created_at, parsed_items")
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString());

    // Aggregate usage by ingredient
    const usedByIngredient = new Map<string, { amount: number; unit: string }>();
    for (const o of windowOrders ?? []) {
      for (const d of (o.deducted as CloverDeduction[] | null) ?? []) {
        const e = usedByIngredient.get(d.ingredient) ?? { amount: 0, unit: d.unit };
        e.amount += d.amount;
        usedByIngredient.set(d.ingredient, e);
      }
    }

    // Aggregate purchases by ingredient
    const purchasedByIngredient = new Map<string, number>();
    for (const inv of windowInvoices ?? []) {
      for (const item of sanitizeInvoiceItems(inv.parsed_items)) {
        const key = item.productName;
        purchasedByIngredient.set(key, (purchasedByIngredient.get(key) ?? 0) + item.qtyIn);
      }
    }

    const ingredientRows: OptimizationIngredientRow[] = Array.from(
      usedByIngredient.entries()
    ).map(([name, v]) => {
      const purchasedQty = purchasedByIngredient.get(name) ?? 0;
      const usedQty = Math.round(v.amount * 10) / 10;
      const excessQty = Math.max(0, purchasedQty - usedQty);
      const shortageQty = Math.max(0, usedQty - purchasedQty);
      return {
        ingredientName: name,
        unit: v.unit,
        openingQty: 0,
        purchasedQty,
        usedQty,
        closingQty: purchasedQty - usedQty,
        excessQty,
        shortageQty,
        avoidableSpend: 0,
        dailyRows: [],
      };
    });

    const patterns: string[] = [];
    for (const row of ingredientRows) {
      if (row.excessQty > 0) {
        patterns.push(`${row.ingredientName}: ${row.excessQty.toLocaleString()}${row.unit} excess purchased vs. used.`);
      } else if (row.shortageQty > 0) {
        patterns.push(`${row.ingredientName}: ${row.shortageQty.toLocaleString()}${row.unit} shortage vs. purchases.`);
      } else if (row.usedQty > 0) {
        patterns.push(`${row.ingredientName}: on track (${row.usedQty.toLocaleString()}${row.unit} used).`);
      }
    }
    if (patterns.length === 0) patterns.push("No tracked ingredient data for this window.");

    return {
      fromDate,
      toDate,
      avoidableSpend: 0,
      patterns,
      ingredientRows,
    };
  }

  const [lastWeek, lastMonth] = await Promise.all([buildWindow(7), buildWindow(30)]);

  // ── Response ─────────────────────────────────────────────────────────────────
  return NextResponse.json({
    reportDate,
    latestDataDate,
    hasData: true,
    sourceFiles: {
      sales: "Clover POS",
      recipes: "Supabase recipes",
      invoices: allInvoices.length > 0 ? "Supabase invoices" : null,
    },
    summary,
    hourlySales,
    hourlyProducts,
    productBreakdown,
    itemMovement: {
      note: "Ingredient usage deducted from Clover orders. Items In from saved invoices.",
      rows: itemMovementRows,
    },
    invoiceActivity,
    optimizationAnalysis: {
      note: "Based on Clover order history and saved invoice data.",
      lastWeek,
      lastMonth,
    },
    vendorPricing: {
      historyAvailable: false,
      note: "Vendor pricing not configured.",
      rows: [],
    },
  });
}
