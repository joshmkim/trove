"use client";

import { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import {
  forecastRowToForecast,
  forecastStatus,
  type DemandForecast,
  type DemandForecastRow,
} from "@/lib/types";

// ── Status indicator ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  critical: { label: "Will run out", className: "bg-red-100 text-red-700" },
  tight:    { label: "Tight",        className: "bg-amber-100 text-amber-700" },
  ok:       { label: "Covered",      className: "bg-green-100 text-green-700" },
};

function StatusBadge({ forecast }: { forecast: DemandForecast }) {
  const status = forecastStatus(forecast);
  const cfg    = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ── Confidence bar ────────────────────────────────────────────────────────────
function ConfidenceBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-warm-gray">—</span>;
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-light-gray rounded-full overflow-hidden">
        <div
          className="h-full bg-lavender rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-warm-gray">{pct}%</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RecommendedOrders() {
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchForecasts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchErr } = await supabase
      .from("demand_forecasts")
      .select("*")
      .order("recommended_order", { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const rows = data as DemandForecastRow[];
      setForecasts(rows.map(forecastRowToForecast));
      // Use created_at from the most-recent row
      const latest = rows.reduce((a, b) =>
        a.created_at > b.created_at ? a : b
      );
      setLastUpdated(
        new Date(latest.created_at).toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      );
    } else {
      setForecasts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchForecasts();
  }, [fetchForecasts]);

  const handleRetrain = async () => {
    setRetraining(true);
    setError(null);
    try {
      const res = await fetch("/api/forecasts", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Training failed");
      await fetchForecasts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRetraining(false);
    }
  };

  const confidenceScore = forecasts[0]?.confidenceScore ?? null;

  return (
    <section className="mx-6 my-6 border border-light-gray rounded-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-light-gray">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-charcoal">
            Recommended Orders
          </h2>
          {confidenceScore !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-warm-gray">Model accuracy</span>
              <ConfidenceBar score={confidenceScore} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-warm-gray">
              Updated {lastUpdated}
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleRetrain}
            disabled={retraining}
            className="text-xs"
          >
            {retraining ? "Retraining…" : "Retrain Model"}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-warm-gray">
          Loading forecasts…
        </div>
      ) : forecasts.length === 0 ? (
        <div className="py-12 text-center text-sm text-warm-gray">
          No forecast data yet — click &ldquo;Retrain Model&rdquo; to run the ML pipeline.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-light-gray">
                {[
                  "Ingredient",
                  "Predicted 7-Day Demand",
                  "Current Stock",
                  "Safety Stock",
                  "Recommended Order",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="py-2.5 px-4 text-left text-[13px] font-medium text-warm-gray whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-light-gray last:border-0 hover:bg-cream/40 transition-colors"
                >
                  <td className="py-3 px-4 text-sm font-medium text-charcoal">
                    {f.ingredientName}
                  </td>
                  <td className="py-3 px-4 text-sm text-charcoal">
                    {f.predictedDemand.toLocaleString()}
                    <span className="ml-1 text-warm-gray">{f.unit}s</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-charcoal">
                    {f.currentStock.toLocaleString()}
                    <span className="ml-1 text-warm-gray">{f.unit}s</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-charcoal">
                    {f.safetyStock.toLocaleString()}
                    <span className="ml-1 text-warm-gray">{f.unit}s</span>
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold text-charcoal">
                    {f.recommendedOrder > 0 ? (
                      <>
                        {f.recommendedOrder.toLocaleString()}
                        <span className="ml-1 font-normal text-warm-gray">{f.unit}s</span>
                      </>
                    ) : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge forecast={f} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
