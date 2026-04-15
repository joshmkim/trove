import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ItemRow } from "@/lib/types";

interface InvoiceApplyItem {
  productName: string;
  qtyIn: number;
  skuId: string;
  unitPrice?: number | null;
  lineTotal?: number | null;
}

interface InvoiceMetadata {
  filename?: string;
  fileSize?: number | null;
}

const LOW_STOCK_THRESHOLD = 10;

function normalizeProductName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Find the best matching item from the DB for an invoice line item name.
 * Priority:
 *   1. Exact normalized match
 *   2. Every word of the DB item name appears in the invoice name
 *      (e.g. "Matcha Powder" found inside "Premium Matcha Powder (1kg box)")
 *   3. The invoice name contains the DB item name as a substring
 */
function findBestMatch(
  invoiceName: string,
  nameMatches: Map<string, ItemRow>
): ItemRow | undefined {
  const normInvoice = normalizeProductName(invoiceName);

  // 1. Exact
  const exact = nameMatches.get(normInvoice);
  if (exact) return exact;

  // 2 & 3. Fuzzy — check every DB item
  let best: ItemRow | undefined;
  let bestScore = 0;

  for (const [dbNorm, row] of nameMatches) {
    const dbWords = dbNorm.split(" ").filter(Boolean);
    const allWordsPresent = dbWords.every((w) => normInvoice.includes(w));
    const isSubstring = normInvoice.includes(dbNorm);

    const score = isSubstring ? 2 : allWordsPresent ? 1 : 0;
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  return bestScore > 0 ? best : undefined;
}

function toStockLevel(quantityRemaining: number): "low" | "high" {
  return quantityRemaining < LOW_STOCK_THRESHOLD ? "low" : "high";
}

function sanitizeItems(input: unknown): InvoiceApplyItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const candidate = item as Partial<InvoiceApplyItem>;
      const productName = candidate.productName?.trim() ?? "";
      const qtyIn = Number(candidate.qtyIn);
      const skuId = candidate.skuId?.trim() ?? "";
      const unitPrice =
        candidate.unitPrice == null ? null : Number(candidate.unitPrice);
      const lineTotal =
        candidate.lineTotal == null ? null : Number(candidate.lineTotal);

      if (!productName || !Number.isFinite(qtyIn) || qtyIn <= 0) {
        return null;
      }

      return {
        productName,
        qtyIn,
        skuId,
        unitPrice:
          unitPrice == null || !Number.isFinite(unitPrice) ? null : unitPrice,
        lineTotal:
          lineTotal == null || !Number.isFinite(lineTotal) ? null : lineTotal,
      };
    })
    .filter((item): item is InvoiceApplyItem => item !== null);
}

function consolidateItems(items: InvoiceApplyItem[]) {
  const grouped = new Map<string, InvoiceApplyItem>();

  for (const item of items) {
    const key = item.skuId || normalizeProductName(item.productName);
    const existing = grouped.get(key);

    if (existing) {
      existing.qtyIn += item.qtyIn;
      if (!existing.skuId && item.skuId) {
        existing.skuId = item.skuId;
      }
      if (item.lineTotal != null) {
        existing.lineTotal = (existing.lineTotal ?? 0) + item.lineTotal;
      }
      continue;
    }

    grouped.set(key, { ...item });
  }

  return Array.from(grouped.values());
}

export async function POST(req: NextRequest) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const items = consolidateItems(sanitizeItems((payload as { items?: unknown })?.items));
  const invoice = ((payload as { invoice?: InvoiceMetadata })?.invoice ?? {}) as InvoiceMetadata;

  if (items.length === 0) {
    return NextResponse.json({ error: "No valid invoice items were provided." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase environment variables are missing." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: existingItems, error: fetchError } = await supabase
    .from("items")
    .select("*, purchase_unit_size");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const skuMatches = new Map<string, ItemRow>();
  const nameMatches = new Map<string, ItemRow>();

  for (const item of (existingItems as ItemRow[]) ?? []) {
    if (item.sku_id) {
      skuMatches.set(item.sku_id, item);
    }
    nameMatches.set(normalizeProductName(item.product_name), item);
  }

  const updates = new Map<string, Partial<ItemRow> & Pick<ItemRow, "id">>();
  const inserts: Array<{
    product_name: string;
    quantity_remaining: number;
    stock_level: "low" | "high";
    qty_in: number;
    qty_out: number;
    qty_balance: number;
    sku_id: string | null;
  }> = [];

  for (const item of items) {
    const existingMatch =
      (item.skuId ? skuMatches.get(item.skuId) : undefined) ??
      findBestMatch(item.productName, nameMatches);

    if (existingMatch) {
      const current = updates.get(existingMatch.id);
      // Convert purchase units → grams using purchase_unit_size (e.g. 1 box = 3000g)
      const unitSize = Number(existingMatch.purchase_unit_size) || 1;
      const qtyInGrams = item.qtyIn * unitSize;
      const qtyIn = (current?.qty_in ?? existingMatch.qty_in) + qtyInGrams;
      const qtyBalance = (current?.qty_balance ?? existingMatch.qty_balance) + qtyInGrams;
      const quantityRemaining =
        (current?.quantity_remaining ?? existingMatch.quantity_remaining) + qtyInGrams;
      const skuId = existingMatch.sku_id ?? item.skuId ?? null;

      updates.set(existingMatch.id, {
        id: existingMatch.id,
        qty_in: qtyIn,
        qty_balance: qtyBalance,
        quantity_remaining: quantityRemaining,
        stock_level: toStockLevel(quantityRemaining),
        sku_id: skuId,
      });
      continue;
    }

    inserts.push({
      product_name: item.productName,
      quantity_remaining: item.qtyIn,
      stock_level: toStockLevel(item.qtyIn),
      qty_in: item.qtyIn,
      qty_out: 0,
      qty_balance: item.qtyIn,
      sku_id: item.skuId || null,
    });
  }

  const updateRows = Array.from(updates.values());

  for (const row of updateRows) {
    const { id, ...changes } = row;
    const { error: updateError } = await supabase
      .from("items")
      .update(changes)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("items").insert(inserts);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const invoiceRows = items.map((item) => ({
    productName: item.productName,
    qtyIn: item.qtyIn,
    skuId: item.skuId,
    unitPrice: item.unitPrice ?? 0,
    lineTotal:
      item.lineTotal ??
      (item.unitPrice != null ? Number((item.qtyIn * item.unitPrice).toFixed(2)) : 0),
  }));

  const { error: invoiceError } = await supabase.from("invoices").insert({
    filename: invoice.filename?.trim() || "invoice.pdf",
    file_size:
      invoice.fileSize != null && Number.isFinite(invoice.fileSize)
        ? String(invoice.fileSize)
        : null,
    upload_status: "completed",
    upload_progress: 100,
    parsed_items: invoiceRows,
  });

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 });
  }

  return NextResponse.json({
    addedCount: inserts.length,
    updatedCount: updateRows.length,
    totalProcessed: items.length,
  });
}
