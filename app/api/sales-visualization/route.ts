import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DEFAULT_SALES_CSV = "trove_sales_data.csv";
const SEARCH_DIRS = ["", "data", "scripts"];
const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type SalesRecord = {
  orderId: string;
  product: string;
  purchaseTime: Date;
  quantity: number;
};

function resolveSalesCsvPath(): string | null {
  for (const dir of SEARCH_DIRS) {
    const candidate = dir
      ? path.join(process.cwd(), dir, DEFAULT_SALES_CSV)
      : path.join(process.cwd(), DEFAULT_SALES_CSV);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[%/#()]/g, "")
    .replace(/[\s-]+/g, "_");
}

function findFirstColumn(columns: string[], candidates: string[]): string | null {
  for (const name of candidates) {
    if (columns.includes(name)) return name;
  }
  return null;
}

function loadSalesRecords(csvText: string): SalesRecord[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const rawHeader = parseCsvLine(lines[0]).map(normalizeHeader);
  const dateCol = findFirstColumn(rawHeader, [
    "transaction_date",
    "date",
    "sales_date",
    "order_date",
    "purchase_time",
    "timestamp",
  ]);
  const productCol = findFirstColumn(rawHeader, [
    "product_type",
    "product_name",
    "item_name",
    "product",
    "item",
    "name",
  ]);
  const qtyCol = findFirstColumn(rawHeader, [
    "transaction_qty",
    "qty",
    "quantity",
    "quantity_sold",
    "units_sold",
    "sales_qty",
  ]);
  const orderIdCol = findFirstColumn(rawHeader, ["order_id", "transaction_id"]);

  if (!dateCol || !productCol || !qtyCol) return [];

  const dateIdx = rawHeader.indexOf(dateCol);
  const productIdx = rawHeader.indexOf(productCol);
  const qtyIdx = rawHeader.indexOf(qtyCol);
  const orderIdIdx = orderIdCol ? rawHeader.indexOf(orderIdCol) : -1;

  return lines.slice(1).flatMap((line) => {
    const cells = parseCsvLine(line);
    const purchaseTime = new Date(cells[dateIdx] ?? "");
    const product = (cells[productIdx] ?? "").trim();
    const quantity = Number(cells[qtyIdx] ?? "");
    const orderId = orderIdIdx >= 0 ? String(cells[orderIdIdx] ?? "").trim() : "";

    if (!product || Number.isNaN(purchaseTime.getTime()) || Number.isNaN(quantity)) {
      return [];
    }

    return [{ orderId, product, purchaseTime, quantity }];
  });
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export async function GET() {
  const csvPath = resolveSalesCsvPath();
  if (!csvPath) {
    return NextResponse.json(
      { message: `Could not find ${DEFAULT_SALES_CSV} in the project root.` },
      { status: 404 }
    );
  }

  const csvText = await readFile(csvPath, "utf8");
  const records = loadSalesRecords(csvText);
  if (records.length === 0) {
    return NextResponse.json(
      { message: "No usable sales rows found in the CSV." },
      { status: 400 }
    );
  }

  const sorted = [...records].sort(
    (a, b) => a.purchaseTime.getTime() - b.purchaseTime.getTime()
  );
  const orderIds = new Set(sorted.map((row) => row.orderId).filter(Boolean));
  const totalUnits = sorted.reduce((sum, row) => sum + row.quantity, 0);

  const monthMap = new Map<string, { month: string; units: number; orders: number }>();
  const recentMap = new Map<string, { date: string; units: number; orders: number }>();
  const weekdayMap = new Map<string, number>(WEEKDAYS.map((day) => [day, 0]));
  const productMap = new Map<string, { product: string; units: number; orders: Set<string> }>();

  for (const row of sorted) {
    const monthKey = `${row.purchaseTime.getFullYear()}-${String(
      row.purchaseTime.getMonth() + 1
    ).padStart(2, "0")}`;
    const dayKey = formatDate(row.purchaseTime);
    const weekday =
      WEEKDAYS[(row.purchaseTime.getDay() + 6) % 7];

    const monthEntry = monthMap.get(monthKey) ?? {
      month: formatMonth(row.purchaseTime),
      units: 0,
      orders: 0,
    };
    monthEntry.units += row.quantity;
    monthMap.set(monthKey, monthEntry);

    const dayEntry = recentMap.get(dayKey) ?? { date: dayKey, units: 0, orders: 0 };
    dayEntry.units += row.quantity;
    recentMap.set(dayKey, dayEntry);

    weekdayMap.set(weekday, (weekdayMap.get(weekday) ?? 0) + row.quantity);

    const productEntry = productMap.get(row.product) ?? {
      product: row.product,
      units: 0,
      orders: new Set<string>(),
    };
    productEntry.units += row.quantity;
    if (row.orderId) productEntry.orders.add(row.orderId);
    productMap.set(row.product, productEntry);
  }

  const ordersPerMonth = new Map<string, Set<string>>();
  const ordersPerDay = new Map<string, Set<string>>();
  for (const row of sorted) {
    if (!row.orderId) continue;
    const monthKey = `${row.purchaseTime.getFullYear()}-${String(
      row.purchaseTime.getMonth() + 1
    ).padStart(2, "0")}`;
    const dayKey = formatDate(row.purchaseTime);
    if (!ordersPerMonth.has(monthKey)) ordersPerMonth.set(monthKey, new Set<string>());
    if (!ordersPerDay.has(dayKey)) ordersPerDay.set(dayKey, new Set<string>());
    ordersPerMonth.get(monthKey)!.add(row.orderId);
    ordersPerDay.get(dayKey)!.add(row.orderId);
  }

  const monthlySeries = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      month: value.month,
      units: value.units,
      orders: ordersPerMonth.get(key)?.size ?? 0,
    }));

  const recentDailySeries = Array.from(recentMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([key, value]) => ({
      date: value.date,
      units: value.units,
      orders: ordersPerDay.get(key)?.size ?? 0,
    }));

  const weekdaySeries = WEEKDAYS.map((day) => ({
    day: day.slice(0, 3),
    units: weekdayMap.get(day) ?? 0,
  }));

  const topProducts = Array.from(productMap.values())
    .map((value) => ({
      product: value.product,
      units: value.units,
      orders: value.orders.size,
    }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 8);

  return NextResponse.json({
    sourceFile: path.basename(csvPath),
    summary: {
      totalUnits,
      totalOrders: orderIds.size,
      averageUnitsPerOrder: orderIds.size > 0 ? totalUnits / orderIds.size : 0,
      firstDate: formatDate(sorted[0].purchaseTime),
      lastDate: formatDate(sorted[sorted.length - 1].purchaseTime),
      productCount: productMap.size,
    },
    monthlySeries,
    recentDailySeries,
    weekdaySeries,
    topProducts,
  });
}
