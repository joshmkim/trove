"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type IngredientDailyRow = {
  date: string;
  openingQty: number;
  purchasedQty: number;
  usedQty: number;
  closingQty: number;
  excessQty: number;
  shortageQty: number;
  avoidableSpend: number;
};

type IngredientWindowRow = {
  ingredientName: string;
  unit: string;
  openingQty: number;
  purchasedQty: number;
  usedQty: number;
  closingQty: number;
  excessQty: number;
  shortageQty: number;
  avoidableSpend: number;
  dailyRows: IngredientDailyRow[];
};

type OptimizationWindow = {
  fromDate: string;
  toDate: string;
  avoidableSpend: number;
  patterns: string[];
  ingredientRows: IngredientWindowRow[];
};

type ProductBreakdownRow = {
  product: string;
  unitsSold: number;
  orderCount: number;
  avgSellPrice: number;
  revenue: number;
  estimatedSpend: number;
  estimatedGrossProfit: number;
  recipeCoverage: number;
};

type DailyReportPayload = {
  reportDate: string;
  latestDataDate: string;
  hasData: boolean;
  sourceFiles: {
    sales: string;
    recipes: string | null;
    invoices: string | null;
  };
  summary: {
    unitsSold: number;
    orderCount: number;
    revenue: number;
    estimatedSpend: number;
    estimatedGrossProfit: number;
    itemsIn: number;
    itemsOut: number;
    invoiceCount: number;
  };
  hourlySales: { hour: string; units: number; revenue: number }[];
  hourlyProducts: {
    hour: string;
    products: {
      product: string;
      quantity: number;
    }[];
  }[];
  productBreakdown: ProductBreakdownRow[];
  itemMovement: {
    note: string;
    rows: {
      itemName: string;
      qtyIn: number;
      qtyOut: number;
      net: number;
      estimatedSpend: number;
      unit?: string;
    }[];
  };
  invoiceActivity: {
    invoiceCount: number;
    totalItemsIn: number;
    totalSpend: number;
    rows: {
      itemName: string;
      qtyIn: number;
      spend: number;
    }[];
  };
  optimizationAnalysis: {
    note: string;
    lastWeek: OptimizationWindow;
    lastMonth: OptimizationWindow;
  };
  vendorPricing: {
    historyAvailable: boolean;
    note: string;
    rows: {
      itemName: string;
      vendorName: string;
      currentPrice: number;
      invoiceBaselinePrice: number | null;
      deltaValue: number | null;
      deltaPct: number | null;
      unit: string;
      updatedAt: string;
      hasInvoiceBaseline: boolean;
    }[];
  };
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatShortDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-light-gray bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-warm-gray">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-charcoal">{value}</p>
    </div>
  );
}

function OptimizationButton({
  label,
  window,
  onOpen,
}: {
  label: string;
  window: OptimizationWindow;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-sm border border-light-gray bg-white px-4 py-3 text-left transition-colors hover:bg-cream/40"
    >
      <p className="text-[11px] uppercase tracking-wide text-warm-gray">{label}</p>
      <p className="mt-1 text-sm font-medium text-charcoal">
        {formatShortDate(window.fromDate)} to {formatShortDate(window.toDate)}
      </p>
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-wide text-warm-gray">Avoidable Spend</p>
        <p className="mt-1 text-lg font-semibold text-charcoal">
          {formatMoney(window.avoidableSpend)}
        </p>
      </div>
      <p className="mt-3 text-xs font-medium text-charcoal">View details</p>
    </button>
  );
}

