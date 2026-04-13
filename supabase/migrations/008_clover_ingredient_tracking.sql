-- ─────────────────────────────────────────────────────────────────────────────
-- 008_clover_ingredient_tracking.sql
-- Sets up Clover POS ingredient tracking for harucake.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Widen numeric columns on items to support decimal gram quantities
ALTER TABLE items
  ALTER COLUMN qty_in             TYPE DECIMAL(10,3) USING COALESCE(qty_in, 0)::DECIMAL(10,3),
  ALTER COLUMN qty_out            TYPE DECIMAL(10,3) USING COALESCE(qty_out, 0)::DECIMAL(10,3),
  ALTER COLUMN qty_balance        TYPE DECIMAL(10,3) USING COALESCE(qty_balance, 0)::DECIMAL(10,3),
  ALTER COLUMN quantity_remaining TYPE DECIMAL(10,3) USING COALESCE(quantity_remaining, 0)::DECIMAL(10,3);

-- Zero out any existing nulls
UPDATE items SET
  qty_in             = COALESCE(qty_in, 0),
  qty_out            = COALESCE(qty_out, 0),
  qty_balance        = COALESCE(qty_balance, 0),
  quantity_remaining = COALESCE(quantity_remaining, 0);

-- Step 2: Idempotency table — prevents double-deducting the same Clover order
CREATE TABLE IF NOT EXISTS clover_processed_orders (
  clover_order_id  TEXT        PRIMARY KEY,
  merchant_id      TEXT        NOT NULL,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  line_item_count  INTEGER     NOT NULL DEFAULT 0,
  order_created_at TIMESTAMPTZ,
  line_items       JSONB,
  deducted         JSONB
);

CREATE INDEX IF NOT EXISTS clover_processed_orders_created_idx
  ON clover_processed_orders (order_created_at DESC);

-- Step 3: Sync state — single-row table tracking last successful sync time
CREATE TABLE IF NOT EXISTS clover_sync_state (
  id             INTEGER     PRIMARY KEY DEFAULT 1,
  last_synced_at TIMESTAMPTZ
);

INSERT INTO clover_sync_state (id, last_synced_at)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Seed tracked ingredients
INSERT INTO items (
  product_name, quantity_remaining, stock_level,
  qty_in, qty_out, qty_balance,
  unit, purchase_unit, purchase_unit_size, reorder_threshold
) VALUES
  -- 4 bottles × 750g per box = 3000g
  ('Vanilla Syrup', 1000, 'high', 1000, 0, 1000, 'g', 'box', 3000, 500),
  -- 1 bag = 1000g
  ('Matcha Powder',  1000, 'high', 1000, 0, 1000, 'g', 'bag', 1000, 200)
ON CONFLICT (product_name) DO UPDATE SET
  unit               = EXCLUDED.unit,
  purchase_unit      = EXCLUDED.purchase_unit,
  purchase_unit_size = EXCLUDED.purchase_unit_size,
  reorder_threshold  = EXCLUDED.reorder_threshold;

-- Step 5: Seed recipes using exact Clover item names
-- Vanilla Syrup: 25g per drink
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Vanilla Bean Latte', 'Vanilla Syrup', 25, 'g'),
  ('Chocolate Milk',     'Vanilla Syrup', 25, 'g'),
  ('Hot Chocolate',      'Vanilla Syrup', 25, 'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Matcha Powder: 5g per drink
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Soosoo Matcha',       'Matcha Powder', 5, 'g'),
  ('Banana Matcha',       'Matcha Powder', 5, 'g'),
  ('Matcha Latte',        'Matcha Powder', 5, 'g'),
  ('Banana Matcha Cloud', 'Matcha Powder', 5, 'g'),
  ('Strawberry Matcha',   'Matcha Powder', 5, 'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;
