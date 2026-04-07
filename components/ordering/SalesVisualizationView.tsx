"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SalesVisualizationPayload {
  sourceFile: string;
  summary: {
    totalUnits: number;
    totalOrders: number;
    averageUnitsPerOrder: number;
    firstDate: string;
    lastDate: string;
    productCount: number;
  };
  monthlySeries: { month: string; units: number; orders: number }[];
  recentDailySeries: { date: string; units: number; orders: number }[];
  weekdaySeries: { day: string; units: number }[];
  topProducts: { product: string; units: number; orders: number }[];
}

const BAR_COLORS = [
  "#75824C",
  "#9AA66D",
  "#C08A5B",
  "#6B7A86",
  "#B4635C",
  "#917B60",
  "#547A6D",
  "#A5947D",
];

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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

export default function SalesVisualizationView() {
  const [data, setData] = useState<SalesVisualizationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVisualization = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sales-visualization");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load sales visualization");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisualization();
  }, [fetchVisualization]);

  if (loading) {
    return (
      <div className="px-5 py-8 space-y-4 animate-pulse">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-sm bg-cream" />
          ))}
        </div>
        <div className="h-64 rounded-sm bg-cream" />
        <div className="h-64 rounded-sm bg-cream" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-5 py-12 text-center text-sm text-warm-gray">
        No sales visualization data available.
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-charcoal">Sales Visualization</p>
          <p className="text-xs text-warm-gray">
            Source: {data.sourceFile} • {data.summary.firstDate} to {data.summary.lastDate}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Units Sold"
          value={formatCompact(data.summary.totalUnits)}
          detail="Total quantity across the loaded sales CSV"
        />
        <SummaryCard
          label="Orders"
          value={formatCompact(data.summary.totalOrders)}
          detail="Distinct order ids in the file"
        />
        <SummaryCard
          label="Avg Units / Order"
          value={data.summary.averageUnitsPerOrder.toFixed(2)}
          detail="Average basket size from the sales CSV"
        />
        <SummaryCard
          label="Products"
          value={String(data.summary.productCount)}
          detail="Distinct products represented in the file"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-sm border border-light-gray bg-white p-4">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-charcoal">Recent Daily Sales</h3>
            <p className="text-xs text-warm-gray">Last 30 days of unit volume from the sales file</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.recentDailySeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D7D1C8" strokeOpacity={0.6} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                labelFormatter={(label) =>
                  typeof label === "string" ? formatDateLabel(label) : label
                }
                formatter={(value) => [Number(value).toLocaleString(), "Units"]}
                contentStyle={{ borderColor: "#C4C0BA", borderRadius: 4, fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="units"
                stroke="#75824C"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-sm border border-light-gray bg-white p-4">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-charcoal">Weekday Pattern</h3>
            <p className="text-xs text-warm-gray">Which days move the most units</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.weekdaySeries} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D7D1C8" strokeOpacity={0.6} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) => [Number(value).toLocaleString(), "Units"]}
                contentStyle={{ borderColor: "#C4C0BA", borderRadius: 4, fontSize: 12 }}
              />
              <Bar dataKey="units" radius={[4, 4, 0, 0]}>
                {data.weekdaySeries.map((entry, index) => (
                  <Cell key={entry.day} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-sm border border-light-gray bg-white p-4">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-charcoal">Monthly Sales Volume</h3>
            <p className="text-xs text-warm-gray">Full-file monthly totals from the uploaded sales data</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.monthlySeries} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D7D1C8" strokeOpacity={0.6} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) => [Number(value).toLocaleString(), "Units"]}
                contentStyle={{ borderColor: "#C4C0BA", borderRadius: 4, fontSize: 12 }}
              />
              <Bar dataKey="units" fill="#6B7A86" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-sm border border-light-gray bg-white p-4">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-charcoal">Top Products</h3>
            <p className="text-xs text-warm-gray">Highest unit volume across the sales CSV</p>
          </div>
          <div className="space-y-2">
            {data.topProducts.slice(0, 5).map((row, index) => (
              <div
                key={row.product}
                className="flex items-center justify-between rounded-sm border border-light-gray px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">
                    {index + 1}. {row.product}
                  </p>
                  <p className="text-xs text-warm-gray">
                    {row.orders.toLocaleString()} orders
                  </p>
                </div>
                <p className="text-sm font-semibold text-charcoal">
                  {row.units.toLocaleString()} units
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
