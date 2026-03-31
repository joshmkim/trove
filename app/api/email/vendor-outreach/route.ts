import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendgrid";

interface OutreachItem {
  itemName: string;
  quantity: number;
  unit: string;
}

interface VendorOutreachBody {
  vendorName: string;
  vendorEmail: string;
  items: OutreachItem[];
  deliveryBy?: string;
}

const DEMO_RECIPIENT_EMAIL = "kimjosh@usc.edu";

export async function POST(req: NextRequest) {
  let body: VendorOutreachBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { vendorName, vendorEmail, items, deliveryBy } = body;

  if (!vendorName || typeof vendorName !== "string") {
    return NextResponse.json({ error: "vendorName is required" }, { status: 400 });
  }

  if (!vendorEmail || typeof vendorEmail !== "string") {
    return NextResponse.json({ error: "vendorEmail is required" }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
  }

  const invalidItem = items.find(
    (item) =>
      !item ||
      typeof item.itemName !== "string" ||
      typeof item.quantity !== "number" ||
      typeof item.unit !== "string"
  );

  if (invalidItem) {
    return NextResponse.json({ error: "Each item must include itemName, quantity, and unit" }, { status: 400 });
  }

  const deliveryDisplay = deliveryBy
    ? new Date(deliveryBy).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  const lines = items
    .map((i) => `- ${i.quantity} ${i.unit} ${i.itemName}`)
    .join("\n");

  const subject = `Order request from Harucake`;

  const text =
    `Hi ${vendorName},\n\n` +
    `This is Harucake. We'd like to place an order:\n` +
    `${lines}\n\n` +
    `Preferred delivery by: ${deliveryDisplay}\n\n` +
    `Please confirm availability and lead time.\n\n` +
    `Best,\n` +
    `Harucake`;

  try {
    await sendEmail({
      to: DEMO_RECIPIENT_EMAIL,
      subject,
      text,
    });
  } catch (error) {
    console.error("[email/vendor-outreach] sendEmail failed:", error);
    return NextResponse.json(
      { error: "Failed to send email. See server logs for details." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, to: DEMO_RECIPIENT_EMAIL, originalTo: vendorEmail });
}

