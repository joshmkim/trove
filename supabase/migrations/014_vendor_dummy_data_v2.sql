-- ─────────────────────────────────────────────────────────────────────────────
-- 014_vendor_dummy_data_v2.sql
-- Refreshes demo vendors: short real-style names (<12 chars), 1–4 products with
-- 20/30/30/20% split, ~50% urgent (<4 days to order) vs calm Order-by dates.
-- Safe pattern: delete vendor_products then vendors, then re-insert.
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM vendor_products;
DELETE FROM vendors;

-- ── my_vendor: 20 rows — product mix 4+6+6+4; half urgent (next in 0–3d), half calm (≥5d)
INSERT INTO vendors (
  id,
  name,
  seed_item_id,
  vendor_status,
  contact_method,
  contact_value,
  reliability_score,
  lead_time_days,
  response_time_hours,
  advance_order_days,
  onboarded_at
) VALUES
  ('b1111111-1111-1111-1111-111111111101', 'Sysco', NULL, 'my_vendor', 'phone', '+18005551001', 90, 2, 6, 2, now()),
  ('b1111111-1111-1111-1111-111111111102', 'US Foods', NULL, 'my_vendor', 'email', 'orders@usfoods.com', 88, 3, 8, 3, now()),
  ('b1111111-1111-1111-1111-111111111103', 'ChefStore', NULL, 'my_vendor', 'website', 'https://chefstore.com', 85, 2, 12, 4, now()),
  ('b1111111-1111-1111-1111-111111111104', 'Gordon Food', NULL, 'my_vendor', 'phone', '+18005551004', 87, 4, 10, 3, now()),
  ('b1111111-1111-1111-1111-111111111105', 'Reinhart', NULL, 'my_vendor', 'email', 'buy@reinhartfoodservice.com', 86, 3, 9, 3, now()),
  ('b1111111-1111-1111-1111-111111111106', 'McLane', NULL, 'my_vendor', 'phone', '+18005551006', 89, 2, 5, 2, now()),
  ('b1111111-1111-1111-1111-111111111107', 'Shamrock', NULL, 'my_vendor', 'email', 'orders@shamrockfoods.com', 84, 3, 11, 4, now()),
  ('b1111111-1111-1111-1111-111111111108', 'KeHE', NULL, 'my_vendor', 'website', 'https://kehe.com', 83, 4, 14, 5, now()),
  ('b1111111-1111-1111-1111-111111111109', 'UNFI', NULL, 'my_vendor', 'phone', '+18005551009', 91, 2, 7, 3, now()),
  ('b1111111-1111-1111-1111-111111111110', 'PFG', NULL, 'my_vendor', 'email', 'orders@pfgc.com', 88, 3, 8, 3, now()),
  ('b1111111-1111-1111-1111-111111111111', 'Vistar', NULL, 'my_vendor', 'phone', '+18005551011', 87, 4, 9, 4, now()),
  ('b1111111-1111-1111-1111-111111111112', 'Lipari', NULL, 'my_vendor', 'email', 'sales@lipari.com', 85, 3, 10, 3, now()),
  ('b1111111-1111-1111-1111-111111111113', 'Roma Foods', NULL, 'my_vendor', 'website', 'https://romafoods.com', 86, 2, 8, 3, now()),
  ('b1111111-1111-1111-1111-111111111114', 'Dot Foods', NULL, 'my_vendor', 'phone', '+18005551014', 90, 3, 6, 2, now()),
  ('b1111111-1111-1111-1111-111111111115', 'Roth', NULL, 'my_vendor', 'email', 'orders@roth.com', 84, 4, 12, 4, now()),
  ('b1111111-1111-1111-1111-111111111116', 'DPI', NULL, 'my_vendor', 'phone', '+18005551016', 88, 2, 7, 3, now()),
  ('b1111111-1111-1111-1111-111111111117', 'Merchants', NULL, 'my_vendor', 'email', 'hello@merchantsgrocery.com', 85, 3, 9, 3, now()),
  ('b1111111-1111-1111-1111-111111111118', 'Core-Mark', NULL, 'my_vendor', 'website', 'https://core-mark.com', 87, 4, 10, 4, now()),
  ('b1111111-1111-1111-1111-111111111119', 'Ben E Keith', NULL, 'my_vendor', 'phone', '+18005551019', 89, 3, 8, 3, now()),
  ('b1111111-1111-1111-1111-111111111120', 'Harbor Food', NULL, 'my_vendor', 'email', 'orders@harborfood.com', 86, 2, 6, 2, now());

-- Urgent next_order offsets (days from today): mostly 1–3, one same-day
-- b101..b110: +1,+2,+3,+1,+2,+3,+0,+1,+2,+3
-- Calm b111..b120: +5,+8,+6,+7,+9,+10,+11,+12,+14,+16

INSERT INTO vendor_products (vendor_id, item_id, price_per_unit, unit, is_primary, order_cadence, cadence_days, next_order_date, preferred_order_weekday)
SELECT
  p.vid,
  i.id,
  p.price,
  COALESCE(NULLIF(i.purchase_unit, ''), i.unit),
  p.isp,
  p.cad,
  p.cdays,
  CURRENT_DATE + p.doff,
  EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT
