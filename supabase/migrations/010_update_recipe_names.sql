-- ─────────────────────────────────────────────────────────────────────────────
-- 010_update_recipe_names.sql
-- Updates recipe product_type names to match actual Clover item names.
-- Hot/ice variants that share the same Clover item are consolidated into one row.
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove old recipe rows seeded with the original names
DELETE FROM recipes WHERE product_type IN (
  'Vanilla Latte (hot)',
  'Vanilla Latte (ice)',
  'Chocolate Milk (ice)',
  'Hot Chocolate Milk (Hot)',
  'SooSoo Matcha Latte (ice)',
  'Banana Matcha (ice)',
  'Banana Matcha (Hot)',
  'Matcha Latte (ice)',
  'Matcha Latte (Hot)',
  'Banana Matcha Cloud (Ice)',
  'Strawberry Matcha (ice)'
);

-- Vanilla Syrup: 25g per drink
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Vanilla Bean Latte', 'Vanilla Syrup', 25, 'g'),
  ('Chocolate Milk',     'Vanilla Syrup', 25, 'g'),
  ('Hot Chocolate',      'Vanilla Syrup', 25, 'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;

-- Matcha Powder: 5g per drink
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Soosoo Matcha',      'Matcha Powder', 5, 'g'),
  ('Banana Matcha',      'Matcha Powder', 5, 'g'),
  ('Matcha Latte',       'Matcha Powder', 5, 'g'),
  ('Banana Matcha Cloud','Matcha Powder', 5, 'g'),
  ('Strawberry Matcha',  'Matcha Powder', 5, 'g')
ON CONFLICT (product_type, ingredient_name) DO NOTHING;
