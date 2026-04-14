-- ─────────────────────────────────────────────────────────────────────────────
-- 011_seed_demo_vendors.sql
-- Adds real-ish demo vendors for Vanilla Syrup and Matcha Powder so that
-- the Create Order flow works end to end.
-- Safe to run multiple times (ON CONFLICT DO UPDATE).
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove any auto-generated dummy vendors tied to these two items
DELETE FROM vendors
WHERE seed_item_id IN (
  SELECT id FROM items WHERE product_name IN ('Vanilla Syrup', 'Matcha Powder')
);

-- Insert demo vendors
INSERT INTO vendors (
  id,
  name,
  vendor_status,
  contact_method,
  contact_value,
  reliability_score,
  lead_time_days,
  response_time_hours,
  advance_order_days,
  onboarded_at
) VALUES
  (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'Monin Syrup Co.',
    'my_vendor',
    'phone',
    '+1 (800) 966-5225',
    95,
    3,
    4,
    2,
    now()
  ),
  (
    'aaaaaaaa-0001-0001-0001-000000000002',
    'Aiya Matcha',
    'my_vendor',
    'email',
    'orders@aiya-america.com',
    93,
    5,
    24,
    3,
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  name                = EXCLUDED.name,
  vendor_status       = EXCLUDED.vendor_status,
  contact_method      = EXCLUDED.contact_method,
  contact_value       = EXCLUDED.contact_value,
  reliability_score   = EXCLUDED.reliability_score,
  lead_time_days      = EXCLUDED.lead_time_days,
  response_time_hours = EXCLUDED.response_time_hours,
  advance_order_days  = EXCLUDED.advance_order_days,
  onboarded_at        = EXCLUDED.onboarded_at;

-- Link vendors → items via vendor_products
INSERT INTO vendor_products (
  vendor_id,
  item_id,
  price_per_unit,
  unit,
  is_primary,
  order_cadence,
  next_order_date,
  preferred_order_weekday
)
SELECT
  'aaaaaaaa-0001-0001-0001-000000000001',
  i.id,
  18.50,       -- price per box
  'box',
  true,
  'weekly',
  CURRENT_DATE + 3,
  1            -- Monday
FROM items i
WHERE i.product_name = 'Vanilla Syrup'
ON CONFLICT (vendor_id, item_id) DO UPDATE SET
  price_per_unit  = EXCLUDED.price_per_unit,
  unit            = EXCLUDED.unit,
  is_primary      = EXCLUDED.is_primary,
  order_cadence   = EXCLUDED.order_cadence,
  next_order_date = EXCLUDED.next_order_date;

INSERT INTO vendor_products (
  vendor_id,
  item_id,
  price_per_unit,
  unit,
  is_primary,
  order_cadence,
  next_order_date,
  preferred_order_weekday
)
SELECT
  'aaaaaaaa-0001-0001-0001-000000000002',
  i.id,
  32.00,       -- price per bag
  'bag',
  true,
  'biweekly',
  CURRENT_DATE + 5,
  2            -- Tuesday
FROM items i
WHERE i.product_name = 'Matcha Powder'
ON CONFLICT (vendor_id, item_id) DO UPDATE SET
  price_per_unit  = EXCLUDED.price_per_unit,
  unit            = EXCLUDED.unit,
  is_primary      = EXCLUDED.is_primary,
  order_cadence   = EXCLUDED.order_cadence,
  next_order_date = EXCLUDED.next_order_date;