FROM (VALUES
  ('b1111111-1111-1111-1111-111111111101'::UUID, 'All-Purpose Flour', 1.15::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 1),
  ('b1111111-1111-1111-1111-111111111102'::UUID, 'Unsalted Butter',   3.20::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 2),
  ('b1111111-1111-1111-1111-111111111103'::UUID, 'All-Purpose Flour', 1.12::DECIMAL(10,4), true,  'daily',    NULL::INTEGER, 3),
  ('b1111111-1111-1111-1111-111111111103'::UUID, 'Baking Powder',     0.95::DECIMAL(10,4), false, 'daily',    NULL::INTEGER, 3),
  ('b1111111-1111-1111-1111-111111111104'::UUID, 'Heavy Cream',       4.50::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 1),
  ('b1111111-1111-1111-1111-111111111104'::UUID, 'Granulated Sugar',  1.05::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 1),
  ('b1111111-1111-1111-1111-111111111105'::UUID, 'Cocoa Powder',     12.40::DECIMAL(10,4), true,  'biweekly', NULL::INTEGER, 2),
  ('b1111111-1111-1111-1111-111111111105'::UUID, 'Vanilla Extract',  38.00::DECIMAL(10,4), false, 'biweekly', NULL::INTEGER, 2),
  ('b1111111-1111-1111-1111-111111111106'::UUID, 'Free-Range Eggs',   0.26::DECIMAL(10,4), true,  'daily',    NULL::INTEGER, 3),
  ('b1111111-1111-1111-1111-111111111106'::UUID, 'Unsalted Butter',   3.18::DECIMAL(10,4), false, 'daily',    NULL::INTEGER, 3),
  ('b1111111-1111-1111-1111-111111111106'::UUID, 'Heavy Cream',       4.48::DECIMAL(10,4), false, 'daily',    NULL::INTEGER, 3),
  ('b1111111-1111-1111-1111-111111111107'::UUID, 'Vanilla Syrup',    17.25::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 0),
  ('b1111111-1111-1111-1111-111111111107'::UUID, 'Matcha Powder',    31.50::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 0),
  ('b1111111-1111-1111-1111-111111111107'::UUID, 'Granulated Sugar',  1.02::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 0),
  ('b1111111-1111-1111-1111-111111111108'::UUID, 'Baking Powder',     0.93::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 1),
  ('b1111111-1111-1111-1111-111111111108'::UUID, 'Cocoa Powder',     12.20::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 1),
  ('b1111111-1111-1111-1111-111111111108'::UUID, 'All-Purpose Flour', 1.10::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 1),
  ('b1111111-1111-1111-1111-111111111109'::UUID, 'Vanilla Syrup',    17.40::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 2),
  ('b1111111-1111-1111-1111-111111111109'::UUID, 'Matcha Powder',    31.80::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 2),
  ('b1111111-1111-1111-1111-111111111109'::UUID, 'Vanilla Extract',  37.50::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 2),
  ('b1111111-1111-1111-1111-111111111109'::UUID, 'Heavy Cream',       4.55::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 2),
  ('b1111111-1111-1111-1111-111111111110'::UUID, 'Granulated Sugar',  1.08::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 3),
  ('b1111111-1111-1111-1111-111111111110'::UUID, 'Free-Range Eggs',   0.24::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 3),
  ('b1111111-1111-1111-1111-111111111110'::UUID, 'Unsalted Butter',   3.25::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 3),
  ('b1111111-1111-1111-1111-111111111110'::UUID, 'Cocoa Powder',     12.60::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 3),
  ('b1111111-1111-1111-1111-111111111111'::UUID, 'All-Purpose Flour', 1.14::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 5),
  ('b1111111-1111-1111-1111-111111111112'::UUID, 'Unsalted Butter',   3.22::DECIMAL(10,4), true,  'biweekly', NULL::INTEGER, 8),
  ('b1111111-1111-1111-1111-111111111113'::UUID, 'Heavy Cream',       4.52::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 6),
  ('b1111111-1111-1111-1111-111111111113'::UUID, 'Granulated Sugar',  1.06::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 6),
  ('b1111111-1111-1111-1111-111111111114'::UUID, 'Cocoa Powder',     12.30::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 7),
  ('b1111111-1111-1111-1111-111111111114'::UUID, 'Baking Powder',     0.94::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 7),
  ('b1111111-1111-1111-1111-111111111115'::UUID, 'Vanilla Extract',  38.20::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 9),
  ('b1111111-1111-1111-1111-111111111115'::UUID, 'Cocoa Powder',     12.35::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 9),
  ('b1111111-1111-1111-1111-111111111116'::UUID, 'Free-Range Eggs',   0.25::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 10),
  ('b1111111-1111-1111-1111-111111111116'::UUID, 'Matcha Powder',    32.00::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 10),
  ('b1111111-1111-1111-1111-111111111116'::UUID, 'Vanilla Syrup',    17.00::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 10),
  ('b1111111-1111-1111-1111-111111111117'::UUID, 'Vanilla Syrup',    17.10::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 11),
  ('b1111111-1111-1111-1111-111111111117'::UUID, 'All-Purpose Flour', 1.13::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 11),
  ('b1111111-1111-1111-1111-111111111117'::UUID, 'Unsalted Butter',   3.15::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 11),
  ('b1111111-1111-1111-1111-111111111118'::UUID, 'Matcha Powder',    31.90::DECIMAL(10,4), true,  'biweekly', NULL::INTEGER, 12),
  ('b1111111-1111-1111-1111-111111111118'::UUID, 'Heavy Cream',       4.40::DECIMAL(10,4), false, 'biweekly', NULL::INTEGER, 12),
  ('b1111111-1111-1111-1111-111111111118'::UUID, 'Granulated Sugar',  1.04::DECIMAL(10,4), false, 'biweekly', NULL::INTEGER, 12),
  ('b1111111-1111-1111-1111-111111111119'::UUID, 'Vanilla Syrup',    17.30::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 14),
  ('b1111111-1111-1111-1111-111111111119'::UUID, 'Matcha Powder',    31.70::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 14),
  ('b1111111-1111-1111-1111-111111111119'::UUID, 'Cocoa Powder',     12.50::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 14),
  ('b1111111-1111-1111-1111-111111111119'::UUID, 'Free-Range Eggs',   0.23::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 14),
  ('b1111111-1111-1111-1111-111111111120'::UUID, 'Baking Powder',     0.96::DECIMAL(10,4), true,  'weekly',   NULL::INTEGER, 16),
  ('b1111111-1111-1111-1111-111111111120'::UUID, 'Vanilla Extract',  37.80::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 16),
  ('b1111111-1111-1111-1111-111111111120'::UUID, 'All-Purpose Flour', 1.11::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 16),
  ('b1111111-1111-1111-1111-111111111120'::UUID, 'Heavy Cream',       4.42::DECIMAL(10,4), false, 'weekly',   NULL::INTEGER, 16)
) AS p(vid, pname, price, isp, cad, cdays, doff)
JOIN items i ON i.product_name = p.pname;

