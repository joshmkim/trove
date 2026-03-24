"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Button from "@/components/ui/Button";
import TrendsView from "@/components/ordering/TrendsView";
import { supabase } from "@/lib/supabase";
import {
  forecastRowToForecast,
  forecastStatus,
  type DemandForecast,
  type DemandForecastRow,
} from "@/lib/types";

type ActiveTab = "Forecasts" | "Trends";

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


// ── Main component ────────────────────────────────────────────────────────────
export default function RecommendedOrders() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("Forecasts");
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [seeding,   setSeeding]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-uploaded if needed
    e.target.value = "";

    setSeeding(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/seed", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Upload failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSeeding(false);
    }
  };

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

  return (
    <section className="mx-6 my-6 border border-light-gray rounded-sm">
      {/* Title row */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-base font-semibold text-charcoal">Recommended Orders</h2>
        {/* Actions — only shown on Forecasts tab */}
        {activeTab === "Forecasts" && (
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-warm-gray">Updated {lastUpdated}</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={seeding || retraining}
              className="text-xs"
            >
              {seeding ? "Uploading…" : "Upload CSV"}
            </Button>
            <Button
              variant="outline"
              onClick={handleRetrain}
              disabled={retraining || seeding}
              className="text-xs"
            >
              {retraining ? "Retraining…" : "Retrain Model"}
            </Button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-end border-b border-light-gray px-5">
        {(["Forecasts", "Trends"] as ActiveTab[]).map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
                isActive
                  ? "font-semibold text-charcoal border-charcoal"
                  : "font-normal text-warm-gray border-transparent hover:text-charcoal"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Trends tab content */}
      {activeTab === "Trends" && <TrendsView />}

      {/* Forecasts tab content */}
      {activeTab === "Forecasts" && (
        <>
          {/* Error */}
          {error && (
            <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

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
        </>
      )}
    </section>
  );
}
