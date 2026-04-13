import { NextResponse } from "next/server";

const CLOVER_BASE = "https://api.clover.com";

export async function GET() {
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const apiToken = process.env.CLOVER_API_TOKEN;

  if (!merchantId || !apiToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing env vars",
        missing: [
          !merchantId && "CLOVER_MERCHANT_ID",
          !apiToken && "CLOVER_API_TOKEN",
        ].filter(Boolean),
      },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${CLOVER_BASE}/v3/merchants/${merchantId}`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `Clover returned ${res.status}`, detail: text },
        { status: 502 }
      );
    }

    const merchant = (await res.json()) as { id: string; name?: string };
    return NextResponse.json({ ok: true, merchantId: merchant.id, merchantName: merchant.name });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 502 }
    );
  }
}
