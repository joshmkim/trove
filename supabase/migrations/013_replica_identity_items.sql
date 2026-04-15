-- ─────────────────────────────────────────────────────────────────────────────
-- 013_replica_identity_items.sql
-- Without REPLICA IDENTITY FULL, Supabase realtime only broadcasts INSERT
-- events reliably. UPDATE events (e.g. quantity_remaining changing after an
-- invoice is applied or a Clover order deducts stock) are silently dropped.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE items REPLICA IDENTITY FULL;

-- Also harden clover_processed_orders for the same reason
ALTER TABLE clover_processed_orders REPLICA IDENTITY FULL;
