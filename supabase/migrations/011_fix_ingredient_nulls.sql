-- ─────────────────────────────────────────────────────────────────────────────
-- 011_fix_ingredient_nulls.sql
-- Ensures Vanilla Syrup and Matcha Powder have valid non-null column values.
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- Widen numeric columns (idempotent — safe if already DECIMAL)
ALTER TABLE items
  ALTER COLUMN qty_in             TYPE DECIMAL(10,3) USING COALESCE(qty_in, 0)::DECIMAL(10,3),
  ALTER COLUMN qty_out            TYPE DECIMAL(10,3) USING COALESCE(qty_out, 0)::DECIMAL(10,3),
  ALTER COLUMN qty_balance        TYPE DECIMAL(10,3) USING COALESCE(qty_balance, 0)::DECIMAL(10,3),
  ALTER COLUMN quantity_remaining TYPE DECIMAL(10,3) USING COALESCE(quantity_remaining, 0)::DECIMAL(10,3);

-- Zero out any null values across the whole table first
UPDATE items SET
  qty_in             = COALESCE(qty_in, 0),
  qty_out            = COALESCE(qty_out, 0),
  qty_balance        = COALESCE(qty_balance, 0),
  quantity_remaining = COALESCE(quantity_remaining, 0);

-- Upsert the two tracked ingredients with correct starting values
INSERT INTO items (
  product_name, quantity_remaining, stock_level,
  qty_in, qty_out, qty_balance,
  unit, purchase_unit, purchase_unit_size, reorder_threshold
) VALUES
  ('Vanilla Syrup', 1000, 'high', 1000, 0, 1000, 'g', 'box', 3000, 500),
  ('Matcha Powder',  1000, 'high', 1000, 0, 1000, 'g', 'bag', 1000, 200)
ON CONFLICT (product_name) DO UPDATE SET
  qty_in             = 1000,
  qty_out            = 0,
  qty_balance        = 1000,
  quantity_remaining = 1000,
  stock_level        = 'high',
  unit               = EXCLUDED.unit,
  purchase_unit      = EXCLUDED.purchase_unit,
  purchase_unit_size = EXCLUDED.purchase_unit_size,
  reorder_threshold  = EXCLUDED.reorder_threshold;

-- Clear processed orders so everything can be re-synced cleanly
TRUNCATE TABLE clover_processed_orders;
