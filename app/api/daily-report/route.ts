import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SALES_CSV = "trove_sales_data.csv";
const RECIPE_CSV = "trove_recipe_data.csv";
const SEARCH_DIRS = ["", "data", "scripts"];
const INGREDIENT_CATALOG: Record<
  string,
  {
    inventoryName: string;
    measureUnit: string;
    purchaseUnit: string;
    purchaseUnitSize: number;
    quantityMultiplier?: number;
  }
> = {
  "Espresso Shot": {
    inventoryName: "Coffee Beans",
    measureUnit: "g",
    purchaseUnit: "bag",
    purchaseUnitSize: 1000,
    quantityMultiplier: 18,
  },
  "Milk (ml)": {
    inventoryName: "Whole Milk",
    measureUnit: "ml",
    purchaseUnit: "carton",
    purchaseUnitSize: 1000,
  },
  "Water (ml)": {
    inventoryName: "Water",
    measureUnit: "ml",
    purchaseUnit: "jug",
    purchaseUnitSize: 5000,
  },
  "Chocolate Syrup (ml)": {
    inventoryName: "Chocolate Syrup",
    measureUnit: "ml",
    purchaseUnit: "bottle",
    purchaseUnitSize: 500,
  },
  "Cold Brew Concentrate (ml)": {
    inventoryName: "Cold Brew Concentrate",
    measureUnit: "ml",
    purchaseUnit: "jug",
    purchaseUnitSize: 1000,
  },
  "Chai Concentrate (ml)": {
    inventoryName: "Chai Concentrate",
    measureUnit: "ml",
    purchaseUnit: "carton",
    purchaseUnitSize: 1000,
  },
  "Matcha Powder (g)": {
    inventoryName: "Matcha Powder",
    measureUnit: "g",
    purchaseUnit: "tin",
    purchaseUnitSize: 500,
  },
  "Dough (g)": {
    inventoryName: "Dough",
    measureUnit: "g",
    purchaseUnit: "box",
    purchaseUnitSize: 1000,
  },
  "Butter (g)": {
    inventoryName: "Unsalted Butter",
    measureUnit: "g",
    purchaseUnit: "block",
    purchaseUnitSize: 250,
  },
  "Flour (g)": {
    inventoryName: "All-Purpose Flour",
    measureUnit: "g",
    purchaseUnit: "bag",
    purchaseUnitSize: 1000,
  },
  "Blueberries (g)": {
    inventoryName: "Blueberries",
    measureUnit: "g",
    purchaseUnit: "box",
    purchaseUnitSize: 125,
  },
  "Bread Slice": {
    inventoryName: "Bread",
    measureUnit: "slice",
    purchaseUnit: "loaf",
    purchaseUnitSize: 20,
  },
  "Avocado (g)": {
    inventoryName: "Avocados",
    measureUnit: "g",
    purchaseUnit: "unit",
    purchaseUnitSize: 150,
  },
};

type SalesRecord = {
  orderId: string;
  product: string;
  purchaseTime: Date;
  quantity: number;
  price: number;
};

type RecipeRecord = {
  product: string;
  ingredientName: string;
  measureUnit: string;
  quantityPerUnit: number;
  purchaseUnit: string;
  purchaseUnitSize: number;
};

type ItemRow = {
  id: string;
  product_name: string;
  unit: string | null;
  purchase_unit: string | null;
  purchase_unit_size: number | null;
  qty_in: number;
  qty_out: number;
};

