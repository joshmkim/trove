import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import PDFParser from "pdf2json";

const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
  defaultQuery: { "api-version": "2024-08-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
});

function extractTextFromPdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = new (PDFParser as any)(null, 1);

    parser.on("pdfParser_dataError", (err: { parserError: Error }) => {
      reject(err.parserError);
    });

    parser.on("pdfParser_dataReady", () => {
      resolve(parser.getRawTextContent());
    });

    parser.parseBuffer(buffer);
  });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromPdf(buffer);

  if (!text.trim()) {
    return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
  }

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are an invoice parser for a bakery. Extract all line items from the invoice text.
Return a JSON array only — no markdown, no explanation.
Each object must have exactly these fields:
- productName: string (the ingredient or product name)
- qtyIn: number (quantity received)
- skuId: string (SKU or product code, use "" if not found)

Example output:
[{"productName":"All Purpose Flour","qtyIn":25,"skuId":"SKU-001"},{"productName":"Unsalted Butter","qtyIn":10,"skuId":""}]`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    temperature: 0,
  });

  const content = response.choices[0].message.content ?? "[]";

  let items: { productName: string; qtyIn: number; skuId: string }[];
  try {
    const cleaned = content.replace(/```json|```/g, "").trim();
    items = JSON.parse(cleaned);
  } catch {
    items = [];
  }

  return NextResponse.json({ items });
}
