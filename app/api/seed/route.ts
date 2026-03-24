import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Save uploaded CSV to a temp file
  const buffer = Buffer.from(await file.arrayBuffer());
  const tmpPath = path.join(os.tmpdir(), `sales_upload_${Date.now()}.csv`);
  await writeFile(tmpPath, buffer);

  const scriptPath = path.join(process.cwd(), "scripts", "seed_sales_history.py");

  return new Promise<NextResponse>((resolve) => {
    execFile(
      "python3",
      [scriptPath, tmpPath],
      { cwd: process.cwd(), timeout: 5 * 60 * 1000 /* 5 min */ },
      async (error, stdout, stderr) => {
        await unlink(tmpPath).catch(() => {});

        if (error) {
          console.error("[seed] script error:", stderr || error.message);
          resolve(
            NextResponse.json(
              { status: "error", message: stderr || error.message },
              { status: 500 }
            )
          );
          return;
        }
        console.log("[seed] script output:", stdout);
        resolve(NextResponse.json({ status: "complete", output: stdout }));
      }
    );
  });
}
