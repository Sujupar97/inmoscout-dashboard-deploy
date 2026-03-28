-- ============================================================================
-- Migration: Scraper Task Queue
-- Purpose: Database-driven task queue for Edge Function scraping pipeline.
--          Each row = one atomic unit of work (1 ScraperAPI call).
--          Solves the 150s Edge Function timeout constraint.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scraper_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Task identity
  job_id text NOT NULL,                   -- e.g., "Zonaprop-Belgrano-Departamento"
  run_id bigint REFERENCES public.scraper_run_log(id) ON DELETE SET NULL,
  task_type text NOT NULL CHECK (task_type IN ('scrape_listing_page', 'scrape_property')),

  -- Task parameters
  portal text NOT NULL,
  zona text NOT NULL,
  property_type text NOT NULL,
  target_url text NOT NULL,
  page_number integer,                    -- For listing pages: which page number

  -- Execution state
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  attempts integer DEFAULT 0 NOT NULL,
  max_attempts integer DEFAULT 3 NOT NULL,
  error_message text,

  -- Scheduling & locking
  not_before timestamptz DEFAULT now() NOT NULL,  -- Rate limiting: don't process before this time
  locked_until timestamptz,                        -- Pessimistic lock: prevents double-processing

  -- Results
  result_data jsonb                       -- listing: { urls_found, new_urls, has_next_page }
                                          -- property: { inserted: bool, property_id: uuid }
);

-- Index for the worker to efficiently pick the next task
CREATE INDEX IF NOT EXISTS idx_queue_next_task
  ON public.scraper_queue (not_before, created_at)
  WHERE status = 'pending';

-- Index for monitoring by run
CREATE INDEX IF NOT EXISTS idx_queue_run_id
  ON public.scraper_queue (run_id, status);

-- Index for monitoring by job
CREATE INDEX IF NOT EXISTS idx_queue_job_id
  ON public.scraper_queue (job_id, status);

-- Index for cleanup of old completed tasks
CREATE INDEX IF NOT EXISTS idx_queue_status_created
  ON public.scraper_queue (status, created_at)
  WHERE status IN ('completed', 'failed', 'skipped');

-- RLS
ALTER TABLE public.scraper_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users"
ON public.scraper_queue FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for service role and authenticated"
ON public.scraper_queue FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for service role and authenticated"
ON public.scraper_queue FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete for authenticated users"
ON public.scraper_queue FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- RPC: Atomic task claim for the worker
-- Uses FOR UPDATE SKIP LOCKED to prevent double-processing
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_next_scraper_task()
RETURNS jsonb AS $$
DECLARE
  claimed_task public.scraper_queue%ROWTYPE;
BEGIN
  UPDATE public.scraper_queue
  SET
    status = 'processing',
    locked_until = now() + interval '120 seconds',
    attempts = attempts + 1
  WHERE id = (
    SELECT id
    FROM public.scraper_queue
    WHERE status = 'pending'
      AND not_before <= now()
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO claimed_task;

  IF claimed_task.id IS NULL THEN
    RETURN jsonb_build_object('idle', true);
  END IF;

  RETURN to_jsonb(claimed_task);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RPC: Get run progress (aggregated counts by status)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_run_progress(p_run_id bigint DEFAULT NULL, p_job_id text DEFAULT NULL)
RETURNS jsonb AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'total', COUNT(*),
      'pending', COUNT(*) FILTER (WHERE status = 'pending'),
      'processing', COUNT(*) FILTER (WHERE status = 'processing'),
      'completed', COUNT(*) FILTER (WHERE status = 'completed'),
      'failed', COUNT(*) FILTER (WHERE status = 'failed'),
      'skipped', COUNT(*) FILTER (WHERE status = 'skipped'),
      'properties_new', COUNT(*) FILTER (WHERE status = 'completed' AND task_type = 'scrape_property' AND (result_data->>'inserted')::boolean = true),
      'properties_skipped', COUNT(*) FILTER (WHERE status = 'skipped' AND task_type = 'scrape_property')
    )
    FROM public.scraper_queue
    WHERE (p_run_id IS NULL OR run_id = p_run_id)
      AND (p_job_id IS NULL OR job_id = p_job_id)
  );
END;
$$ LANGUAGE plpgsql STABLE;
