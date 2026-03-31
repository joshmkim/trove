-- ─────────────────────────────────────────────────────────────────────────────
-- 007_vendor_portal_and_ordering_cadence.sql
-- Adds Supabase-backed vendor portal data model, cadence scheduling, and
-- outreach metadata for ordering (SMS/email/manual website).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Vendors ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  seed_item_id        UUID UNIQUE REFERENCES items(id) ON DELETE SET NULL,
  vendor_status       TEXT NOT NULL DEFAULT 'my_vendor'
                      CHECK (vendor_status IN ('my_vendor', 'not_onboarded')),
  contact_method      TEXT NOT NULL
                      CHECK (contact_method IN ('phone', 'email', 'website')),
  contact_value       TEXT NOT NULL,
  reliability_score   INTEGER NOT NULL DEFAULT 85,
  lead_time_days      INTEGER NOT NULL DEFAULT 3,
  response_time_hours INTEGER NOT NULL DEFAULT 24,
  advance_order_days  INTEGER NOT NULL DEFAULT 3,
  onboarded_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Vendor products + ordering cadence ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_products (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id              UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  item_id                UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  price_per_unit         DECIMAL(10,4),
  unit                   TEXT,
  is_primary             BOOLEAN NOT NULL DEFAULT false,
  order_cadence          TEXT NOT NULL DEFAULT 'weekly'
                         CHECK (order_cadence IN ('daily', 'weekly', 'biweekly', 'custom_days')),
  cadence_days           INTEGER,
  next_order_date        DATE,
  preferred_order_weekday SMALLINT CHECK (preferred_order_weekday BETWEEN 0 AND 6),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, item_id)
);

CREATE TRIGGER vendor_products_updated_at
  BEFORE UPDATE ON vendor_products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS vendor_products_item_idx ON vendor_products (item_id);
CREATE INDEX IF NOT EXISTS vendor_products_vendor_idx ON vendor_products (vendor_id);
CREATE INDEX IF NOT EXISTS vendor_products_next_order_idx ON vendor_products (next_order_date);
CREATE INDEX IF NOT EXISTS vendor_products_cadence_idx ON vendor_products (order_cadence);

-- ── Order item outreach + per-line delivery metadata ─────────────────────────
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS outreach_channel TEXT
    CHECK (outreach_channel IN ('sms', 'email', 'website')),
  ADD COLUMN IF NOT EXISTS outreach_status TEXT
    CHECK (outreach_status IN ('pending', 'sent', 'manual_required', 'failed')),
  ADD COLUMN IF NOT EXISTS outreach_error TEXT,
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_outreach_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expected_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS cadence_snapshot TEXT;

-- ── RLS policies (match existing anon-permissive model) ──────────────────────
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_vendors" ON vendors;
DROP POLICY IF EXISTS "anon_write_vendors" ON vendors;
DROP POLICY IF EXISTS "anon_read_vendor_products" ON vendor_products;
DROP POLICY IF EXISTS "anon_write_vendor_products" ON vendor_products;

CREATE POLICY "anon_read_vendors"
  ON vendors FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_vendors"
  ON vendors FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_vendor_products"
  ON vendor_products FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_vendor_products"
  ON vendor_products FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Seed one vendor per item/SKU into My Vendors ─────────────────────────────
INSERT INTO vendors (
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
)
SELECT
  CONCAT(i.product_name, ' Supply'),
  i.id,
  'my_vendor',
  CASE MOD(ROW_NUMBER() OVER (ORDER BY i.created_at, i.id), 3)
    WHEN 0 THEN 'phone'
    WHEN 1 THEN 'email'
    ELSE 'website'
  END AS contact_method,
  CASE MOD(ROW_NUMBER() OVER (ORDER BY i.created_at, i.id), 3)
    WHEN 0 THEN CONCAT('+1', LPAD((7000000000 + ROW_NUMBER() OVER (ORDER BY i.created_at, i.id))::TEXT, 10, '0'))
    WHEN 1 THEN CONCAT('orders+', lower(regexp_replace(i.product_name, '[^a-zA-Z0-9]+', '-', 'g')), '@vendor.local')
    ELSE CONCAT('https://', lower(regexp_replace(i.product_name, '[^a-zA-Z0-9]+', '-', 'g')), '.vendor.local')
  END AS contact_value,
  82 + MOD(ROW_NUMBER() OVER (ORDER BY i.created_at, i.id), 16),
  1 + MOD(ROW_NUMBER() OVER (ORDER BY i.created_at, i.id), 6),
  2 + MOD(ROW_NUMBER() OVER (ORDER BY i.created_at, i.id), 20),
  2 + MOD(ROW_NUMBER() OVER (ORDER BY i.created_at, i.id), 10),
  now()
