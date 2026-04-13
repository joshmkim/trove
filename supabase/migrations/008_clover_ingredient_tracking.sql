-- ─────────────────────────────────────────────────────────────────────────────
-- 008_clover_ingredient_tracking.sql
-- Sets up Clover POS ingredient tracking for harucake.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Widen numeric columns on items to support decimal gram quantities
ALTER TABLE items
  ALTER COLUMN qty_in             TYPE DECIMAL(10,3) USING qty_in::DECIMAL(10,3),
  ALTER COLUMN qty_out            TYPE DECIMAL(10,3) USING qty_out::DECIMAL(10,3),
  ALTER COLUMN qty_balance        TYPE DECIMAL(10,3) USING qty_balance::DECIMAL(10,3),
  ALTER COLUMN quantity_remaining TYPE DECIMAL(10,3) USING quantity_remaining::DECIMAL(10,3);

-- Step 2: Idempotency table — prevents double-deducting the same Clover order
CREATE TABLE IF NOT EXISTS clover_processed_orders (
  clover_order_id  TEXT        PRIMARY KEY,
  merchant_id      TEXT        NOT NULL,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  line_item_count  INTEGER     NOT NULL DEFAULT 0
);

-- Step 3: Sync state — tracks last successful sync time to avoid re-fetching old orders
CREATE TABLE IF NOT EXISTS clover_sync_state (
  id              INTEGER     PRIMARY KEY DEFAULT 1,  -- single-row table
  last_synced_at  TIMESTAMPTZ
);

-- Seed the single row (if not already present)
INSERT INTO clover_sync_state (id, last_synced_at)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Seed harucake ingredients into items
INSERT INTO items (
  product_name, quantity_remaining, stock_level,
  qty_in, qty_out, qty_balance,
  unit, purchase_unit, purchase_unit_size, reorder_threshold
) VALUES
  -- Vanilla syrup: 4 bottles per box, 750g per bottle = 3000g per box
  ('Vanilla Syrup', 0, 'low', 0, 0, 0, 'g', 'box',  3000, 500),
  -- Matcha powder: 1 bag, 1000g
  ('Matcha Powder', 0, 'low', 0, 0, 0, 'g', 'bag',  1000, 200)
ON CONFLICT (product_name) DO UPDATE SET
  unit               = EXCLUDED.unit,
  purchase_unit      = EXCLUDED.purchase_unit,
  purchase_unit_size = EXCLUDED.purchase_unit_size,
  reorder_threshold  = EXCLUDED.reorder_threshold;

-- Step 5: Seed recipes — only harucake-specific mappings, nothing else
-- Vanilla Syrup: 25g per drink
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Vanilla Latte (hot)',      'Vanilla Syrup', 25, 'g'),
  ('Vanilla Latte (ice)',      'Vanilla Syrup', 25, 'g'),
  ('Chocolate Milk (ice)',     'Vanilla Syrup', 25, 'g'),
  ('Hot Chocolate Milk (Hot)', 'Vanilla Syrup', 25, 'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Matcha Powder: 5g per drink
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('SooSoo Matcha Latte (ice)',  'Matcha Powder', 5, 'g'),
  ('Banana Matcha (ice)',        'Matcha Powder', 5, 'g'),
  ('Banana Matcha (Hot)',        'Matcha Powder', 5, 'g'),
  ('Matcha Latte (ice)',         'Matcha Powder', 5, 'g'),
  ('Matcha Latte (Hot)',         'Matcha Powder', 5, 'g'),
  ('Banana Matcha Cloud (Ice)',  'Matcha Powder', 5, 'g'),
  ('Strawberry Matcha (ice)',    'Matcha Powder', 5, 'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;
