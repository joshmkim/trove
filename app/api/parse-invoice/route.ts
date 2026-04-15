import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import PDFParser from "pdf2json";

function makeClient() {
  const key      = process.env.AZURE_OPENAI_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deploy   = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!key || !endpoint || !deploy) {
    throw new Error("Azure OpenAI environment variables are not configured.");
  }

  return new OpenAI({
    apiKey: key,
    baseURL: `${endpoint}/openai/deployments/${deploy}`,
    defaultQuery: { "api-version": "2024-08-01-preview" },
    defaultHeaders: { "api-key": key },
  });
}

function extractTextFromPdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = new (PDFParser as any)(null, 1);

    parser.on("pdfParser_dataError", (err: { parserError: Error }) => {
      reject(new Error(String(err.parserError)));
    });

    parser.on("pdfParser_dataReady", () => {
      resolve(parser.getRawTextContent() as string);
    });

    parser.parseBuffer(buffer);
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    // ── Extract text from PDF ──────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());

    let text: string;
    try {
      text = await extractTextFromPdf(buffer);
    } catch (pdfErr) {
      return NextResponse.json(
        { error: `Could not extract text from PDF: ${(pdfErr as Error).message}` },
        { status: 422 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "PDF appears to be empty or image-only (no extractable text)." },
        { status: 422 }
      );
    }

    // ── Call Azure OpenAI ──────────────────────────────────────────────────
    let client: OpenAI;
    try {
      client = makeClient();
    } catch (cfgErr) {
      return NextResponse.json({ error: (cfgErr as Error).message }, { status: 500 });
    }

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT!,
      messages: [
        {
          role: "system",
          content: `You are an invoice parser for a café / bakery supply company.
Extract every line item from the invoice text below.

Return a JSON array only — no markdown, no explanation, no wrapper object.
Each element must have exactly these fields:
  - productName  : string  — ingredient or product name, cleaned up (e.g. "Vanilla Syrup", "Matcha Powder")
  - qtyIn        : number  — quantity received (units, boxes, bags, etc.)
  - skuId        : string  — SKU / product code; use "" if not present
  - unitPrice    : number  — price per unit; use 0 if not found
  - lineTotal    : number  — total line amount; use 0 if not found

Rules:
  • Strip packaging details from the name (e.g. "(750ml bottle, 4/box)" → just "Vanilla Syrup").
  • If a line clearly isn't a product (e.g. shipping, tax, subtotal, discount), skip it.
  • If qtyIn is ambiguous use 1.

Example output:
[{"productName":"Vanilla Syrup","qtyIn":2,"skuId":"VS-750","unitPrice":18.50,"lineTotal":37.00},
 {"productName":"Matcha Powder","qtyIn":1,"skuId":"","unitPrice":32.00,"lineTotal":32.00}]`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content ?? "[]";

    let items: {
      productName: string;
      qtyIn: number;
      skuId: string;
      unitPrice?: number;
      lineTotal?: number;
    }[];

    try {
      const cleaned = content.replace(/```json|```/g, "").trim();
      items = JSON.parse(cleaned);
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[parse-invoice] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred while parsing the invoice." },
      { status: 500 }
    );
  }
}
