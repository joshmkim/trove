"use client";

import { useState, useEffect, useCallback } from "react";
import SalesVisualizationView from "@/components/ordering/SalesVisualizationView";
import TrendsView from "@/components/ordering/TrendsView";
import { supabase } from "@/lib/supabase";
import {
  formatUnitLabel,
  forecastRowToForecast,
  forecastStatus,
  type DemandForecast,
  type DemandForecastRow,
} from "@/lib/types";

type ActiveTab = "Forecasts" | "Data Viz" | "Trends";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a quantity with sensible decimal precision. */
function fmtQty(n: number): string {
  if (n >= 100) return Math.round(n).toLocaleString();
  if (n >= 10)  return Math.round(n).toString();
  if (n >= 1)   return parseFloat(n.toFixed(1)).toString();
  // < 1: show up to 2 significant decimal digits, strip trailing zeros
  return parseFloat(n.toFixed(2)).toString() || "0";
}

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
export default function RecommendedOrders({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("Forecasts");
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [refreshingTrends, setRefreshingTrends] = useState(false);
  const [trendsLastUpdated, setTrendsLastUpdated] = useState<string | null>(null);
  const [trendsRefreshTrigger, setTrendsRefreshTrigger] = useState(0);

  async function handleRefreshTrends() {
    setRefreshingTrends(true);
    try {
      const res = await fetch("/api/trends/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Refresh failed");
      setTrendsLastUpdated(
        new Date().toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      );
      setTrendsRefreshTrigger((n) => n + 1);
    } catch {
      // error will surface inside TrendsView
    } finally {
      setRefreshingTrends(false);
    }
  }

  const fetchForecasts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: latestForecast, error: latestErr } = await supabase
      .from("demand_forecasts")
      .select("forecast_date")
      .order("forecast_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) {
      setError(latestErr.message);
      setLoading(false);
      return;
    }

    if (!latestForecast?.forecast_date) {
      setForecasts([]);
      setLoading(false);
      return;
    }

    const TRACKED_FORECASTS = ["Matcha Powder", "Vanilla Syrup"];

    const [{ data, error: fetchErr }, { data: ingData }] = await Promise.all([
      supabase
        .from("demand_forecasts")
        .select("*")
        .eq("forecast_date", latestForecast.forecast_date)
        .in("ingredient_name", TRACKED_FORECASTS)
        .order("ingredient_name", { ascending: true }),
      supabase.from("items").select("product_name, quantity_remaining, purchase_unit_size").in("product_name", TRACKED_FORECASTS),
    ]);

    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      // Build a live stock map: ingredient name → current stock in purchase units.
      // quantity_remaining is stored in grams; divide by purchase_unit_size to get
      // the same purchase-unit scale used in demand_forecasts.
      const stockMap = new Map(
        (ingData ?? []).map((i) => {
          const size = Number(i.purchase_unit_size) || 1;
          return [i.product_name, Number(i.quantity_remaining) / size];
        })
      );

      const rows = data as DemandForecastRow[];
      setForecasts(
        rows.map((row) =>
          forecastRowToForecast({
            ...row,
            // Always use live stock from ingredients, fall back to forecast snapshot
            current_stock: stockMap.has(row.ingredient_name)
              ? stockMap.get(row.ingredient_name)!
              : row.current_stock,
          })
        )
      );
    } else {
      setForecasts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchForecasts();
  }, [fetchForecasts, refreshTrigger]);

  return (
    <section className="mx-6 my-6 border border-light-gray rounded-sm">
      {/* Title row */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-base font-semibold text-charcoal">Recommended Orders</h2>
        {/* Actions — swap based on active tab */}
        {activeTab === "Trends" ? (
          <div className="flex items-center gap-3">
            {trendsLastUpdated && (
              <span className="text-xs text-warm-gray">Updated {trendsLastUpdated}</span>
            )}
            <button
              type="button"
              onClick={handleRefreshTrends}
              disabled={refreshingTrends}
              className="rounded-sm border border-light-gray px-3 py-1.5 text-xs text-charcoal transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshingTrends ? "Refreshing…" : "Refresh Trends"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {activeTab === "Data Viz" && (
              <span className="text-xs text-warm-gray">Visualized from the current sales CSV</span>
            )}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-end border-b border-light-gray px-5">
        {(["Forecasts", "Data Viz", "Trends"] as ActiveTab[]).map((tab) => {
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

      {error && activeTab !== "Forecasts" && (
        <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeTab === "Data Viz" && <SalesVisualizationView />}

      {/* Trends tab content */}
      {activeTab === "Trends" && (
        <TrendsView refreshTrigger={trendsRefreshTrigger} />
      )}

      {/* Forecasts tab content */}
      {activeTab === "Forecasts" && (
        <>
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
              No forecast data yet — click &ldquo;Generate Order Plan&rdquo; to build a new recommendation snapshot.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-light-gray">
                    {[
                      "Item",
                      "7-Day Need",
                      "In Stock",
                      "Safety Buffer",
                      "Order",
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
                        {fmtQty(f.predictedDemand)}
                        <span className="ml-1 text-warm-gray">
                          {formatUnitLabel(f.unit, f.predictedDemand)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-charcoal">
                        {fmtQty(f.currentStock)}
                        <span className="ml-1 text-warm-gray">
                          {formatUnitLabel(f.unit, f.currentStock)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-charcoal">
                        {fmtQty(f.safetyStock)}
                        <span className="ml-1 text-warm-gray">
                          {formatUnitLabel(f.unit, f.safetyStock)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-charcoal">
                        {f.recommendedOrder > 0 ? (
                          <>
                            {Math.round(f.recommendedOrder).toLocaleString()}
                            <span className="ml-1 font-normal text-warm-gray">
                              {formatUnitLabel(f.unit, f.recommendedOrder)}
                            </span>
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