FROM items i
ON CONFLICT (seed_item_id) DO NOTHING;

INSERT INTO vendor_products (
  vendor_id,
  item_id,
  price_per_unit,
  unit,
  is_primary,
  order_cadence,
  cadence_days,
  next_order_date,
  preferred_order_weekday
)
SELECT
  v.id,
  i.id,
  ROUND((1.25 + MOD(ROW_NUMBER() OVER (ORDER BY i.created_at, i.id), 12) * 0.37)::NUMERIC, 2),
  COALESCE(NULLIF(i.purchase_unit, ''), i.unit),
  true,
  CASE MOD(ROW_NUMBER() OVER (ORDER BY i.created_at, i.id), 4)
    WHEN 0 THEN 'daily'
    WHEN 1 THEN 'weekly'
    WHEN 2 THEN 'biweekly'
    ELSE 'custom_days'
  END AS order_cadence,
  CASE WHEN MOD(ROW_NUMBER() OVER (ORDER BY i.created_at, i.id), 4) = 3 THEN 10 ELSE NULL END AS cadence_days,
  CASE MOD(ROW_NUMBER() OVER (ORDER BY i.created_at, i.id), 4)
    WHEN 0 THEN CURRENT_DATE + 1
    WHEN 1 THEN CURRENT_DATE + 7
    WHEN 2 THEN CURRENT_DATE + 14
    ELSE CURRENT_DATE + 10
  END AS next_order_date,
  EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT
FROM items i
JOIN vendors v ON v.seed_item_id = i.id
ON CONFLICT (vendor_id, item_id) DO NOTHING;

-- ── Seed candidate vendors for Vendor Onboarding ─────────────────────────────
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
)
VALUES
  (
    'd5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9001',
    'North Mill Ingredients',
    'not_onboarded',
    'email',
    'sales@northmill.example',
    84,
    4,
    10,
    5,
    NULL
  ),
  (
    'd5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9002',
    'Dawn Dairy Partners',
    'not_onboarded',
    'phone',
    '+17185550122',
    88,
    2,
    6,
    3,
    NULL
  ),
  (
    'd5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9003',
    'Cacao Route Trading',
    'not_onboarded',
    'website',
    'https://cacaoroute.example',
    79,
    6,
    20,
    9,
    NULL
  ),
  (
    'd5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9004',
    'Golden Pantry Supply',
    'not_onboarded',
    'email',
    'orders@goldenpantry.example',
    86,
    3,
    8,
    4,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO vendor_products (
  vendor_id,
  item_id,
  price_per_unit,
  unit,
  is_primary,
  order_cadence,
  cadence_days,
  next_order_date,
  preferred_order_weekday
)
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
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9001'::UUID, 'All-Purpose Flour', 1.08::DECIMAL(10,4), true,  'weekly',      NULL::INTEGER, CURRENT_DATE + 7,  EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9001'::UUID, 'Baking Powder',     0.92::DECIMAL(10,4), false, 'biweekly',    NULL::INTEGER, CURRENT_DATE + 14, EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9002'::UUID, 'Heavy Cream',       4.60::DECIMAL(10,4), true,  'daily',       NULL::INTEGER, CURRENT_DATE + 1,  EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9002'::UUID, 'Unsalted Butter',   3.95::DECIMAL(10,4), false, 'weekly',      NULL::INTEGER, CURRENT_DATE + 7,  EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9003'::UUID, 'Cocoa Powder',     12.75::DECIMAL(10,4), true,  'custom_days', 10,            CURRENT_DATE + 10, EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9003'::UUID, 'Vanilla Extract',  38.20::DECIMAL(10,4), false, 'biweekly',    NULL::INTEGER, CURRENT_DATE + 14, EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9004'::UUID, 'Granulated Sugar',  1.10::DECIMAL(10,4), true,  'weekly',      NULL::INTEGER, CURRENT_DATE + 7,  EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT),
    ('d5f3b6aa-7a9f-4f31-9c7d-1d7d3b8d9004'::UUID, 'Free-Range Eggs',   0.24::DECIMAL(10,4), false, 'daily',       NULL::INTEGER, CURRENT_DATE + 1,  EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT)
) AS x(vendor_id, product_name, price_per_unit, is_primary, order_cadence, cadence_days, next_order_date, preferred_order_weekday)
JOIN items i ON i.product_name = x.product_name
ON CONFLICT (vendor_id, item_id) DO NOTHING;
