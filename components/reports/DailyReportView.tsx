"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  sourceFiles: {
    sales: string;
    recipes: string | null;
  };
  summary: {
    unitsSold: number;
    orderCount: number;
    revenue: number;
    estimatedSpend: number;
    estimatedGrossProfit: number;
    itemsIn: number;
    itemsOut: number;
  };
  hourlySales: { hour: string; units: number; revenue: number }[];
  productBreakdown: ProductBreakdownRow[];
  vendorPricing: {
    historyAvailable: boolean;
    note: string;
    rows: {
      itemName: string;
      vendorName: string;
      currentPrice: number;
      unit: string;
      changedSinceCreated: boolean;
      updatedAt: string;
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

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-sm border border-light-gray bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-warm-gray">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-charcoal">{value}</p>
      <p className="mt-1 text-xs text-warm-gray">{detail}</p>
    </div>
  );
}

export default function DailyReportView() {
  const [data, setData] = useState<DailyReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-report");
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
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="px-6 py-6 space-y-4 animate-pulse">
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

  const topRevenue = data.productBreakdown.slice(0, 8);

  return (
    <div className="pb-6">
      <section className="mx-6 mt-6 rounded-sm border border-light-gray bg-white px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal">Daily report for {data.reportDate}</p>
            <p className="mt-1 text-xs text-warm-gray">
              Sales source: {data.sourceFiles.sales}
              {data.sourceFiles.recipes ? ` • Recipe source: ${data.sourceFiles.recipes}` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-6 mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Items In"
          value={data.summary.itemsIn.toLocaleString()}
          detail="Current recorded inventory-in total from items"
        />
        <SummaryCard
          label="Items Out"
          value={data.summary.itemsOut.toLocaleString()}
          detail="Current recorded inventory-out total from items"
        />
        <SummaryCard
          label="Sales Data"
          value={data.summary.unitsSold.toLocaleString()}
          detail="Units sold on the report date"
        />
        <SummaryCard
          label="Revenue"
          value={formatMoney(data.summary.revenue)}
          detail="Gross sales from the report date"
        />
        <SummaryCard
          label="Estimated Spend"
          value={formatMoney(data.summary.estimatedSpend)}
          detail="Estimated ingredient spend from recipes and vendor pricing"
        />
        <SummaryCard
          label="Gross Profit"
          value={formatMoney(data.summary.estimatedGrossProfit)}
          detail={`${data.summary.orderCount.toLocaleString()} distinct orders on the report date`}
        />
      </section>

      <section className="mx-6 mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-sm border border-light-gray bg-white p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-charcoal">Sales Data</h2>
            <p className="text-xs text-warm-gray">Hourly unit and revenue flow for the report day</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.hourlySales} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D7D1C8" strokeOpacity={0.6} vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis
                yAxisId="units"
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === "revenue"
                    ? [formatMoney(Number(value)), "Revenue"]
                    : [Number(value).toLocaleString(), "Units"]
                }
                contentStyle={{ borderColor: "#C4C0BA", borderRadius: 4, fontSize: 12 }}
              />
              <Bar yAxisId="units" dataKey="units" fill="#75824C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-sm border border-light-gray bg-white p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-charcoal">How Much Earning From Each Product</h2>
            <p className="text-xs text-warm-gray">Top revenue drivers on the report date</p>
          </div>
          <div className="space-y-2">
            {topRevenue.map((row, index) => (
              <div
                key={row.product}
                className="flex items-center justify-between rounded-sm border border-light-gray px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">
                    {index + 1}. {row.product}
                  </p>
                  <p className="text-xs text-warm-gray">
                    {row.unitsSold.toLocaleString()} units • {formatMoney(row.avgSellPrice)} avg price
                  </p>
                </div>
                <p className="text-sm font-semibold text-charcoal">{formatMoney(row.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-6 mt-6 rounded-sm border border-light-gray bg-white">
        <div className="px-5 pt-4 pb-3">
          <h2 className="text-base font-semibold text-charcoal">Product Economics</h2>
          <p className="mt-1 text-xs text-warm-gray">
            Revenue, estimated spend, and gross profit by product on the report date
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-light-gray">
                {[
                  "Product",
                  "Units Sold",
                  "Revenue",
                  "Estimated Spend",
                  "Gross Profit",
                  "Recipe Cost Coverage",
                ].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-2.5 text-left text-[13px] font-medium text-warm-gray whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.productBreakdown.map((row) => (
                <tr
                  key={row.product}
                  className="border-b border-light-gray last:border-0 hover:bg-cream/40 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-charcoal">{row.product}</td>
                  <td className="px-4 py-3 text-sm text-charcoal">{row.unitsSold.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-charcoal">{formatMoney(row.revenue)}</td>
                  <td className="px-4 py-3 text-sm text-charcoal">{formatMoney(row.estimatedSpend)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-charcoal">
                    {formatMoney(row.estimatedGrossProfit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-charcoal">
                    {Math.round(row.recipeCoverage * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-6 mt-6 rounded-sm border border-light-gray bg-white">
        <div className="px-5 pt-4 pb-3">
          <h2 className="text-base font-semibold text-charcoal">Vendor Item Pricing Increase / Decrease</h2>
          <p className="mt-1 text-xs text-warm-gray">{data.vendorPricing.note}</p>
        </div>
        <div className="px-5 pb-4">
          <div className="mb-4 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No historical price snapshot table exists yet, so this page shows current primary vendor pricing as the baseline. If you want real increase/decrease reporting, the next step is to store vendor price history whenever a price changes.
          </div>
          <div className="overflow-x-auto rounded-sm border border-light-gray">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-light-gray bg-cream/40">
                  {["Item", "Primary Vendor", "Current Price", "Last Updated", "Change Status"].map((header) => (
                    <th
                      key={header}
                      className="px-4 py-2.5 text-left text-[13px] font-medium text-warm-gray whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.vendorPricing.rows.map((row) => (
                  <tr key={`${row.itemName}-${row.vendorName}`} className="border-b border-light-gray last:border-0">
                    <td className="px-4 py-3 text-sm font-medium text-charcoal">{row.itemName}</td>
                    <td className="px-4 py-3 text-sm text-charcoal">{row.vendorName}</td>
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {formatMoney(row.currentPrice)}/{row.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {new Date(row.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {row.changedSinceCreated ? "Changed, baseline missing" : "No change history yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
