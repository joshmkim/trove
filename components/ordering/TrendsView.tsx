"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendSeries {
  keyword: string;
  data: { date: string; interest: number }[];
}


// One color per keyword (cycles if more than 6)
const LINE_COLORS = [
  "#8B8CC7", // lavender
  "#3D3D8E", // navy
  "#e07b5a", // terracotta
  "#5aae8c", // sage
  "#c7a62f", // gold
  "#a65ab5", // purple
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function trendDirection(data: { interest: number }[]): "↑" | "↓" | "→" {
  if (data.length < 2) return "→";
  const recent = data.slice(-14).reduce((s, d) => s + d.interest, 0) / 14;
  const older  = data.slice(0, 14).reduce((s, d) => s + d.interest, 0) / 14;
  if (recent > older + 3) return "↑";
  if (recent < older - 3) return "↓";
  return "→";
}

function avg(data: { interest: number }[]): number {
  if (!data.length) return 0;
  return Math.round(data.reduce((s, d) => s + d.interest, 0) / data.length);
}

function currentInterest(data: { interest: number }[]): number {
  return data.at(-1)?.interest ?? 0;
}

function mergeSeriesForChart(series: TrendSeries[]): Record<string, unknown>[] {
  const dateMap = new Map<string, Record<string, unknown>>();
  for (const s of series) {
    for (const point of s.data) {
      if (!dateMap.has(point.date)) dateMap.set(point.date, { date: point.date });
      dateMap.get(point.date)![s.keyword] = point.interest;
    }
  }
  return Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
}

export default function TrendsView() {
  const [series, setSeries] = useState<TrendSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trends");
      if (!res.ok) throw new Error("Failed to fetch trends");
      const json = await res.json();
      setSeries(json.trends ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  if (loading) {
    return (
      <div className="px-5 py-8 space-y-3 animate-pulse">
        <div className="h-4 bg-cream rounded w-1/4" />
        <div className="h-48 bg-cream rounded" />
        <div className="h-4 bg-cream rounded w-1/2" />
        <div className="h-4 bg-cream rounded w-1/3" />
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {series.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-warm-gray">
          No trends data yet — click &ldquo;Refresh Trends&rdquo; to fetch from Google.
        </div>
      ) : (
        <div className="px-5 py-4 space-y-5">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mergeSeriesForChart(series)} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#C4C0BA" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#9E9589" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) => [value, ""]}
                labelFormatter={(label) => typeof label === "string" ? fmtDate(label) : label}
                contentStyle={{
                  fontSize: 12,
                  borderColor: "#C4C0BA",
                  borderRadius: 4,
                  color: "#333333",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#9E9589", paddingTop: 8 }} />
              {series.map((s, i) => (
                <Line
                  key={s.keyword}
                  type="monotone"
                  dataKey={s.keyword}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto rounded border border-light-gray">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-light-gray bg-cream/50">
                  {["Keyword", "Current Interest", "90-day Avg", "Trend"].map((h) => (
                    <th
                      key={h}
                      className="py-2 px-3 text-left text-[12px] font-medium text-warm-gray whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {series.map((s) => {
                  const dir = trendDirection(s.data);
                  const dirColor =
                    dir === "↑" ? "text-green-600" :
                    dir === "↓" ? "text-red-500"   : "text-warm-gray";
                  return (
                    <tr key={s.keyword} className="border-b border-light-gray last:border-0">
                      <td className="py-2.5 px-3 font-medium text-charcoal capitalize">{s.keyword}</td>
                      <td className="py-2.5 px-3 text-charcoal">{currentInterest(s.data)}</td>
                      <td className="py-2.5 px-3 text-charcoal">{avg(s.data)}</td>
                      <td className={`py-2.5 px-3 font-semibold text-base ${dirColor}`}>{dir}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