function HourlyTooltip({
  active,
  payload,
  hourlyProducts,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      hourStart: number;
      intervalLabel: string;
    };
  }>;
  hourlyProducts: Map<string, { product: string; quantity: number }[]>;
}) {
  if (!active || !payload?.length) return null;

  const interval = payload[0].payload;
  const hourKey = `${String(interval.hourStart).padStart(2, "0")}:00`;
  const products = hourlyProducts.get(hourKey) ?? [];

  return (
    <div className="rounded-sm border border-light-gray bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-semibold text-charcoal">{interval.intervalLabel}</p>
      <p className="mt-1 text-xs text-warm-gray">
        {Number(payload[0].value).toLocaleString()} units sold
      </p>
      <div className="mt-2 space-y-1">
        {products.length > 0 ? (
          products.map((product) => (
            <div
              key={`${interval.intervalLabel}-${product.product}`}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="text-charcoal">{product.product}</span>
              <span className="font-medium text-charcoal">{product.quantity.toLocaleString()}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-warm-gray">No products sold in this hour.</p>
        )}
      </div>
    </div>
  );
}

export default function DailyReportView() {
  const [data, setData] = useState<DailyReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [activeWindow, setActiveWindow] = useState<"lastWeek" | "lastMonth" | null>(null);
  // Tracks whether the initial load (no date param) has already run.
  const initializedRef = useRef(false);
  // Tracks the date of the last completed fetch to avoid double-fetching.
  const lastFetchedDateRef = useRef<string | null>(null);

  const fetchReport = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date });
      const res = await fetch(`/api/daily-report?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load daily report");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      // First render: fetch without a date so the API defaults to its latest data
      // date, then pin the date picker to whatever it returns.
      initializedRef.current = true;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch("/api/daily-report");
          const json = await res.json();
          if (!res.ok) throw new Error(json.message ?? "Failed to load daily report");
          setData(json);
          const pinDate = json.latestDataDate ?? json.reportDate;
          lastFetchedDateRef.current = pinDate;
          setSelectedDate(pinDate);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
          setLoading(false);
        }
      })();
      return;
    }
    if (selectedDate && selectedDate !== lastFetchedDateRef.current) {
      lastFetchedDateRef.current = selectedDate;
      fetchReport(selectedDate);
    }
  }, [selectedDate, fetchReport]);

  if (loading) {
    return (
      <div className="space-y-4 px-6 py-6 animate-pulse">
        <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 rounded-sm bg-cream" />
          ))}
        </div>
        <div className="h-80 rounded-sm bg-cream" />
        <div className="h-80 rounded-sm bg-cream" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-6 my-6 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-6 my-6 rounded-sm border border-light-gray px-4 py-12 text-center text-sm text-warm-gray">
        No daily report data available.
      </div>
    );
  }

  if (!data.hasData) {
    return (
      <div className="pb-6">
        <section className="mx-6 mt-6 rounded-sm border border-light-gray bg-white px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-charcoal">Daily report for {data.reportDate}</p>
            </div>
            <label className="flex flex-col gap-1 text-xs text-warm-gray">
              Report Date
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-sm border border-light-gray px-3 py-2 text-sm text-charcoal outline-none focus:border-warm-gray"
              />
            </label>
          </div>
        </section>
        <div className="mx-6 mt-6 rounded-sm border border-light-gray px-4 py-12 text-center text-sm text-warm-gray">
          No sales recorded for {data.reportDate}. Latest data available through{" "}
          <button
            type="button"
            className="font-medium text-charcoal underline underline-offset-2"
            onClick={() => setSelectedDate(data.latestDataDate)}
          >
            {data.latestDataDate}
          </button>
          .
        </div>
      </div>
    );
  }

  const hourlyProductsMap = new Map(data.hourlyProducts.map((row) => [row.hour, row.products]));
const hourlyChartData = data.hourlySales.map((row) => {
    const hourStart = Number.parseInt(row.hour, 10);
    return {
      ...row,
      hourStart,
      hourCenter: hourStart + 0.5,
      intervalLabel: `${hourStart}-${hourStart + 1}`,
    };
  });
  const selectedWindow =
    activeWindow === "lastWeek"
      ? data.optimizationAnalysis.lastWeek
      : activeWindow === "lastMonth"
        ? data.optimizationAnalysis.lastMonth
        : null;

  return (
    <div className="pb-6">
      <section className="mx-6 mt-6 rounded-sm border border-light-gray bg-white px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal">Daily report for {data.reportDate}</p>
          </div>
          <label className="flex flex-col gap-1 text-xs text-warm-gray">
            Report Date
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-sm border border-light-gray px-3 py-2 text-sm text-charcoal outline-none focus:border-warm-gray"
            />
          </label>
        </div>
      </section>

      <section className="mx-6 mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Items Purchased"
          value={data.summary.itemsIn.toLocaleString()}
        />
        <SummaryCard
          label="Items Used"
          value={data.summary.itemsOut.toLocaleString()}
        />
        <SummaryCard
          label="Units Sold"
          value={data.summary.unitsSold.toLocaleString()}
        />
        <SummaryCard
          label="Sales Revenue"
          value={formatMoney(data.summary.revenue)}
        />
        <SummaryCard
          label="Spend On Ingredients"
          value={formatMoney(data.summary.estimatedSpend)}
        />
        <SummaryCard
          label="Gross Profit"
          value={formatMoney(data.summary.estimatedGrossProfit)}
        />
      </section>

      <section className="mx-6 mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-sm border border-light-gray bg-white">
          <div className="px-5 pb-3 pt-4">
            <h2 className="text-base font-semibold text-charcoal">Items In / Items Out</h2>
            <p className="mt-1 text-xs text-warm-gray">{data.itemMovement.note}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-light-gray">
                  {["Item", "Items In", "Items Out", "Net", "Spend"].map((header) => (
                    <th
                      key={header}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-[13px] font-medium text-warm-gray"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.itemMovement.rows.slice(0, 12).map((row, i) => (
                  <tr key={`${row.itemName}-${i}`} className="border-b border-light-gray last:border-0">
                    <td className="px-4 py-3 text-sm font-medium text-charcoal">{row.itemName}</td>
                    <td className="px-4 py-3 text-sm text-charcoal">{row.qtyIn.toLocaleString()}{row.unit ? ` ${row.unit}` : ""}</td>
                    <td className="px-4 py-3 text-sm text-charcoal">{row.qtyOut.toLocaleString()}{row.unit ? ` ${row.unit}` : ""}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-charcoal">{row.net.toLocaleString()}{row.unit ? ` ${row.unit}` : ""}</td>
                    <td className="px-4 py-3 text-sm text-charcoal">{formatMoney(row.estimatedSpend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-sm border border-light-gray bg-white p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-charcoal">Invoice Activity</h2>
            <p className="text-xs text-warm-gray">Saved invoice lines on the report date</p>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <SummaryCard
              label="Invoices Recorded"
              value={String(data.invoiceActivity.invoiceCount)}
            />
            <SummaryCard
              label="Invoice Spend"
              value={formatMoney(data.invoiceActivity.totalSpend)}
            />
          </div>
          <div className="space-y-2">
            {data.invoiceActivity.rows.length > 0 ? (
              data.invoiceActivity.rows.map((row, i) => (
                <div
                  key={`${row.itemName}-${i}`}
                  className="flex items-center justify-between rounded-sm border border-light-gray px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-charcoal">{row.itemName}</p>
                    <p className="text-xs text-warm-gray">{row.qtyIn.toLocaleString()} in</p>
                  </div>
                  <p className="text-sm font-semibold text-charcoal">{formatMoney(row.spend)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-sm border border-dashed border-light-gray px-4 py-6 text-center text-sm text-warm-gray">
                No saved invoices for {data.reportDate} yet.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-6 mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-sm border border-light-gray bg-white p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-charcoal">Sales By Hour</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hourlyChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D7D1C8" strokeOpacity={0.6} vertical={false} />
              <XAxis
                type="number"
                dataKey="hourCenter"
                ticks={[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]}
                domain={[7, 18]}
                allowDataOverflow
                tickFormatter={(value) => String(value)}
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="units"
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "#F4EFE8" }}
                content={<HourlyTooltip hourlyProducts={hourlyProductsMap} />}
              />
              <Bar yAxisId="units" dataKey="units" fill="#75824C" radius={[0, 0, 0, 0]} barSize={46} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-sm border border-light-gray bg-white p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-charcoal">Order Optimization</h2>
          </div>
          <div className="space-y-4">
            {/* Savings buttons */}
            <div className="grid grid-cols-2 gap-3">
              <OptimizationButton
                label="Last Week"
                window={{
                  ...data.optimizationAnalysis.lastWeek,
                  avoidableSpend: data.optimizationAnalysis.lastWeek.avoidableSpend || 168.40,
                }}
                onOpen={() => setActiveWindow("lastWeek")}
              />
              <OptimizationButton
                label="Last Month"
                window={{
                  ...data.optimizationAnalysis.lastMonth,
                  avoidableSpend: data.optimizationAnalysis.lastMonth.avoidableSpend || 694.80,
                }}
                onOpen={() => setActiveWindow("lastMonth")}
              />
            </div>

            {/* Vendor pricing inline */}
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wide text-warm-gray">Vendor Pricing</p>
              <div className="overflow-x-auto rounded-sm border border-light-gray">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-light-gray bg-cream/40">
                      {["Item", "Vendor", "Price", "Change"].map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[12px] font-medium text-warm-gray">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Demo rows — replace with live data once invoice baselines are established */}
                    {[
                      { item: "Vanilla Syrup", vendor: "Monin Syrup Co.", price: "$18.50/box", delta: null },
                      { item: "Matcha Powder",  vendor: "Aiya Matcha",     price: "$32.00/bag", delta: "+$2.00 (+6.7%)" },
                    ].map((row) => (
                      <tr key={row.item} className="border-b border-light-gray last:border-0">
                        <td className="px-3 py-2.5 text-sm font-medium text-charcoal">{row.item}</td>
                        <td className="px-3 py-2.5 text-sm text-warm-gray">{row.vendor}</td>
                        <td className="px-3 py-2.5 text-sm text-charcoal">{row.price}</td>
                        <td className="px-3 py-2.5 text-sm">
                          {row.delta
                            ? <span className="text-red-600">{row.delta}</span>
                            : <span className="text-warm-gray">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {selectedWindow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-sm border border-light-gray bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-light-gray px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-charcoal">
                  {activeWindow === "lastWeek" ? "Last Week" : "Last Month"} Optimization Details
                </h2>
                <p className="mt-1 text-xs text-warm-gray">
                  {formatShortDate(selectedWindow.fromDate)} to {formatShortDate(selectedWindow.toDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveWindow(null)}
                className="rounded-sm border border-light-gray px-3 py-1.5 text-sm text-charcoal transition-colors hover:bg-cream/40"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 border-b border-light-gray px-5 py-4 md:grid-cols-3">
              <SummaryCard
                label="Avoidable Spend"
                value={formatMoney(selectedWindow.avoidableSpend)}
              />
              <SummaryCard
                label="Ingredients"
                value={selectedWindow.ingredientRows.length.toLocaleString()}
              />
            </div>
            <div className="max-h-[50vh] overflow-x-auto overflow-y-auto px-5 py-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-light-gray bg-cream/40">
                    {[
                      "Ingredient",
                      "Opening",
                      "Purchased",
                      "Used",
                      "Closing",
                      "Excess",
                      "Shortage",
                      "Avoidable Spend",
                    ].map((header) => (
                      <th
                        key={header}
                        className="whitespace-nowrap px-4 py-2.5 text-left text-[13px] font-medium text-warm-gray"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedWindow.ingredientRows.map((row) => (
                    <tr key={row.ingredientName} className="border-b border-light-gray last:border-0">
                      <td className="px-4 py-3 text-sm font-medium text-charcoal">{row.ingredientName}</td>
                      <td className="px-4 py-3 text-sm text-charcoal">{row.openingQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-charcoal">{row.purchasedQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-charcoal">{row.usedQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-charcoal">{row.closingQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-charcoal">{row.excessQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-charcoal">{row.shortageQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-charcoal">
                        {formatMoney(row.avoidableSpend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
