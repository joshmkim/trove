import { NextResponse } from "next/server";

const CLOVER_BASE = "https://api.clover.com";

type RawOrder = {
  id: string;
  state?: string;
  createdTime?: number;
  lineItems?: { elements?: unknown[] };
};

export async function GET() {
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const apiToken = process.env.CLOVER_API_TOKEN;

  if (!merchantId || !apiToken) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const headers = { Authorization: `Bearer ${apiToken}` };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sinceMs = startOfToday.getTime();

  // 1. Today's orders (with date filter)
  const todayRes = await fetch(
    `${CLOVER_BASE}/v3/merchants/${merchantId}/orders?filter=createdTime>=${sinceMs}&expand=lineItems&limit=20`,
    { headers }
  );
  const todayBody = todayRes.ok ? await todayRes.json() : { elements: [] };
  const todayOrders: RawOrder[] = todayBody.elements ?? [];

  // 2. Most recent 5 orders regardless of date — to check if any orders exist at all
  const recentRes = await fetch(
    `${CLOVER_BASE}/v3/merchants/${merchantId}/orders?orderBy=createdTime+DESC&limit=5`,
    { headers }
  );
  const recentBody = recentRes.ok ? await recentRes.json() : { elements: [] };
  const recentOrders: RawOrder[] = recentBody.elements ?? [];

  return NextResponse.json({
    todayFilter: { sinceMs, sinceDate: startOfToday.toISOString(), count: todayOrders.length },
    todayOrders: todayOrders.map((o) => ({
      id: o.id,
      state: o.state,
      createdTime: o.createdTime,
      createdDate: o.createdTime ? new Date(o.createdTime).toISOString() : null,
      lineItemCount: o.lineItems?.elements?.length ?? 0,
    })),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      state: o.state,
      createdTime: o.createdTime,
      createdDate: o.createdTime ? new Date(o.createdTime).toISOString() : null,
      lineItemCount: o.lineItems?.elements?.length ?? 0,
    })),
  });
}
