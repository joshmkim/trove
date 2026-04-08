import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SALES_CSV = "trove_sales_data.csv";
const RECIPE_CSV = "trove_recipe_data.csv";
const INVOICE_CSV_CANDIDATES = ["trove_invoices_data.csv", "trove_invoices.csv"];
const SEARCH_DIRS = ["", "data", "scripts"];
const OPERATING_HOURS = { start: 8, end: 18 };

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

const INVOICE_ITEM_ALIASES: Record<string, string | null> = {
  avocado: "Avocados",
  avocados: "Avocados",
  "espresso beans": "Coffee Beans",
  "coffee beans": "Coffee Beans",
  "cold brew beans": "Coffee Beans",
  flour: "All-Purpose Flour",
  "all-purpose flour": "All-Purpose Flour",
  "all purpose flour": "All-Purpose Flour",
  butter: "Unsalted Butter",
  "unsalted butter": "Unsalted Butter",
  bread: "Bread",
  "sourdough bread": "Bread",
  "whole milk": "Whole Milk",
  milk: "Whole Milk",
  blueberries: "Blueberries",
  "chai concentrate": "Chai Concentrate",
  "chocolate syrup": "Chocolate Syrup",
  "cold brew concentrate": "Cold Brew Concentrate",
  "matcha powder": "Matcha Powder",
  dough: "Dough",
  water: "Water",
  croissant: null,
  bagel: null,
  "blueberry muffin": null,
  "12oz cups": null,
  "16oz cups": null,
  "cup lids": null,
  napkins: null,
  "paper straws": null,
  sugar: null,
  "vanilla syrup": null,
  "oat milk": null,
  "almond milk": null,
  lemon: null,
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
  sku_id: string | null;
  unit: string | null;
  purchase_unit: string | null;
  purchase_unit_size: number | null;
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

type InvoiceParsedItem = {
  productName: string;
  qtyIn: number;
  skuId?: string;
  unitPrice?: number;
  lineTotal?: number;
};

type InvoiceRow = {
  filename: string;
  created_at: string;
  parsed_items: unknown;
};

type InvoiceLine = {
  date: string;
  itemName: string;
  qtyIn: number;
  unitPrice: number | null;
  lineTotal: number | null;
  invoiceId: string;
};

type PriceSource = {
  purchaseUnitCost: number;
  source: "invoice" | "vendor";
};

type DailyItemOpportunity = {
  itemName: string;
  unit: string;
  openingQty: number;
  purchasedQty: number;
  usedQty: number;
  closingQty: number;
  excessQty: number;
  shortageQty: number;
  avoidableSpend: number;
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

function resolveFirstCsvPath(filenames: string[]): string | null {
  for (const filename of filenames) {
    const resolved = resolveCsvPath(filename);
    if (resolved) return resolved;
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCurrencyText(value: number): string {
  return `$${money(value).toFixed(2)}`;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function safeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function sanitizeInvoiceItems(input: unknown): InvoiceParsedItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<InvoiceParsedItem>;
      const productName = candidate.productName?.trim() ?? "";
      const qtyIn = Number(candidate.qtyIn);
      const skuId = candidate.skuId?.trim() ?? "";
      const unitPrice = safeNumber(candidate.unitPrice);
      const lineTotal = safeNumber(candidate.lineTotal);

      if (!productName || !Number.isFinite(qtyIn) || qtyIn <= 0) {
        return null;
      }

      return {
        productName,
        qtyIn,
        skuId,
        unitPrice,
        lineTotal,
      };
    })
    .filter((item): item is InvoiceParsedItem => item !== null);
}

function loadInvoiceCsv(csvText: string): InvoiceLine[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const invoiceIdCol = findFirstColumn(headers, ["invoice_id"]);
  const dateCol = findFirstColumn(headers, ["purchase_time", "transaction_date", "date"]);
  const itemCol = findFirstColumn(headers, ["purchased_item", "product_name", "item_name", "product"]);
  const qtyCol = findFirstColumn(headers, ["quantity", "qty"]);
  const packSizeCol = findFirstColumn(headers, ["pack_size", "case_size", "units_per_case"]);
  const unitPriceCol = findFirstColumn(headers, ["unit_price", "price"]);
  const lineTotalCol = findFirstColumn(headers, ["line_total", "total"]);

  if (!invoiceIdCol || !dateCol || !itemCol || !qtyCol) return [];

  const invoiceIdIdx = headers.indexOf(invoiceIdCol);
  const dateIdx = headers.indexOf(dateCol);
  const itemIdx = headers.indexOf(itemCol);
  const qtyIdx = headers.indexOf(qtyCol);
  const packSizeIdx = packSizeCol ? headers.indexOf(packSizeCol) : -1;
  const unitPriceIdx = unitPriceCol ? headers.indexOf(unitPriceCol) : -1;
  const lineTotalIdx = lineTotalCol ? headers.indexOf(lineTotalCol) : -1;

  return lines.slice(1).flatMap((line) => {
    const cells = parseCsvLine(line);
    const dt = new Date(cells[dateIdx] ?? "");
    const itemName = (cells[itemIdx] ?? "").trim();
    const packQty = Number(cells[qtyIdx] ?? "");
    const packSize = packSizeIdx >= 0 ? Number(cells[packSizeIdx] ?? 1) : 1;
    const invoiceId = String(cells[invoiceIdIdx] ?? "").trim();
    const unitPrice = unitPriceIdx >= 0 ? safeNumber(cells[unitPriceIdx]) : null;
    const lineTotal = lineTotalIdx >= 0 ? safeNumber(cells[lineTotalIdx]) : null;
    if (!itemName || !invoiceId || Number.isNaN(dt.getTime()) || !Number.isFinite(packQty) || packQty <= 0) {
      return [];
    }

    const resolvedPackSize = Number.isFinite(packSize) && packSize > 0 ? packSize : 1;
    const qtyIn = packQty * resolvedPackSize;

    return [
      {
        date: formatDate(dt),
        itemName,
        qtyIn,
        unitPrice: unitPrice != null ? unitPrice / resolvedPackSize : null,
        lineTotal,
        invoiceId,
      },
    ];
  });
}

function getOrCreateNumberMap(target: Map<string, number>, key: string): number {
  return target.get(key) ?? 0;
}

function getOrCreateNestedNumberMap(
  target: Map<string, Map<string, number>>,
  key: string
): Map<string, number> {
  const existing = target.get(key);
  if (existing) return existing;
  const created = new Map<string, number>();
  target.set(key, created);
  return created;
}

function resolveInvoiceItemName(
  invoiceItem: InvoiceParsedItem,
  itemBySku: Map<string, ItemRow>,
  itemByNormalizedName: Map<string, ItemRow>,
  allItems: ItemRow[]
): string {
  const skuMatch = invoiceItem.skuId ? itemBySku.get(invoiceItem.skuId) : undefined;
  if (skuMatch) return skuMatch.product_name;

  const normalized = normalizeText(invoiceItem.productName);
  const exactMatch = itemByNormalizedName.get(normalized);
  if (exactMatch) return exactMatch.product_name;

  const containsMatch = allItems.find((item) => {
    const candidate = normalizeText(item.product_name);
    return candidate.includes(normalized) || normalized.includes(candidate);
  });

  return containsMatch?.product_name ?? invoiceItem.productName;
}

function canonicalizeInvoiceIngredientName(
  rawItemName: string,
  trackedIngredientNames: Set<string>,
  trackedIngredientByNormalizedName: Map<string, string>
): string | null {
  const normalized = normalizeText(rawItemName);
  const aliasMatch = INVOICE_ITEM_ALIASES[normalized];
  if (aliasMatch !== undefined) {
    return aliasMatch && trackedIngredientNames.has(aliasMatch) ? aliasMatch : null;
  }

  const directMatch = trackedIngredientByNormalizedName.get(normalized);
  if (directMatch) return directMatch;

  for (const [candidateNormalized, candidateName] of trackedIngredientByNormalizedName.entries()) {
    if (
      candidateNormalized.includes(normalized) ||
      normalized.includes(candidateNormalized)
    ) {
      return candidateName;
    }
  }

  return null;
}

function rawUnitsPerPurchaseUnit(item: ItemRow | undefined, recipe: RecipeRecord): number {
  const itemUnit = item?.unit?.trim() ?? null;
  const itemPurchaseUnitSize = Number(item?.purchase_unit_size ?? 0);

  if (itemUnit && itemUnit === recipe.measureUnit && itemPurchaseUnitSize > 0) {
    return itemPurchaseUnitSize;
  }

  if (recipe.purchaseUnitSize > 0) return recipe.purchaseUnitSize;
  if (itemPurchaseUnitSize > 0) return itemPurchaseUnitSize;
  return 1;
}

export async function GET(req: Request) {
  const salesPath = resolveCsvPath(SALES_CSV);
  const recipePath = resolveCsvPath(RECIPE_CSV);
  const invoiceCsvPath = resolveFirstCsvPath(INVOICE_CSV_CANDIDATES);

  if (!salesPath) {
    return NextResponse.json(
      { message: `Could not find ${SALES_CSV} in the project root.` },
      { status: 404 }
    );
  }

  const [salesCsv, recipeCsv, invoiceCsv] = await Promise.all([
    readFile(salesPath, "utf8"),
    recipePath ? readFile(recipePath, "utf8") : Promise.resolve(""),
    invoiceCsvPath ? readFile(invoiceCsvPath, "utf8") : Promise.resolve(""),
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

  const salesLastDate = formatDate(sales[sales.length - 1].purchaseTime);
  const url = new URL(req.url);
  const requestedDate = url.searchParams.get("date");
  const reportDate = requestedDate ?? salesLastDate;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { message: "Supabase environment variables are missing." },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const [itemsResp, vendorProductsResp, vendorsResp, invoicesResp] = await Promise.all([
    supabase
      .from("items")
      .select("id, product_name, sku_id, unit, purchase_unit, purchase_unit_size"),
    supabase
      .from("vendor_products")
      .select("item_id, vendor_id, price_per_unit, unit, is_primary, created_at, updated_at"),
    supabase.from("vendors").select("id, name"),
    supabase.from("invoices").select("filename, created_at, parsed_items").order("created_at"),
  ]);

  if (itemsResp.error || vendorProductsResp.error || vendorsResp.error || invoicesResp.error) {
    return NextResponse.json(
      {
        message:
          itemsResp.error?.message ??
          vendorProductsResp.error?.message ??
          vendorsResp.error?.message ??
          invoicesResp.error?.message ??
          "Failed to load report sources.",
      },
      { status: 500 }
    );
  }

  const items = (itemsResp.data as ItemRow[] | null) ?? [];
  const vendorProducts = (vendorProductsResp.data as VendorProductRow[] | null) ?? [];
  const vendors = (vendorsResp.data as VendorRow[] | null) ?? [];
  const invoices = (invoicesResp.data as InvoiceRow[] | null) ?? [];

  const itemByName = new Map(items.map((item) => [item.product_name, item]));
  const itemBySku = new Map(
    items.filter((item) => item.sku_id).map((item) => [item.sku_id as string, item])
  );
  const itemByNormalizedName = new Map(
    items.map((item) => [normalizeText(item.product_name), item])
  );
  const vendorNameById = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));

  const primaryVendorByItemId = new Map<string, VendorProductRow>();
  vendorProducts.forEach((row) => {
    const current = primaryVendorByItemId.get(row.item_id);
    if (!current || row.is_primary) {
      primaryVendorByItemId.set(row.item_id, row);
    }
  });

  const invoiceLinesFromDb: InvoiceLine[] = invoices.flatMap((invoice) => {
    const invoiceDate = formatDate(new Date(invoice.created_at));
    return sanitizeInvoiceItems(invoice.parsed_items).map((item) => ({
      date: invoiceDate,
      itemName: resolveInvoiceItemName(item, itemBySku, itemByNormalizedName, items),
      qtyIn: item.qtyIn,
      unitPrice: item.unitPrice ?? null,
      lineTotal: item.lineTotal ?? null,
      invoiceId: `${invoice.filename}:${invoice.created_at}:${item.productName}`,
    }));
  });
  const invoiceLinesFromCsv = invoiceCsv ? loadInvoiceCsv(invoiceCsv) : [];
  const invoiceLines: InvoiceLine[] = [...invoiceLinesFromCsv, ...invoiceLinesFromDb];

  const recipesByProduct = new Map<string, RecipeRecord[]>();
  recipes.forEach((recipe) => {
    const current = recipesByProduct.get(recipe.product) ?? [];
    current.push(recipe);
    recipesByProduct.set(recipe.product, current);
  });

  const trackedIngredientNames = new Set(recipes.map((recipe) => recipe.ingredientName));
  const trackedIngredientByNormalizedName = new Map(
    Array.from(trackedIngredientNames).map((name) => [normalizeText(name), name])
  );

  const ingredientInvoiceLines = invoiceLines.flatMap((line) => {
    const canonicalName = canonicalizeInvoiceIngredientName(
      line.itemName,
      trackedIngredientNames,
      trackedIngredientByNormalizedName
    );
    if (!canonicalName) return [];
    return [{ ...line, itemName: canonicalName }];
  });

  const invoicePricesByItem = new Map<string, number[]>();
  ingredientInvoiceLines.forEach((line) => {
    if (line.unitPrice != null && line.unitPrice > 0) {
      const current = invoicePricesByItem.get(line.itemName) ?? [];
      current.push(line.unitPrice);
      invoicePricesByItem.set(line.itemName, current);
    }
  });

  const purchaseUnitPriceByItem = new Map<string, PriceSource>();
  trackedIngredientNames.forEach((itemName) => {
    const invoicePrices = invoicePricesByItem.get(itemName) ?? [];
    const avgInvoicePrice =
      invoicePrices.length > 0
        ? invoicePrices.reduce((sum, value) => sum + value, 0) / invoicePrices.length
        : null;
    const item = itemByName.get(itemName);
    const vendorRow = item ? primaryVendorByItemId.get(item.id) : undefined;
    const vendorPrice =
      vendorRow?.price_per_unit != null ? Number(vendorRow.price_per_unit) : null;

    if (avgInvoicePrice != null) {
      purchaseUnitPriceByItem.set(itemName, {
        purchaseUnitCost: avgInvoicePrice,
        source: "invoice",
      });
      return;
    }
    if (vendorPrice != null) {
      purchaseUnitPriceByItem.set(itemName, {
        purchaseUnitCost: vendorPrice,
        source: "vendor",
      });
    }
  });

  const rawUnitCostByItem = new Map<string, number>();
  const rawUnitsPerPurchaseByItem = new Map<string, number>();
  const displayUnitByItem = new Map<string, string>();
  const purchaseUnitByItem = new Map<string, string>();
  recipes.forEach((recipe) => {
    const item = itemByName.get(recipe.ingredientName);
    const rawUnitsPerPurchase = rawUnitsPerPurchaseUnit(item, recipe);
    if (!rawUnitsPerPurchaseByItem.has(recipe.ingredientName)) {
      rawUnitsPerPurchaseByItem.set(recipe.ingredientName, rawUnitsPerPurchase);
    }
    if (!displayUnitByItem.has(recipe.ingredientName)) {
      displayUnitByItem.set(recipe.ingredientName, recipe.measureUnit);
    }
    if (!purchaseUnitByItem.has(recipe.ingredientName)) {
      purchaseUnitByItem.set(recipe.ingredientName, recipe.purchaseUnit);
    }
    if (rawUnitCostByItem.has(recipe.ingredientName)) return;
    const priceSource = purchaseUnitPriceByItem.get(recipe.ingredientName);
    if (!priceSource) return;
    rawUnitCostByItem.set(
      recipe.ingredientName,
      priceSource.purchaseUnitCost / rawUnitsPerPurchase
    );
  });

  const hourlySalesMap = new Map<number, { hour: string; units: number; revenue: number }>();
  for (let hour = OPERATING_HOURS.start; hour < OPERATING_HOURS.end; hour += 1) {
    hourlySalesMap.set(hour, {
      hour: `${String(hour).padStart(2, "0")}:00`,
      units: 0,
      revenue: 0,
    });
  }

  const productSalesByDate = new Map<
    string,
    Map<string, { unitsSold: number; revenue: number; orderIds: Set<string> }>
  >();
  const rawNeedByDateItem = new Map<string, Map<string, number>>();
  const rawNeedByDateProductItem = new Map<string, Map<string, Map<string, number>>>();

  sales.forEach((sale) => {
    const date = formatDate(sale.purchaseTime);
    const salesByProduct = productSalesByDate.get(date) ?? new Map();
    const productEntry = salesByProduct.get(sale.product) ?? {
      unitsSold: 0,
      revenue: 0,
      orderIds: new Set<string>(),
    };
    productEntry.unitsSold += sale.quantity;
    productEntry.revenue += sale.quantity * sale.price;
    if (sale.orderId) productEntry.orderIds.add(sale.orderId);
    salesByProduct.set(sale.product, productEntry);
    productSalesByDate.set(date, salesByProduct);

    if (date === reportDate) {
      const hourEntry = hourlySalesMap.get(sale.purchaseTime.getHours());
      if (hourEntry) {
        hourEntry.units += sale.quantity;
        hourEntry.revenue += sale.quantity * sale.price;
      }
    }

    const recipeRows = recipesByProduct.get(sale.product) ?? [];
    if (recipeRows.length === 0) return;
    const dailyNeeds = getOrCreateNestedNumberMap(rawNeedByDateItem, date);
    const productNeedsByDate = rawNeedByDateProductItem.get(date) ?? new Map<string, Map<string, number>>();
    const productNeeds = productNeedsByDate.get(sale.product) ?? new Map<string, number>();
    recipeRows.forEach((recipe) => {
      const currentNeed = getOrCreateNumberMap(dailyNeeds, recipe.ingredientName);
      dailyNeeds.set(
        recipe.ingredientName,
        currentNeed + sale.quantity * recipe.quantityPerUnit
      );
      productNeeds.set(
        recipe.ingredientName,
        (productNeeds.get(recipe.ingredientName) ?? 0) + sale.quantity * recipe.quantityPerUnit
      );
    });
    productNeedsByDate.set(sale.product, productNeeds);
    rawNeedByDateProductItem.set(date, productNeedsByDate);
  });

  const purchaseNeedByDateItem = new Map<string, Map<string, number>>();
  rawNeedByDateItem.forEach((rawNeeds, date) => {
    const purchaseNeeds = new Map<string, number>();
    rawNeeds.forEach((rawQty, itemName) => {
      const recipe = recipes.find((row) => row.ingredientName === itemName);
      if (!recipe) return;
      const item = itemByName.get(itemName);
      const purchaseQty = Math.ceil(rawQty / rawUnitsPerPurchaseUnit(item, recipe));
      purchaseNeeds.set(itemName, purchaseQty);
    });
    purchaseNeedByDateItem.set(date, purchaseNeeds);
  });

  const rawInvoiceQtyByDateItem = new Map<string, Map<string, number>>();
  const rawInvoiceSpendByDateItem = new Map<string, Map<string, number>>();
  const invoiceQtyByDateItem = new Map<string, Map<string, number>>();
  const invoiceSpendByDateItem = new Map<string, Map<string, number>>();
  const rawOrderedByDateItem = new Map<string, Map<string, number>>();
  const invoiceCountByDate = new Map<string, Set<string>>();

  invoiceLines.forEach((line) => {
    const invoicesOnDate = invoiceCountByDate.get(line.date) ?? new Set<string>();
    invoicesOnDate.add(line.invoiceId);
    invoiceCountByDate.set(line.date, invoicesOnDate);
  });

  invoiceLines.forEach((line) => {
    const qtyMap = getOrCreateNestedNumberMap(rawInvoiceQtyByDateItem, line.date);
    qtyMap.set(line.itemName, getOrCreateNumberMap(qtyMap, line.itemName) + line.qtyIn);

    const spendValue =
      line.lineTotal != null && line.lineTotal > 0
        ? line.lineTotal
        : line.unitPrice != null && line.unitPrice > 0
          ? line.unitPrice * line.qtyIn
          : 0;
    const spendMap = getOrCreateNestedNumberMap(rawInvoiceSpendByDateItem, line.date);
    spendMap.set(line.itemName, getOrCreateNumberMap(spendMap, line.itemName) + spendValue);
  });

  ingredientInvoiceLines.forEach((line) => {
    const qtyMap = getOrCreateNestedNumberMap(invoiceQtyByDateItem, line.date);
    qtyMap.set(line.itemName, getOrCreateNumberMap(qtyMap, line.itemName) + line.qtyIn);
    const rawQtyMap = getOrCreateNestedNumberMap(rawOrderedByDateItem, line.date);
    rawQtyMap.set(
      line.itemName,
      getOrCreateNumberMap(rawQtyMap, line.itemName) +
        line.qtyIn * (rawUnitsPerPurchaseByItem.get(line.itemName) ?? 1)
    );

    const spendValue =
      line.lineTotal != null && line.lineTotal > 0
        ? line.lineTotal
        : line.unitPrice != null && line.unitPrice > 0
          ? line.unitPrice * line.qtyIn
          : 0;
    const spendMap = getOrCreateNestedNumberMap(invoiceSpendByDateItem, line.date);
    spendMap.set(line.itemName, getOrCreateNumberMap(spendMap, line.itemName) + spendValue);
  });

  const reportSalesByProduct = productSalesByDate.get(reportDate) ?? new Map();
  const reportRawInvoiceQty = rawInvoiceQtyByDateItem.get(reportDate) ?? new Map();
  const reportRawInvoiceSpend = rawInvoiceSpendByDateItem.get(reportDate) ?? new Map();
  const reportInvoiceQty = invoiceQtyByDateItem.get(reportDate) ?? new Map();
  const reportInvoiceSpend = invoiceSpendByDateItem.get(reportDate) ?? new Map();
  const reportPurchaseNeeds = purchaseNeedByDateItem.get(reportDate) ?? new Map();
  const reportDistinctOrderIds = new Set<string>();
  reportSalesByProduct.forEach((entry) => {
    entry.orderIds.forEach((orderId) => reportDistinctOrderIds.add(orderId));
  });

  const reportInvoiceItemRows = Array.from(reportRawInvoiceQty.entries())
    .map(([itemName, qtyIn]) => ({
      itemName,
      qtyIn,
      spend: money(reportRawInvoiceSpend.get(itemName) ?? 0),
    }))
    .sort((a, b) => b.qtyIn - a.qtyIn);

  const itemMovementRows = Array.from(
    new Set([
      ...Array.from(reportInvoiceQty.keys()),
      ...Array.from(reportPurchaseNeeds.keys()),
    ])
  )
    .map((itemName) => {
      const qtyIn = reportInvoiceQty.get(itemName) ?? 0;
      const qtyOut = reportPurchaseNeeds.get(itemName) ?? 0;
      const spend = money(reportInvoiceSpend.get(itemName) ?? 0);
      const price = purchaseUnitPriceByItem.get(itemName)?.purchaseUnitCost ?? 0;
      return {
        itemName,
        qtyIn,
        qtyOut,
        net: qtyIn - qtyOut,
        estimatedSpend: spend > 0 ? spend : money(qtyIn * price),
      };
    })
    .sort((a, b) => Math.max(b.qtyIn, b.qtyOut) - Math.max(a.qtyIn, a.qtyOut));

  const productBreakdown = Array.from(reportSalesByProduct.entries())
    .map(([product, entry]) => {
      const recipeRows = recipesByProduct.get(product) ?? [];
      let estimatedSpend = 0;
      let pricedIngredients = 0;

      recipeRows.forEach((recipe) => {
        const rawCost = rawUnitCostByItem.get(recipe.ingredientName);
        if (rawCost == null) return;
        estimatedSpend += entry.unitsSold * recipe.quantityPerUnit * rawCost;
        pricedIngredients += 1;
      });

      return {
        product,
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

  const movementDates = Array.from(
    new Set([
      ...Array.from(purchaseNeedByDateItem.keys()),
      ...Array.from(invoiceQtyByDateItem.keys()),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const rollingRawStockByItem = new Map<string, number>();
  const dailyItemOpportunityByDate = new Map<string, DailyItemOpportunity[]>();

  const dailyOpportunityRows = movementDates.map((date) => {
    const needMap = purchaseNeedByDateItem.get(date) ?? new Map();
    const rawNeedMap = rawNeedByDateItem.get(date) ?? new Map();
    const orderedMap = invoiceQtyByDateItem.get(date) ?? new Map();
    const rawOrderedMap = rawOrderedByDateItem.get(date) ?? new Map();
    const itemsForDay = new Set([
      ...Array.from(needMap.keys()),
      ...Array.from(orderedMap.keys()),
    ]);

    let overorderedUnits = 0;
    let underorderedUnits = 0;
    let overorderedCost = 0;
    let underorderedCost = 0;
    let openingUnits = 0;
    let closingUnits = 0;
    const itemOpportunities: DailyItemOpportunity[] = [];
    const dayProductSales = productSalesByDate.get(date) ?? new Map();
    const dayRevenue = Array.from(dayProductSales.values()).reduce((sum, row) => sum + row.revenue, 0);
    let largestItem = "—";
    let largestImpact = 0;
    const shortageRatioByItem = new Map<string, number>();

    itemsForDay.forEach((itemName) => {
      const rawUnitSize = rawUnitsPerPurchaseByItem.get(itemName) ?? 1;
      const openingRawStock = rollingRawStockByItem.get(itemName) ?? 0;
      const neededRaw = rawNeedMap.get(itemName) ?? 0;
      const ordered = orderedMap.get(itemName) ?? 0;
      const orderedRaw = rawOrderedMap.get(itemName) ?? 0;
      const neededAfterCarryRaw = Math.max(neededRaw - openingRawStock, 0);
      const avoidableRaw = Math.max(orderedRaw - neededAfterCarryRaw, 0);
      const avoidableOrder = Math.max(ordered - Math.ceil(neededAfterCarryRaw / rawUnitSize), 0);
      const shortageRaw = Math.max(neededAfterCarryRaw - orderedRaw, 0);
      const shortage = Math.ceil(shortageRaw / rawUnitSize);
      const closingRawStock = Math.max(openingRawStock + orderedRaw - neededRaw, 0);
      const cost = purchaseUnitPriceByItem.get(itemName)?.purchaseUnitCost ?? 0;
      const overCost = rawUnitSize > 0 ? (avoidableRaw / rawUnitSize) * cost : 0;
      const underCost = rawUnitSize > 0 ? (shortageRaw / rawUnitSize) * cost : 0;

      rollingRawStockByItem.set(itemName, closingRawStock);
      // Convert raw units (g, ml) to purchase units (bags, cartons), rounded up.
      const toDisplay = (raw: number) =>
        rawUnitSize > 0 ? Math.ceil(raw / rawUnitSize) : Math.ceil(raw);
      itemOpportunities.push({
        itemName,
        unit: purchaseUnitByItem.get(itemName) ?? displayUnitByItem.get(itemName) ?? "unit",
        openingQty: toDisplay(openingRawStock),
        purchasedQty: toDisplay(orderedRaw),
        usedQty: toDisplay(neededRaw),
        closingQty: toDisplay(closingRawStock),
        excessQty: toDisplay(avoidableRaw),
        shortageQty: toDisplay(shortageRaw),
        avoidableSpend: money(overCost),
      });
      // Store the raw shortage so the profit calculation can use physical units.
      shortageRatioByItem.set(itemName, shortageRaw);

      openingUnits += Math.ceil(openingRawStock / rawUnitSize);
      closingUnits += Math.ceil(closingRawStock / rawUnitSize);
      overorderedUnits += avoidableOrder;
      underorderedUnits += shortage;
      overorderedCost += overCost;
      underorderedCost += underCost;

      const impact = Math.max(overCost, underCost);
      if (impact > largestImpact) {
        largestImpact = impact;
        largestItem = itemName;
      }
    });

    const estimatedRevenueAtRisk = 0;

    dailyItemOpportunityByDate.set(date, itemOpportunities);

      return {
        date,
        openingUnits,
        orderedUnits: Array.from(orderedMap.values()).reduce((sum, value) => sum + value, 0),
        neededUnits: Array.from(needMap.values()).reduce((sum, value) => sum + value, 0),
        closingUnits,
        overorderedUnits,
        underorderedUnits,
        overorderedCost: money(overorderedCost),
        underorderedCost: money(underorderedCost),
        estimatedRevenueAtRisk: money(estimatedRevenueAtRisk),
        largestItem,
        revenue: money(dayRevenue),
      };
  });

  function summarizeWindow(windowDays: number) {
    const end = new Date(`${reportDate}T00:00:00`);
    const start = new Date(end);
    start.setDate(start.getDate() - (windowDays - 1));
    const startDate = formatDate(start);

    const rows = dailyOpportunityRows
      .filter((row) => row.date >= startDate && row.date <= reportDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    let shortageDays = 0;
    let avoidableOrderDays = 0;
    const ingredientMap = new Map<
      string,
      {
        ingredientName: string;
        unit: string;
        openingQty: number;
        purchasedQty: number;
        usedQty: number;
        closingQty: number;
        excessQty: number;
        shortageQty: number;
        avoidableSpend: number;
        dailyRows: Array<{
          date: string;
          openingQty: number;
          purchasedQty: number;
          usedQty: number;
          closingQty: number;
          excessQty: number;
          shortageQty: number;
          avoidableSpend: number;
        }>;
      }
    >();

    rows.forEach((row) => {
      if (row.underorderedUnits > 0) shortageDays += 1;
      if (row.overorderedUnits > 0) avoidableOrderDays += 1;

      (dailyItemOpportunityByDate.get(row.date) ?? []).forEach((itemRow) => {
        const current = ingredientMap.get(itemRow.itemName);
        if (current) {
          current.purchasedQty = Math.ceil(current.purchasedQty + itemRow.purchasedQty);
          current.usedQty = Math.ceil(current.usedQty + itemRow.usedQty);
          current.closingQty = itemRow.closingQty;
          current.excessQty = Math.ceil(current.excessQty + itemRow.excessQty);
          current.shortageQty = Math.ceil(current.shortageQty + itemRow.shortageQty);
          current.avoidableSpend = money(current.avoidableSpend + itemRow.avoidableSpend);
          current.dailyRows.push({
            date: row.date,
            openingQty: itemRow.openingQty,
            purchasedQty: itemRow.purchasedQty,
            usedQty: itemRow.usedQty,
            closingQty: itemRow.closingQty,
            excessQty: itemRow.excessQty,
            shortageQty: itemRow.shortageQty,
            avoidableSpend: itemRow.avoidableSpend,
          });
          return;
        }

        ingredientMap.set(itemRow.itemName, {
          ingredientName: itemRow.itemName,
          unit: itemRow.unit,
          openingQty: itemRow.openingQty,
          purchasedQty: itemRow.purchasedQty,
          usedQty: itemRow.usedQty,
          closingQty: itemRow.closingQty,
          excessQty: itemRow.excessQty,
          shortageQty: itemRow.shortageQty,
          avoidableSpend: itemRow.avoidableSpend,
          dailyRows: [
            {
              date: row.date,
              openingQty: itemRow.openingQty,
              purchasedQty: itemRow.purchasedQty,
              usedQty: itemRow.usedQty,
              closingQty: itemRow.closingQty,
              excessQty: itemRow.excessQty,
              shortageQty: itemRow.shortageQty,
              avoidableSpend: itemRow.avoidableSpend,
            },
          ],
        });
      });
    });

    // Recompute excess/shortage as the net balance over the window so both are
    // never non-zero simultaneously. Summing daily values independently produces
    // that artifact when some days over-ordered and others under-ordered.
    ingredientMap.forEach((row) => {
      const net = row.openingQty + row.purchasedQty - row.usedQty;
      row.excessQty = Math.max(Math.ceil(net), 0);
      row.shortageQty = Math.max(Math.ceil(-net), 0);
    });

    const ingredientRows = Array.from(ingredientMap.values()).sort(
      (a, b) => b.avoidableSpend - a.avoidableSpend
    );
    const topAvoidableSpendItem = ingredientRows.find((row) => row.avoidableSpend > 0) ?? null;
    const topShortageItem = ingredientRows.find((row) => row.shortageQty > 0) ?? null;
    const patterns: string[] = [];

    if (topAvoidableSpendItem) {
      patterns.push(
        `You can save the most on ${topAvoidableSpendItem.ingredientName}: ${formatCurrencyText(topAvoidableSpendItem.avoidableSpend)} of avoidable spend across this window.`
      );
    } else {
      patterns.push("No material avoidable spend pattern was detected in this window.");
    }

    if (topShortageItem) {
      patterns.push(
        `${topShortageItem.ingredientName} had the largest shortage: ${topShortageItem.shortageQty} ${topShortageItem.unit}(s) short across this window.`
      );
    }

    patterns.push(
      `${shortageDays} of ${rows.length} tracked day(s) had at least one ingredient shortage, and ${avoidableOrderDays} day(s) included avoidable purchasing.`
    );

    return {
      fromDate: startDate,
      toDate: reportDate,
      avoidableSpend: money(
        ingredientRows.reduce((sum, row) => sum + row.avoidableSpend, 0)
      ),
      patterns,
      ingredientRows,
    };
  }

  const lastWeekSummary = summarizeWindow(7);
  const lastMonthSummary = summarizeWindow(30);

  const hourlyProductRows = Array.from(
    (() => {
      const grouped = new Map<string, Map<string, number>>();
      sales.forEach((sale) => {
        const date = formatDate(sale.purchaseTime);
        if (date !== reportDate) return;
        const hour = sale.purchaseTime.getHours();
        if (hour < OPERATING_HOURS.start || hour >= OPERATING_HOURS.end) return;
        const hourKey = `${String(hour).padStart(2, "0")}:00`;
        const byProduct = grouped.get(hourKey) ?? new Map<string, number>();
        byProduct.set(sale.product, (byProduct.get(sale.product) ?? 0) + sale.quantity);
        grouped.set(hourKey, byProduct);
      });
      return grouped;
    })().entries()
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, productMap]) => ({
      hour,
      products: Array.from(productMap.entries())
        .map(([product, quantity]) => ({ product, quantity }))
        .sort((a, b) => b.quantity - a.quantity),
    }));

  const vendorPricingRows = items
    .map((item) => {
      const vendorProduct = primaryVendorByItemId.get(item.id);
      if (!vendorProduct || vendorProduct.price_per_unit == null) return null;

      const invoicePrices = invoicePricesByItem.get(item.product_name) ?? [];
      const avgInvoicePrice =
        invoicePrices.length > 0
          ? invoicePrices.reduce((sum, value) => sum + value, 0) / invoicePrices.length
          : null;
      const currentPrice = Number(vendorProduct.price_per_unit);
      const delta = avgInvoicePrice != null ? currentPrice - avgInvoicePrice : null;
      const deltaPct =
        avgInvoicePrice != null && avgInvoicePrice > 0
          ? (delta! / avgInvoicePrice) * 100
          : null;

      return {
        itemName: item.product_name,
        vendorName: vendorNameById.get(vendorProduct.vendor_id) ?? "Unknown vendor",
        currentPrice: money(currentPrice),
        invoiceBaselinePrice: avgInvoicePrice != null ? money(avgInvoicePrice) : null,
        deltaValue: delta != null ? money(delta) : null,
        deltaPct: deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
        unit: vendorProduct.unit || item.purchase_unit || item.unit || "unit",
        hasInvoiceBaseline: avgInvoicePrice != null,
        updatedAt: vendorProduct.updated_at,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => {
      const aMagnitude = Math.abs(a.deltaValue ?? 0);
      const bMagnitude = Math.abs(b.deltaValue ?? 0);
      return bMagnitude - aMagnitude;
    })
    .slice(0, 12);

  const invoicesOnReportDate = invoiceCountByDate.get(reportDate)?.size ?? 0;

  const reportDateHasSales = reportSalesByProduct.size > 0;

  return NextResponse.json({
    reportDate,
    latestDataDate: salesLastDate,
    hasData: reportDateHasSales,
    sourceFiles: {
      sales: path.basename(salesPath),
      recipes: recipePath ? path.basename(recipePath) : null,
      invoices: invoiceCsvPath ? path.basename(invoiceCsvPath) : null,
    },
    summary: {
      unitsSold: Array.from(reportSalesByProduct.values()).reduce(
        (sum, row) => sum + row.unitsSold,
        0
      ),
      orderCount: reportDistinctOrderIds.size,
      revenue: money(productBreakdown.reduce((sum, row) => sum + row.revenue, 0)),
      estimatedSpend: money(
        productBreakdown.reduce((sum, row) => sum + row.estimatedSpend, 0)
      ),
      estimatedGrossProfit: money(
        productBreakdown.reduce((sum, row) => sum + row.estimatedGrossProfit, 0)
      ),
      itemsIn: Array.from(reportInvoiceQty.values()).reduce((sum, value) => sum + value, 0),
      itemsOut: Array.from(reportPurchaseNeeds.values()).reduce((sum, value) => sum + value, 0),
      invoiceCount: invoicesOnReportDate,
    },
    hourlySales: Array.from(hourlySalesMap.values()),
    hourlyProducts: hourlyProductRows,
    productBreakdown,
    itemMovement: {
      note:
        "Items in are ingredient-only invoice quantities on the selected day after canonical name mapping. Items out are recipe-derived purchase quantities needed to support that day's sales, rounded up to whole orderable units.",
      rows: itemMovementRows,
    },
    invoiceActivity: {
      invoiceCount: invoicesOnReportDate,
      totalItemsIn: Array.from(reportRawInvoiceQty.values()).reduce(
        (sum, value) => sum + value,
        0
      ),
      totalSpend: money(
        Array.from(reportRawInvoiceSpend.values()).reduce((sum, value) => sum + value, 0)
      ),
      rows: reportInvoiceItemRows.slice(0, 10),
    },
    optimizationAnalysis: {
      note:
        "Overordering and underordering are estimated from an ingredient-only movement ledger. Invoice items are first normalized into canonical ingredient names and packaging or finished goods are excluded. The model starts with zero tracked stock on the first observed day, then carries inventory forward using invoices in minus recipe-derived usage from sales. Potential savings come from avoidable purchases after considering carry-over stock already earned in the ledger. Estimated revenue at risk is a proportional heuristic: remaining shortage divided by total needed units, multiplied by that day's revenue.",
      lastWeek: lastWeekSummary,
      lastMonth: lastMonthSummary,
    },
    vendorPricing: {
      historyAvailable: vendorPricingRows.some((row) => row.hasInvoiceBaseline),
      note: vendorPricingRows.some((row) => row.hasInvoiceBaseline)
        ? "Current primary vendor pricing is compared against the average price seen in saved invoices for the same item."
        : "No invoice price history is available yet. Current primary vendor pricing is shown as a baseline only.",
      rows: vendorPricingRows,
    },
  });
}
