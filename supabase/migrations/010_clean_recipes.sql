-- ─────────────────────────────────────────────────────────────────────────────
-- 010_clean_recipes.sql
-- Wipe all existing recipes (seeded by migration 003) and replace with only
-- the two tracked ingredients: Matcha Powder and Vanilla Syrup.
-- ─────────────────────────────────────────────────────────────────────────────

TRUNCATE TABLE recipes RESTART IDENTITY CASCADE;

-- Matcha Powder: 5g per drink
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Soosoo Matcha',       'Matcha Powder', 5, 'g'),
  ('Banana Matcha',       'Matcha Powder', 5, 'g'),
  ('Matcha Latte',        'Matcha Powder', 5, 'g'),
  ('Banana Matcha Cloud', 'Matcha Powder', 5, 'g'),
  ('Strawberry Matcha',   'Matcha Powder', 5, 'g');

-- Vanilla Syrup: 25g per drink
INSERT INTO recipes (product_type, ingredient_name, quantity_per_unit, unit) VALUES
  ('Vanilla Bean Latte', 'Vanilla Syrup', 25, 'g'),
  ('Chocolate Milk',     'Vanilla Syrup', 25, 'g'),
  ('Hot Chocolate',      'Vanilla Syrup', 25, 'g');
