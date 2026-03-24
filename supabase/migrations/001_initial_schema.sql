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

-- ── Orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  customer        TEXT,
  order_source    TEXT,
  type            TEXT,
  channel         TEXT,
  location        TEXT,
  delivery_by     DATE,
  total_vendors   INTEGER     NOT NULL DEFAULT 0,
  notes           TEXT,
  payment_status  TEXT,
  order_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_orders_updated_at();

-- ── Order items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_name     TEXT        NOT NULL,
  quantity      NUMERIC     NOT NULL,
  unit          TEXT        NOT NULL DEFAULT 'kg',
  vendor_id     TEXT,
  vendor_name   TEXT,
  vendor_phone  TEXT,
  sms_sent      BOOLEAN     NOT NULL DEFAULT false,
  sms_sent_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

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
ALTER TABLE items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_items"
  ON items FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_items"
  ON items FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_orders"
  ON orders FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_orders"
  ON orders FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_order_items"
  ON order_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_order_items"
  ON order_items FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_invoices"
  ON invoices FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_invoices"
  ON invoices FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage buckets
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "item_images_public_read"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'item-images');

CREATE POLICY "item_images_anon_upload"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'item-images');

CREATE POLICY "invoices_anon_upload"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "invoices_anon_read"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'invoices');

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data
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
