-- ─────────────────────────────────────────────────────────────────────────────
-- 009_clean_order_history.sql
-- Wipe legacy order history and demand forecast rows so the ML pipeline
-- starts fresh with only real Clover data.
-- ─────────────────────────────────────────────────────────────────────────────

TRUNCATE TABLE demand_forecasts RESTART IDENTITY;
