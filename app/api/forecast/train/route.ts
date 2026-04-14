import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

// Allow up to 5 minutes — the training script takes ~30-60 s locally
export const maxDuration = 300;

export async function POST() {
  const scriptPath = path.resolve(process.cwd(), "scripts/train_forecast.py");

  return new Promise<NextResponse>((resolve) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const child = spawn("python3", [scriptPath], {
      env: { ...process.env },
      cwd: process.cwd(),
    });

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk.toString()));

    child.on("close", (code) => {
      const output = stdout.join("");
      const errOutput = stderr.join("");

      if (code !== 0) {
        console.error("[forecast/train] script exited with code", code, errOutput);
        resolve(
          NextResponse.json(
            { ok: false, error: errOutput || "Script exited with non-zero code", output },
            { status: 500 }
          )
        );
        return;
      }

      // Extract summary line from output
      const wrote = output.match(/Wrote (\d+) rows for forecast_date=(\S+)/)?.[0] ?? "Done";
      const accuracy = output.match(/OVERALL.*?(\d+\.\d+%)/)?.[1] ?? null;

      resolve(
        NextResponse.json({
          ok: true,
          message: wrote,
          accuracy,
          output,
        })
      );
    });

    child.on("error", (err) => {
      resolve(
        NextResponse.json({ ok: false, error: err.message }, { status: 500 })
      );
    });
  });
}
