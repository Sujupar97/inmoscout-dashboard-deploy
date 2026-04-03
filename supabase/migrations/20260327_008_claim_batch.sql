-- ============================================================================
-- Migration: Batch task claim function for scrape-worker
-- Purpose: The worker calls claim_batch_scraper_tasks(p_count) but only
--          claim_next_scraper_task() (single) existed. This fixes the
--          critical bug that prevented the scraping pipeline from working.
-- ============================================================================

DROP FUNCTION IF EXISTS public.claim_batch_scraper_tasks(integer);

CREATE OR REPLACE FUNCTION public.claim_batch_scraper_tasks(p_count integer DEFAULT 5)
RETURNS SETOF jsonb AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE public.scraper_queue
    SET
      status = 'processing',
      locked_until = now() + interval '120 seconds',
      attempts = attempts + 1
    WHERE id IN (
      SELECT id
      FROM public.scraper_queue
      WHERE status = 'pending'
        AND not_before <= now()
        AND (locked_until IS NULL OR locked_until < now())
      ORDER BY created_at ASC
      LIMIT p_count
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  )
  SELECT to_jsonb(c) FROM claimed c;
END;
$$ LANGUAGE plpgsql;
