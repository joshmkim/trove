import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";

export async function POST() {
  const scriptPath = path.join(process.cwd(), "scripts", "fetch_trends.py");

  return new Promise<NextResponse>((resolve) => {
    execFile(
      "python3",
      [scriptPath],
      { cwd: process.cwd(), timeout: 5 * 60 * 1000 /* 5 min */ },
      (error, stdout, stderr) => {
        if (error) {
          console.error("[trends] script error:", stderr || error.message);
          resolve(
            NextResponse.json(
              { status: "error", message: stderr || error.message },
              { status: 500 }
            )
          );
          return;
        }
        console.log("[trends] script output:", stdout);
        resolve(NextResponse.json({ status: "complete", output: stdout }));
      }
    );
  });
}
