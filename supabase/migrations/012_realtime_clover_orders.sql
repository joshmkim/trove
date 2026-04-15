-- ─────────────────────────────────────────────────────────────────────────────
-- 012_realtime_clover_orders.sql
-- Enable Supabase Realtime for clover_processed_orders so the
-- harucake-inventory page receives INSERT events instantly instead of
-- waiting for the 3-minute poll.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add to the realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname    = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'clover_processed_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE clover_processed_orders;
  END IF;
END $$;

-- 2. Enable RLS (required for realtime to deliver rows to the anon key)
ALTER TABLE clover_processed_orders ENABLE ROW LEVEL SECURITY;

-- 3. Allow anonymous reads (realtime uses SELECT under the hood)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clover_processed_orders'
      AND policyname = 'anon_read_clover_orders'
  ) THEN
    CREATE POLICY "anon_read_clover_orders"
      ON clover_processed_orders
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- 4. Allow anonymous inserts (the sync route uses the anon key to write)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clover_processed_orders'
      AND policyname = 'anon_write_clover_orders'
  ) THEN
    CREATE POLICY "anon_write_clover_orders"
      ON clover_processed_orders
      FOR ALL TO anon
      USING (true) WITH CHECK (true);
  END IF;
END $$;