type VendorProductRow = {
  item_id: string;
  vendor_id: string;
  price_per_unit: number | null;
  unit: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

type VendorRow = {
  id: string;
  name: string;
};

function resolveCsvPath(filename: string): string | null {
  for (const dir of SEARCH_DIRS) {
    const candidate = dir
      ? path.join(process.cwd(), dir, filename)
      : path.join(process.cwd(), filename);
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

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[%/#()]/g, "")
    .replace(/[\s-]+/g, "_");
}

function findFirstColumn(columns: string[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (columns.includes(candidate)) return candidate;
  }
  return null;
}

function parseLabeledUnit(label: string): { baseName: string; unit: string | null } {
  const match = label.trim().match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { baseName: label.trim(), unit: null };
  return { baseName: match[1].trim(), unit: match[2].trim() };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function loadSales(csvText: string): SalesRecord[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const dateCol = findFirstColumn(headers, [
    "transaction_date",
    "date",
    "sales_date",
    "order_date",
    "purchase_time",
    "timestamp",
  ]);
  const productCol = findFirstColumn(headers, [
    "product_type",
    "product_name",
    "item_name",
    "product",
    "item",
    "name",
  ]);
  const qtyCol = findFirstColumn(headers, [
    "transaction_qty",
    "qty",
    "quantity",
    "quantity_sold",
    "units_sold",
    "sales_qty",
  ]);
  const priceCol = findFirstColumn(headers, ["price", "unit_price"]);
  const orderIdCol = findFirstColumn(headers, ["order_id", "transaction_id"]);

  if (!dateCol || !productCol || !qtyCol) return [];

  const dateIdx = headers.indexOf(dateCol);
  const productIdx = headers.indexOf(productCol);
  const qtyIdx = headers.indexOf(qtyCol);
  const priceIdx = priceCol ? headers.indexOf(priceCol) : -1;
  const orderIdIdx = orderIdCol ? headers.indexOf(orderIdCol) : -1;

  return lines.slice(1).flatMap((line) => {
    const cells = parseCsvLine(line);
    const purchaseTime = new Date(cells[dateIdx] ?? "");
    const product = (cells[productIdx] ?? "").trim();
    const quantity = Number(cells[qtyIdx] ?? "");
    const price = priceIdx >= 0 ? Number(cells[priceIdx] ?? 0) : 0;
    const orderId = orderIdIdx >= 0 ? String(cells[orderIdIdx] ?? "").trim() : "";

    if (!product || Number.isNaN(purchaseTime.getTime()) || Number.isNaN(quantity)) {
      return [];
    }

    return [
      {
        orderId,
        product,
        purchaseTime,
        quantity,
        price: Number.isFinite(price) ? price : 0,
      },
    ];
  });
}

function loadRecipes(csvText: string): RecipeRecord[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const productCol = findFirstColumn(headers, [
    "product_type",
    "product_name",
    "recipe_name",
    "product",
    "item",
    "name",
  ]);
  const ingredientCol = findFirstColumn(headers, [
    "ingredient_name",
    "ingredient",
    "inventory_item",
    "component_name",
    "component",
  ]);
  const qtyCol = findFirstColumn(headers, [
    "quantity_per_unit",
    "qty_per_unit",
    "quantity",
    "amount",
    "amount_per_unit",
    "ingredient_qty",
    "usage_qty",
  ]);

  if (!productCol || !ingredientCol || !qtyCol) return [];

  const productIdx = headers.indexOf(productCol);
  const ingredientIdx = headers.indexOf(ingredientCol);
  const qtyIdx = headers.indexOf(qtyCol);

  return lines.slice(1).flatMap((line) => {
    const cells = parseCsvLine(line);
    const product = (cells[productIdx] ?? "").trim();
    const rawIngredient = (cells[ingredientIdx] ?? "").trim();
    const amount = Number(cells[qtyIdx] ?? "");
    if (!product || !rawIngredient || Number.isNaN(amount)) return [];

    const catalog = INGREDIENT_CATALOG[rawIngredient];
    const labeled = parseLabeledUnit(rawIngredient);

    return [
      {
        product,
        ingredientName: catalog?.inventoryName ?? labeled.baseName,
        measureUnit: catalog?.measureUnit ?? labeled.unit ?? "unit",
        quantityPerUnit: amount * (catalog?.quantityMultiplier ?? 1),
        purchaseUnit: catalog?.purchaseUnit ?? "unit",
        purchaseUnitSize: catalog?.purchaseUnitSize ?? 1,
      },
    ];
  });
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function GET() {
  const salesPath = resolveCsvPath(SALES_CSV);
  const recipePath = resolveCsvPath(RECIPE_CSV);

  if (!salesPath) {
    return NextResponse.json(
      { message: `Could not find ${SALES_CSV} in the project root.` },
      { status: 404 }
    );
  }

  const [salesCsv, recipeCsv] = await Promise.all([
    readFile(salesPath, "utf8"),
    recipePath ? readFile(recipePath, "utf8") : Promise.resolve(""),
  ]);

  const sales = loadSales(salesCsv).sort(
    (a, b) => a.purchaseTime.getTime() - b.purchaseTime.getTime()
  );
  const recipes = recipeCsv ? loadRecipes(recipeCsv) : [];

  if (sales.length === 0) {
    return NextResponse.json(
      { message: "No usable sales rows found in the sales CSV." },
      { status: 400 }
    );
  }

  const reportDate = formatDate(sales[sales.length - 1].purchaseTime);
  const dailySales = sales.filter((row) => formatDate(row.purchaseTime) === reportDate);
  const dailyOrderIds = new Set(dailySales.map((row) => row.orderId).filter(Boolean));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let items: ItemRow[] = [];
  let vendorProducts: VendorProductRow[] = [];
  let vendors: VendorRow[] = [];

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const [itemsResp, vendorProductsResp, vendorsResp] = await Promise.all([
      supabase
        .from("items")
        .select("id, product_name, unit, purchase_unit, purchase_unit_size, qty_in, qty_out"),
      supabase
        .from("vendor_products")
        .select("item_id, vendor_id, price_per_unit, unit, is_primary, created_at, updated_at"),
      supabase.from("vendors").select("id, name"),
    ]);

    items = (itemsResp.data as ItemRow[] | null) ?? [];
    vendorProducts = (vendorProductsResp.data as VendorProductRow[] | null) ?? [];
    vendors = (vendorsResp.data as VendorRow[] | null) ?? [];
  }

  const itemByName = new Map(items.map((item) => [item.product_name, item]));
  const vendorNameById = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  const primaryVendorByItemId = new Map<string, VendorProductRow>();

  vendorProducts.forEach((row) => {
    const current = primaryVendorByItemId.get(row.item_id);
    if (!current || row.is_primary) {
      primaryVendorByItemId.set(row.item_id, row);
    }
  });

  const costPerRawUnitByItem = new Map<string, number>();
  recipes.forEach((recipe) => {
    if (costPerRawUnitByItem.has(recipe.ingredientName)) return;

    const item = itemByName.get(recipe.ingredientName);
    if (!item) return;
    const primaryVendor = primaryVendorByItemId.get(item.id);
    if (!primaryVendor || primaryVendor.price_per_unit == null) return;

    const itemUnit = item.unit?.trim() ?? null;
    const itemPurchaseUnitSize = Number(item.purchase_unit_size ?? 0);
    const fallbackPurchaseUnitSize = recipe.purchaseUnitSize;
    const rawUnitsPerPurchaseUnit =
      itemUnit && itemUnit === recipe.measureUnit && itemPurchaseUnitSize > 0
        ? itemPurchaseUnitSize
        : fallbackPurchaseUnitSize > 0
          ? fallbackPurchaseUnitSize
          : itemPurchaseUnitSize > 0
            ? itemPurchaseUnitSize
            : 1;

    costPerRawUnitByItem.set(
      recipe.ingredientName,
      Number(primaryVendor.price_per_unit) / rawUnitsPerPurchaseUnit
    );
  });

  const hourlyMap = new Map<number, { hour: string; units: number; revenue: number }>();
  for (let hour = 0; hour < 24; hour += 1) {
    hourlyMap.set(hour, {
      hour: `${String(hour).padStart(2, "0")}:00`,
      units: 0,
      revenue: 0,
    });
  }

  const productSalesMap = new Map<
    string,
    { product: string; unitsSold: number; revenue: number; orderIds: Set<string> }
  >();

  dailySales.forEach((row) => {
    const hour = row.purchaseTime.getHours();
    const hourEntry = hourlyMap.get(hour)!;
    hourEntry.units += row.quantity;
    hourEntry.revenue += row.quantity * row.price;

    const productEntry = productSalesMap.get(row.product) ?? {
      product: row.product,
      unitsSold: 0,
      revenue: 0,
      orderIds: new Set<string>(),
    };
    productEntry.unitsSold += row.quantity;
    productEntry.revenue += row.quantity * row.price;
    if (row.orderId) productEntry.orderIds.add(row.orderId);
    productSalesMap.set(row.product, productEntry);
  });

  const recipeByProduct = new Map<string, RecipeRecord[]>();
  recipes.forEach((recipe) => {
    const current = recipeByProduct.get(recipe.product) ?? [];
    current.push(recipe);
    recipeByProduct.set(recipe.product, current);
  });

  const productBreakdown = Array.from(productSalesMap.values())
    .map((entry) => {
      const recipeRows = recipeByProduct.get(entry.product) ?? [];
      let estimatedSpend = 0;
      let pricedIngredients = 0;

      recipeRows.forEach((recipe) => {
        const unitCost = costPerRawUnitByItem.get(recipe.ingredientName);
        if (unitCost == null) return;
        estimatedSpend += recipe.quantityPerUnit * entry.unitsSold * unitCost;
        pricedIngredients += 1;
      });

      return {
        product: entry.product,
        unitsSold: entry.unitsSold,
        orderCount: entry.orderIds.size,
        avgSellPrice: entry.unitsSold > 0 ? money(entry.revenue / entry.unitsSold) : 0,
        revenue: money(entry.revenue),
        estimatedSpend: money(estimatedSpend),
        estimatedGrossProfit: money(entry.revenue - estimatedSpend),
        recipeCoverage: recipeRows.length > 0 ? pricedIngredients / recipeRows.length : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = productBreakdown.reduce((sum, row) => sum + row.revenue, 0);
  const totalEstimatedSpend = productBreakdown.reduce(
    (sum, row) => sum + row.estimatedSpend,
    0
  );

  const inventoryTotals = items.reduce(
    (acc, item) => ({
      qtyIn: acc.qtyIn + Number(item.qty_in ?? 0),
      qtyOut: acc.qtyOut + Number(item.qty_out ?? 0),
    }),
    { qtyIn: 0, qtyOut: 0 }
  );

  const vendorPricingRows = items
    .map((item) => {
      const vendorProduct = primaryVendorByItemId.get(item.id);
      if (!vendorProduct || vendorProduct.price_per_unit == null) return null;

      return {
        itemName: item.product_name,
        vendorName: vendorNameById.get(vendorProduct.vendor_id) ?? "Unknown vendor",
        currentPrice: money(Number(vendorProduct.price_per_unit)),
        unit: vendorProduct.unit || item.purchase_unit || item.unit || "unit",
        changedSinceCreated: vendorProduct.updated_at !== vendorProduct.created_at,
        updatedAt: vendorProduct.updated_at,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.itemName.localeCompare(b.itemName))
    .slice(0, 12);

  return NextResponse.json({
    reportDate,
    sourceFiles: {
      sales: path.basename(salesPath),
      recipes: recipePath ? path.basename(recipePath) : null,
    },
    summary: {
      unitsSold: dailySales.reduce((sum, row) => sum + row.quantity, 0),
      orderCount: dailyOrderIds.size,
      revenue: money(totalRevenue),
      estimatedSpend: money(totalEstimatedSpend),
      estimatedGrossProfit: money(totalRevenue - totalEstimatedSpend),
      itemsIn: inventoryTotals.qtyIn,
      itemsOut: inventoryTotals.qtyOut,
    },
    hourlySales: Array.from(hourlyMap.values()),
    productBreakdown,
    vendorPricing: {
      historyAvailable: false,
      note:
        "Historical vendor price increases/decreases are not stored yet. This section shows current primary vendor pricing as a baseline.",
      rows: vendorPricingRows,
    },
  });
}
