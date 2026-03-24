import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface UpdateItemBody {
  productName?: string;
  qtyIn?: number;
  qtyOut?: number;
  qtyBalance?: number;
  skuId?: string;
}

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const LOW_STOCK_THRESHOLD = 10;

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars are missing" },
      { status: 500 }
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as UpdateItemBody | null;

  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const quantityValues = [body.qtyIn, body.qtyOut, body.qtyBalance];
  const hasInvalidQuantity = quantityValues.some(
    (value) =>
      typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)
  );
  if (hasInvalidQuantity) {
    return NextResponse.json(
      { ok: false, error: "Quantities must be valid numbers." },
      { status: 400 }
    );
  }

  const skuPattern = /^SKU-\d+$/;
  if (typeof body.skuId !== "string" || !skuPattern.test(body.skuId)) {
    return NextResponse.json(
      { ok: false, error: "SKU must match format SKU-<number>." },
      { status: 400 }
    );
  }

  const qtyIn = body.qtyIn as number;
  const qtyOut = body.qtyOut as number;
  const qtyBalance = body.qtyBalance as number;

  const updatePayload = {
    product_name: body.productName,
    qty_in: qtyIn,
    qty_out: qtyOut,
    qty_balance: qtyBalance,
    quantity_remaining: qtyBalance,
    stock_level: qtyBalance < LOW_STOCK_THRESHOLD ? "low" : "high",
    sku_id: body.skuId,
  };

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase.from("items").update(updatePayload).eq("id", id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

