DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE items;
  END IF;
END $$;
