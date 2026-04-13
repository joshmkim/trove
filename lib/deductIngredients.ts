import { SupabaseClient } from "@supabase/supabase-js";
import type { CloverLineItem } from "@/lib/clover";

export interface DeductionResult {
  orderId: string;
  /** Clover item names that had no matching recipe — skipped gracefully */
  skipped: string[];
  /** Ingredients successfully deducted */
  deducted: Array<{ ingredient: string; amount: number; unit: string }>;
  /** Ingredients that dropped below their reorder threshold */
  lowStockAlerts: string[];
}

interface RecipeRow {
  product_type: string;
  ingredient_name: string;
  quantity_per_unit: number;
  unit: string;
}

interface ItemSnapshot {
  id: string;
  product_name: string;
  qty_out: number;
  qty_balance: number;
  quantity_remaining: number;
  reorder_threshold: number | null;
  stock_level: string;
}

const FALLBACK_THRESHOLD = 10;

/**
 * Deducts ingredient quantities for a single Clover order.
 * Uses two batch queries (recipes + items) before writing — no N+1.
 */
export async function deductIngredients(
  orderId: string,
  lineItems: CloverLineItem[],
  supabase: SupabaseClient
): Promise<DeductionResult> {
  const result: DeductionResult = {
    orderId,
    skipped: [],
    deducted: [],
    lowStockAlerts: [],
  };

  if (lineItems.length === 0) return result;

  // 1. Batch-fetch all recipes for these product names
  const lineItemNames = [...new Set(lineItems.map((li) => li.name))];
  const { data: recipeRows, error: recipeError } = await supabase
    .from("recipes")
    .select("product_type, ingredient_name, quantity_per_unit, unit")
    .in("product_type", lineItemNames);

  if (recipeError) throw new Error(`recipes fetch failed: ${recipeError.message}`);

  // Group recipes by product_type for easy lookup
  const recipeMap = new Map<string, RecipeRow[]>();
  for (const row of (recipeRows ?? []) as RecipeRow[]) {
    const existing = recipeMap.get(row.product_type) ?? [];
    existing.push(row);
    recipeMap.set(row.product_type, existing);
  }

  // 2. Aggregate total ingredient usage across all line items
  const usageMap = new Map<string, { amount: number; unit: string }>();

  for (const lineItem of lineItems) {
    const recipes = recipeMap.get(lineItem.name);
    if (!recipes || recipes.length === 0) {
      result.skipped.push(lineItem.name);
      continue;
    }
    for (const recipe of recipes) {
      // Clover line items don't have a quantity field — each unit is a separate entry
      const qty = lineItem.quantity ?? 1;
      const usage = recipe.quantity_per_unit * qty;
      const existing = usageMap.get(recipe.ingredient_name);
      if (existing) {
        existing.amount += usage;
      } else {
        usageMap.set(recipe.ingredient_name, { amount: usage, unit: recipe.unit });
      }
    }
  }

  if (usageMap.size === 0) return result;

  // 3. Batch-fetch current item snapshots
  const ingredientNames = [...usageMap.keys()];
  const { data: itemRows, error: itemError } = await supabase
    .from("items")
    .select("id, product_name, qty_out, qty_balance, quantity_remaining, reorder_threshold, stock_level")
    .in("product_name", ingredientNames);

  if (itemError) throw new Error(`items fetch failed: ${itemError.message}`);

  const itemMap = new Map<string, ItemSnapshot>();
  for (const row of (itemRows ?? []) as ItemSnapshot[]) {
    itemMap.set(row.product_name, row);
  }

  // 4. Write updates sequentially — one per ingredient
  for (const [ingredientName, usage] of usageMap) {
    const item = itemMap.get(ingredientName);
    if (!item) {
      console.warn(`[deductIngredients] No item found for ingredient "${ingredientName}" — skipping`);
      result.skipped.push(ingredientName);
      continue;
    }

    const newQtyOut       = (item.qty_out ?? 0) + usage.amount;
    const newQtyBalance   = Math.max(0, (item.qty_balance ?? 0) - usage.amount);
    const newQtyRemaining = Math.max(0, (item.quantity_remaining ?? 0) - usage.amount);
    const threshold       = item.reorder_threshold ?? FALLBACK_THRESHOLD;
    const newStockLevel   = newQtyRemaining < threshold ? "low" : "high";

    const { error: updateError } = await supabase
      .from("items")
      .update({
        qty_out:            newQtyOut,
        qty_balance:        newQtyBalance,
        quantity_remaining: newQtyRemaining,
        stock_level:        newStockLevel,
        updated_at:         new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) {
      throw new Error(`items update failed for "${ingredientName}": ${updateError.message}`);
    }

    result.deducted.push({ ingredient: ingredientName, amount: usage.amount, unit: usage.unit });

    if (newStockLevel === "low" && item.stock_level !== "low") {
      result.lowStockAlerts.push(ingredientName);
    }
  }

  return result;
}
