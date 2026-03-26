-- ─────────────────────────────────────────────────────────────────────────────
-- 003_predictive_ordering.sql
-- Tables and seed data for the predictive ordering ML system.
-- Run in the Supabase SQL editor or via `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Sales history (seeded from Kaggle Maven Roasters CSV) ────────────────────
CREATE TABLE IF NOT EXISTS sales_history (
  id                 SERIAL PRIMARY KEY,
  transaction_id     INTEGER,
  transaction_date   DATE        NOT NULL,
  transaction_time   TIME        NOT NULL,
  transaction_qty    INTEGER     NOT NULL,
  store_id           INTEGER,
  store_location     TEXT,
  product_id         INTEGER,
  unit_price         DECIMAL(10,2),
  product_category   TEXT,
  product_type       TEXT,
  product_detail     TEXT
);

CREATE INDEX IF NOT EXISTS sales_history_date_idx          ON sales_history (transaction_date);
CREATE INDEX IF NOT EXISTS sales_history_product_type_idx  ON sales_history (product_type);

-- ── Master ingredient list with current stock ────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL UNIQUE,
  current_stock     DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit              TEXT        NOT NULL,   -- g, ml, pcs (raw measurement unit)
  reorder_threshold DECIMAL(10,2),
  purchase_unit     TEXT        NOT NULL DEFAULT 'unit',  -- carton, bag, tray, box, etc.
  purchase_unit_size DECIMAL(10,3) NOT NULL DEFAULT 1,   -- how many raw units per purchase unit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Recipe mapping: product_type → ingredient breakdown ──────────────────────
-- product_type matches sales_history.product_type exactly.
-- quantity_per_unit = ingredient needed per 1 item sold.
CREATE TABLE IF NOT EXISTS recipes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type      TEXT        NOT NULL,
  ingredient_name   TEXT        NOT NULL REFERENCES ingredients (name) ON UPDATE CASCADE,
  quantity_per_unit DECIMAL(10,3) NOT NULL,
  unit              TEXT        NOT NULL,
  UNIQUE (product_type, ingredient_name)
);

CREATE INDEX IF NOT EXISTS recipes_product_type_idx ON recipes (product_type);

-- ── ML output: predicted demand + recommended orders ─────────────────────────
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_name     TEXT        NOT NULL,
  forecast_date       DATE        NOT NULL,
  predicted_demand    DECIMAL(10,2) NOT NULL,
  current_stock       DECIMAL(10,2),
  safety_stock        DECIMAL(10,2),
  recommended_order   DECIMAL(10,2),
  unit                TEXT        NOT NULL,
  confidence_score    DECIMAL(5,4),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ingredient_name, forecast_date)
);

CREATE INDEX IF NOT EXISTS demand_forecasts_date_idx ON demand_forecasts (forecast_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE sales_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_sales_history"    ON sales_history;
DROP POLICY IF EXISTS "anon_write_sales_history"   ON sales_history;
DROP POLICY IF EXISTS "anon_read_ingredients"      ON ingredients;
DROP POLICY IF EXISTS "anon_write_ingredients"     ON ingredients;
DROP POLICY IF EXISTS "anon_read_recipes"          ON recipes;
DROP POLICY IF EXISTS "anon_write_recipes"         ON recipes;
DROP POLICY IF EXISTS "anon_read_demand_forecasts" ON demand_forecasts;
DROP POLICY IF EXISTS "anon_write_demand_forecasts" ON demand_forecasts;

CREATE POLICY "anon_read_sales_history"
  ON sales_history FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_sales_history"
  ON sales_history FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_ingredients"
  ON ingredients FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_ingredients"
  ON ingredients FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_recipes"
  ON recipes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_recipes"
  ON recipes FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_demand_forecasts"
  ON demand_forecasts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_demand_forecasts"
  ON demand_forecasts FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: ingredients
-- Units: g (grams), ml (millilitres), pcs (pieces), kg (kilograms), L (litres)
-- current_stock and reorder_threshold reflect a busy coffee shop with ~1 week buffer.
-- ─────────────────────────────────────────────────────────────────────────────
-- name, current_stock, unit, reorder_threshold, purchase_unit, purchase_unit_size
INSERT INTO ingredients (name, current_stock, unit, reorder_threshold, purchase_unit, purchase_unit_size) VALUES
  -- Coffee & espresso
  ('Coffee Beans',       8000,  'g',   2000, 'bag',    1000),   -- 1 kg bag
  -- Dairy
  ('Whole Milk',         15000, 'ml',  4000, 'carton', 1000),   -- 1 L carton
  ('Heavy Cream',        3000,  'ml',  800,  'carton', 500),    -- 500 ml carton
  -- Sweeteners & syrups
  ('Granulated Sugar',   5000,  'g',   1000, 'bag',    1000),   -- 1 kg bag
  ('Caramel Syrup',      2000,  'ml',  500,  'bottle', 500),    -- 500 ml bottle
  ('Hazelnut Syrup',     1500,  'ml',  400,  'bottle', 500),    -- 500 ml bottle
  ('Vanilla Syrup',      2000,  'ml',  500,  'bottle', 500),    -- 500 ml bottle
  -- Chocolate
  ('Cocoa Powder',       2000,  'g',   500,  'bag',    500),    -- 500 g bag
  ('Chocolate Sauce',    1500,  'ml',  400,  'bottle', 500),    -- 500 ml bottle
  -- Tea
  ('Black Tea Bags',     300,   'pcs', 80,   'box',    100),    -- box of 100
  ('Green Tea Bags',     200,   'pcs', 60,   'box',    100),    -- box of 100
  ('Chai Tea Mix',       1500,  'g',   400,  'bag',    250),    -- 250 g bag
  ('Herbal Tea Bags',    150,   'pcs', 40,   'box',    50),     -- box of 50
  ('Rooibos Tea Bags',   150,   'pcs', 40,   'box',    50),     -- box of 50
  -- Baked goods
  ('All-Purpose Flour',  10000, 'g',   2500, 'bag',    1000),   -- 1 kg bag
  ('Unsalted Butter',    4000,  'g',   1000, 'block',  250),    -- 250 g block
  ('Free-Range Eggs',    120,   'pcs', 30,   'tray',   30),     -- tray of 30
  ('Baking Powder',      500,   'g',   100,  'tin',    100),    -- 100 g tin
  ('Oats',               3000,  'g',   800,  'bag',    500),    -- 500 g bag
  ('Ripe Bananas',       60,    'pcs', 15,   'bunch',  12),     -- bunch of 12
  ('Chocolate Chips',    2000,  'g',   500,  'bag',    500),    -- 500 g bag
  ('Cream Cheese',       1500,  'g',   400,  'pack',   250),    -- 250 g pack
  ('Almond Flour',       2000,  'g',   500,  'bag',    500),    -- 500 g bag
  -- Toppings
  ('Whipped Cream',      2000,  'ml',  500,  'can',    500),    -- 500 ml can
  ('Cinnamon',           300,   'g',   75,   'jar',    50)      -- 50 g jar
ON CONFLICT (name) DO NOTHING;

-- Update purchase unit info for existing rows (in case tables were created before these columns existed)
UPDATE ingredients SET purchase_unit = 'bag',    purchase_unit_size = 1000 WHERE name = 'Coffee Beans';
UPDATE ingredients SET purchase_unit = 'carton', purchase_unit_size = 1000 WHERE name = 'Whole Milk';
UPDATE ingredients SET purchase_unit = 'carton', purchase_unit_size = 500  WHERE name = 'Heavy Cream';
UPDATE ingredients SET purchase_unit = 'bag',    purchase_unit_size = 1000 WHERE name = 'Granulated Sugar';
UPDATE ingredients SET purchase_unit = 'bottle', purchase_unit_size = 500  WHERE name = 'Caramel Syrup';
UPDATE ingredients SET purchase_unit = 'bottle', purchase_unit_size = 500  WHERE name = 'Hazelnut Syrup';
UPDATE ingredients SET purchase_unit = 'bottle', purchase_unit_size = 500  WHERE name = 'Vanilla Syrup';
UPDATE ingredients SET purchase_unit = 'bag',    purchase_unit_size = 500  WHERE name = 'Cocoa Powder';
UPDATE ingredients SET purchase_unit = 'bottle', purchase_unit_size = 500  WHERE name = 'Chocolate Sauce';
UPDATE ingredients SET purchase_unit = 'box',    purchase_unit_size = 100  WHERE name = 'Black Tea Bags';
UPDATE ingredients SET purchase_unit = 'box',    purchase_unit_size = 100  WHERE name = 'Green Tea Bags';
UPDATE ingredients SET purchase_unit = 'bag',    purchase_unit_size = 250  WHERE name = 'Chai Tea Mix';
UPDATE ingredients SET purchase_unit = 'box',    purchase_unit_size = 50   WHERE name = 'Herbal Tea Bags';
UPDATE ingredients SET purchase_unit = 'box',    purchase_unit_size = 50   WHERE name = 'Rooibos Tea Bags';
UPDATE ingredients SET purchase_unit = 'bag',    purchase_unit_size = 1000 WHERE name = 'All-Purpose Flour';
UPDATE ingredients SET purchase_unit = 'block',  purchase_unit_size = 250  WHERE name = 'Unsalted Butter';
UPDATE ingredients SET purchase_unit = 'tray',   purchase_unit_size = 30   WHERE name = 'Free-Range Eggs';
UPDATE ingredients SET purchase_unit = 'tin',    purchase_unit_size = 100  WHERE name = 'Baking Powder';
UPDATE ingredients SET purchase_unit = 'bag',    purchase_unit_size = 500  WHERE name = 'Oats';
UPDATE ingredients SET purchase_unit = 'bunch',  purchase_unit_size = 12   WHERE name = 'Ripe Bananas';
UPDATE ingredients SET purchase_unit = 'bag',    purchase_unit_size = 500  WHERE name = 'Chocolate Chips';
UPDATE ingredients SET purchase_unit = 'pack',   purchase_unit_size = 250  WHERE name = 'Cream Cheese';
UPDATE ingredients SET purchase_unit = 'bag',    purchase_unit_size = 500  WHERE name = 'Almond Flour';
UPDATE ingredients SET purchase_unit = 'can',    purchase_unit_size = 500  WHERE name = 'Whipped Cream';
UPDATE ingredients SET purchase_unit = 'jar',    purchase_unit_size = 50   WHERE name = 'Cinnamon';

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: recipes
-- product_type values match Maven Roasters sales_history.product_type column.
-- Quantities represent a single serving / unit sold.
-- ─────────────────────────────────────────────────────────────────────────────

-- Barista Espresso (double shot milk-based drink — latte-style)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Barista Espresso', 'Coffee Beans',   18,   'g'),
  ('Barista Espresso', 'Whole Milk',     200,  'ml'),
  ('Barista Espresso', 'Granulated Sugar', 5,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Brewed Coffee (standard drip/filter)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Brewed Coffee', 'Coffee Beans',     15,  'g'),
  ('Brewed Coffee', 'Granulated Sugar',  3,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Gourmet Brewed Coffee (premium single-origin drip)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Gourmet Brewed Coffee', 'Coffee Beans',     18,  'g'),
  ('Gourmet Brewed Coffee', 'Granulated Sugar',  3,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Organic Brewed Coffee
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Organic Brewed Coffee', 'Coffee Beans',     16,  'g'),
  ('Organic Brewed Coffee', 'Granulated Sugar',  3,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Drip Coffee
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Drip Coffee', 'Coffee Beans',     14,  'g'),
  ('Drip Coffee', 'Granulated Sugar',  3,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Cold Brew (cold-brew concentrate uses more beans, ~2× steep)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Cold Brew', 'Coffee Beans',     30,  'g'),
  ('Cold Brew', 'Granulated Sugar',  5,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Brewed Black Tea
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Brewed Black Tea', 'Black Tea Bags',    1,  'pcs'),
  ('Brewed Black Tea', 'Granulated Sugar',  5,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Brewed Chai Tea (spiced tea latte)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Brewed Chai Tea', 'Chai Tea Mix',     20,  'g'),
  ('Brewed Chai Tea', 'Whole Milk',      150,  'ml'),
  ('Brewed Chai Tea', 'Granulated Sugar', 8,   'g'),
  ('Brewed Chai Tea', 'Cinnamon',         1,   'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Brewed Herbal Tea
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Brewed Herbal Tea', 'Herbal Tea Bags',   1,  'pcs'),
  ('Brewed Herbal Tea', 'Granulated Sugar',  3,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Brewed Green Tea
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Brewed Green Tea', 'Green Tea Bags',    1,  'pcs'),
  ('Brewed Green Tea', 'Granulated Sugar',  3,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Brewed Rooibos Tea
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Brewed Rooibos Tea', 'Rooibos Tea Bags',  1,  'pcs'),
  ('Brewed Rooibos Tea', 'Granulated Sugar',  3,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Hot Chocolate
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Hot Chocolate', 'Cocoa Powder',     20,  'g'),
  ('Hot Chocolate', 'Whole Milk',      250,  'ml'),
  ('Hot Chocolate', 'Granulated Sugar', 15,  'g'),
  ('Hot Chocolate', 'Whipped Cream',    30,  'ml'),
  ('Hot Chocolate', 'Chocolate Sauce',  15,  'ml')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Caramel Syrup (sold as add-on flavour shot)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Caramel Syrup', 'Caramel Syrup', 30, 'ml')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Hazelnut Syrup (add-on flavour shot)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Hazelnut Syrup', 'Hazelnut Syrup', 30, 'ml')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Pastry (generic croissant / danish)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Pastry', 'All-Purpose Flour', 80,  'g'),
  ('Pastry', 'Unsalted Butter',   40,  'g'),
  ('Pastry', 'Granulated Sugar',  10,  'g'),
  ('Pastry', 'Free-Range Eggs',    1,  'pcs'),
  ('Pastry', 'Baking Powder',      2,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Scone
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Scone', 'All-Purpose Flour', 100, 'g'),
  ('Scone', 'Unsalted Butter',    50, 'g'),
  ('Scone', 'Heavy Cream',        60, 'ml'),
  ('Scone', 'Granulated Sugar',   15, 'g'),
  ('Scone', 'Baking Powder',       4, 'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Oatmeal (hot oatmeal bowl)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Oatmeal', 'Oats',              80,  'g'),
  ('Oatmeal', 'Whole Milk',       200,  'ml'),
  ('Oatmeal', 'Granulated Sugar',  10,  'g'),
  ('Oatmeal', 'Cinnamon',           1,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Banana Bread (slice)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Banana Bread', 'All-Purpose Flour',  60,  'g'),
  ('Banana Bread', 'Ripe Bananas',        0.5, 'pcs'),
  ('Banana Bread', 'Unsalted Butter',    25,  'g'),
  ('Banana Bread', 'Granulated Sugar',   20,  'g'),
  ('Banana Bread', 'Free-Range Eggs',     0.5, 'pcs'),
  ('Banana Bread', 'Baking Powder',       2,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Packaged Chocolate (house-made chocolate bark / truffle)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Packaged Chocolate', 'Chocolate Chips', 40, 'g'),
  ('Packaged Chocolate', 'Cocoa Powder',     5, 'g'),
  ('Packaged Chocolate', 'Granulated Sugar', 8, 'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Latte (espresso + steamed milk)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Latte', 'Coffee Beans',     18,  'g'),
  ('Latte', 'Whole Milk',      240,  'ml'),
  ('Latte', 'Vanilla Syrup',    15,  'ml')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Cappuccino (espresso + equal milk foam)
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Cappuccino', 'Coffee Beans',   18,  'g'),
  ('Cappuccino', 'Whole Milk',    120,  'ml'),
  ('Cappuccino', 'Cinnamon',        0.5, 'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Mocha
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Mocha', 'Coffee Beans',     18,  'g'),
  ('Mocha', 'Whole Milk',      200,  'ml'),
  ('Mocha', 'Chocolate Sauce',  25,  'ml'),
  ('Mocha', 'Whipped Cream',    30,  'ml')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Iced Tea
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Iced Tea', 'Black Tea Bags',    2,  'pcs'),
  ('Iced Tea', 'Granulated Sugar',  8,  'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;
