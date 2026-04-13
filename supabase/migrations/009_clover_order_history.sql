-- ─────────────────────────────────────────────────────────────────────────────
-- 009_clover_order_history.sql
-- Adds order details to clover_processed_orders for history display.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clover_processed_orders
  ADD COLUMN IF NOT EXISTS order_created_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS line_items        JSONB,
  ADD COLUMN IF NOT EXISTS deducted          JSONB;

CREATE INDEX IF NOT EXISTS clover_processed_orders_created_idx
  ON clover_processed_orders (order_created_at DESC);
