-- ─────────────────────────────────────────────────────────────────────────────
-- 001_initial_schema.sql
-- Run this in the Supabase SQL editor or via `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Items (inventory) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name        TEXT NOT NULL,
  quantity_remaining  INTEGER NOT NULL DEFAULT 0,
  stock_level         TEXT NOT NULL CHECK (stock_level IN ('low', 'high')),
  qty_in              INTEGER NOT NULL DEFAULT 0,
  qty_out             INTEGER NOT NULL DEFAULT 0,
  qty_balance         INTEGER NOT NULL DEFAULT 0,
  sku_id              TEXT,
  image_url           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Orders ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer        TEXT,
  order_source    TEXT,
  type            TEXT,
  items           JSONB,
  channel         TEXT,
  location        TEXT,
  order_date      TIMESTAMPTZ,
  status          TEXT CHECK (status IN ('active', 'scheduled', 'completed', 'cancelled')),
  payment_status  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Pending order requests ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_order_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Invoices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename        TEXT NOT NULL,
  file_size       TEXT,
  file_url        TEXT,
  upload_status   TEXT CHECK (upload_status IN ('uploading', 'completed', 'failed')),
  upload_progress INTEGER NOT NULL DEFAULT 0,
  parsed_items    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE items                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices               ENABLE ROW LEVEL SECURITY;

-- Allow anon read for all tables (internal tool — tighten if auth is added)
CREATE POLICY "anon_read_items"
  ON items FOR SELECT TO anon USING (true);

CREATE POLICY "anon_write_items"
  ON items FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_orders"
  ON orders FOR SELECT TO anon USING (true);

CREATE POLICY "anon_write_orders"
  ON orders FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_pending_order_requests"
  ON pending_order_requests FOR SELECT TO anon USING (true);

CREATE POLICY "anon_write_pending_order_requests"
  ON pending_order_requests FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_invoices"
  ON invoices FOR SELECT TO anon USING (true);

CREATE POLICY "anon_write_invoices"
  ON invoices FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage buckets
-- ─────────────────────────────────────────────────────────────────────────────

-- Item images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

-- Invoice files bucket (private — accessed via signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow anon upload/read for item-images
CREATE POLICY "item_images_public_read"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'item-images');

CREATE POLICY "item_images_anon_upload"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'item-images');

-- Storage policies: allow anon upload for invoices (read requires signed URL)
CREATE POLICY "invoices_anon_upload"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "invoices_anon_read"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'invoices');

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data (matches the existing mock data for development)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO items (product_name, quantity_remaining, stock_level, qty_in, qty_out, qty_balance, sku_id) VALUES
  ('All-Purpose Flour', 12, 'low',  50, 38, 12, 'SKU-001'),
  ('Unsalted Butter',   48, 'high', 60, 12, 48, 'SKU-002'),
  ('Granulated Sugar',   8, 'low',  40, 32,  8, 'SKU-003'),
  ('Heavy Cream',       30, 'high', 36,  6, 30, 'SKU-004'),
  ('Free-Range Eggs',    6, 'low',  30, 24,  6, 'SKU-005'),
  ('Vanilla Extract',   22, 'high', 24,  2, 22, 'SKU-006'),
  ('Baking Powder',     15, 'high', 20,  5, 15, 'SKU-007'),
  ('Cocoa Powder',       4, 'low',  18, 14,  4, 'SKU-008')
ON CONFLICT DO NOTHING;

INSERT INTO orders (customer, order_source, type, items, channel, location, order_date, status, payment_status) VALUES
  ('Alex Smith', 'Direct',      'Standard', '[{"name":"Cake","qty":1}]', 'Online',   'Jakarta Selatan', '2025-01-02T00:00:00Z', 'scheduled', 'paid'),
  ('ORDER#01',   'Marketplace', 'Bulk',     '[{"name":"Cake","qty":3}]', 'In-store', 'Jakarta Pusat',   '2025-01-01T00:00:00Z', 'active',    'pending')
ON CONFLICT DO NOTHING;

INSERT INTO pending_order_requests (description, is_selected) VALUES
  ('50 lbs Oranges, 35 lbs Lemons, 20 lbs Avocados', true),
  ('30 cartons Eggs', false)
ON CONFLICT DO NOTHING;