-- ── not_onboarded: 4 short-name candidates (reuse prior demo UUIDs for stability)
INSERT INTO vendors (
  id,
  name,
  seed_item_id,
  vendor_status,
  contact_method,
  contact_value,
  reliability_score,
  lead_time_days,
  response_time_hours,
  advance_order_days,
  onboarded_at
) VALUES
  ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9001', 'North Mill', NULL, 'not_onboarded', 'email', 'sales@northmill.example', 84, 4, 10, 5, NULL),
  ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9002', 'Dawn Dairy', NULL, 'not_onboarded', 'phone', '+17185550122', 88, 2, 6, 3, NULL),
  ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9003', 'Cacao Rt', NULL, 'not_onboarded', 'website', 'https://cacaoroute.example', 79, 6, 20, 9, NULL),
  ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9004', 'Gold Pantry', NULL, 'not_onboarded', 'email', 'orders@goldenpantry.example', 86, 3, 8, 4, NULL);

INSERT INTO vendor_products (vendor_id, item_id, price_per_unit, unit, is_primary, order_cadence, cadence_days, next_order_date, preferred_order_weekday)
SELECT
  x.vendor_id,
  i.id,
  x.price_per_unit,
  COALESCE(NULLIF(i.purchase_unit, ''), i.unit),
  x.is_primary,
  x.order_cadence,
  x.cadence_days,
  x.next_order_date,
  x.preferred_order_weekday
FROM (
  VALUES
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9001'::UUID, 'All-Purpose Flour', 1.08::DECIMAL(10,4), true,  'weekly', NULL::INTEGER, CURRENT_DATE + 7,  EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9001'::UUID, 'Baking Powder', 0.92::DECIMAL(10,4), false, 'biweekly', NULL::INTEGER, CURRENT_DATE + 14, EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9002'::UUID, 'Heavy Cream', 4.60::DECIMAL(10,4), true,  'daily', NULL::INTEGER, CURRENT_DATE + 1, EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9002'::UUID, 'Unsalted Butter', 3.95::DECIMAL(10,4), false, 'weekly', NULL::INTEGER, CURRENT_DATE + 7, EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9003'::UUID, 'Cocoa Powder', 12.75::DECIMAL(10,4), true,  'custom_days', 10, CURRENT_DATE + 10, EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9003'::UUID, 'Vanilla Extract', 38.20::DECIMAL(10,4), false, 'biweekly', NULL::INTEGER, CURRENT_DATE + 14, EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9004'::UUID, 'Granulated Sugar', 1.10::DECIMAL(10,4), true,  'weekly', NULL::INTEGER, CURRENT_DATE + 7, EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9004'::UUID, 'Free-Range Eggs', 0.24::DECIMAL(10,4), false, 'daily', NULL::INTEGER, CURRENT_DATE + 1, EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT)
) AS x(vendor_id, product_name, price_per_unit, is_primary, order_cadence, cadence_days, next_order_date, preferred_order_weekday)
JOIN items i ON i.product_name = x.product_name;
