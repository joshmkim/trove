-- ─────────────────────────────────────────────────────────────────────────────
-- 006_consolidate_items_ingredients.sql
-- Merges the `ingredients` table into `items` so there is a single source
-- of truth for inventory. The Inventory UI, the ML pipeline, and the
-- ordering flow all read/write `items` after this migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Add ML-specific columns to items
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS unit               TEXT           NOT NULL DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS purchase_unit      TEXT           NOT NULL DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS purchase_unit_size DECIMAL(10,3)  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reorder_threshold  DECIMAL(10,2);

-- Step 2: Unique constraint on product_name (needed for recipes FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_product_name_unique'
  ) THEN
    ALTER TABLE items ADD CONSTRAINT items_product_name_unique UNIQUE (product_name);
  END IF;
END$$;

-- Step 3: Drop the FK on recipes (ingredient_name is now plain text matching items.product_name)
-- ingredients table was already dropped in a prior partial run
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_ingredient_name_fkey;
