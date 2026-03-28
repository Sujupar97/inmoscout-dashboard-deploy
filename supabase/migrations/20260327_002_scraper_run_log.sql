-- ============================================================================
-- Migration: Scraper Run Log table
-- Purpose: Track every scraper execution with metrics for monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scraper_run_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  portal text NOT NULL,
  zona text NOT NULL,
  property_type text NOT NULL,
  job_id text,
  status text DEFAULT 'running' NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  properties_found integer DEFAULT 0,
  properties_new integer DEFAULT 0,
  properties_skipped integer DEFAULT 0,
  properties_failed integer DEFAULT 0,
  error_message text,
  duration_seconds integer,
  completed_at timestamptz
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scraper_log_created ON public.scraper_run_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraper_log_portal ON public.scraper_run_log (portal, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraper_log_status ON public.scraper_run_log (status);

-- RLS
ALTER TABLE public.scraper_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users"
ON public.scraper_run_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated and service role"
ON public.scraper_run_log FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON public.scraper_run_log FOR UPDATE
TO authenticated
USING (true);
