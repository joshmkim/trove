-- Google Trends data table
CREATE TABLE IF NOT EXISTS google_trends (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword     text        NOT NULL,
  date        date        NOT NULL,
  interest    integer     NOT NULL CHECK (interest >= 0 AND interest <= 100),
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_trends_keyword_date_idx ON google_trends (keyword, date);

ALTER TABLE google_trends ENABLE ROW LEVEL SECURITY;

-- Allow anon reads (matches existing RLS pattern for demand_forecasts)
CREATE POLICY "anon read google_trends"
  ON google_trends FOR SELECT
  USING (true);
