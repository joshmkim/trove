import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

function resolveTargetCsvName(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("recipe")) return "trove_recipe_data.csv";
  if (lower.includes("sales")) return "trove_sales_data.csv";
  return null;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const targetName = resolveTargetCsvName(file.name);
  if (!targetName) {
    return NextResponse.json(
      {
        error:
          "Filename must indicate whether this is a sales or recipe CSV.",
      },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const targetPath = path.join(process.cwd(), targetName);
  await writeFile(targetPath, buffer);

  return NextResponse.json({
    status: "complete",
    file: targetName,
    message: `Saved ${targetName} to the project root.`,
  });
}
