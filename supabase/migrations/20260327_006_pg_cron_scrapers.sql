-- ============================================================================
-- Migration: pg_cron jobs for automated scraping
-- Purpose: Automatically trigger the orchestrator and worker Edge Functions
--
-- NOTE: Run this AFTER deploying the Edge Functions.
-- Replace YOUR_SERVICE_ROLE_KEY with your actual Supabase service role key.
-- ============================================================================

-- Ensure pg_cron and pg_net extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- 1. Worker heartbeat: processes the scraper queue every minute
--    Each invocation processes multiple tasks (batch mode, ~120s budget)
-- ============================================================================

SELECT cron.schedule(
  'scrape-worker-heartbeat',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://lwcsouyknwbxeexektyr.supabase.co/functions/v1/scrape-worker',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- ============================================================================
-- 2. Orchestrator: checks scheduler_config and creates new scraping runs
--    Runs every 5 minutes
-- ============================================================================

SELECT cron.schedule(
  'scrape-orchestrator-scheduled',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://lwcsouyknwbxeexektyr.supabase.co/functions/v1/scrape-orchestrator',
    body := '{"mode":"scheduled"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- ============================================================================
-- 3. Queue cleanup: remove completed/failed tasks older than 7 days
--    Runs daily at 3 AM UTC
-- ============================================================================

SELECT cron.schedule(
  'scraper-queue-cleanup',
  '0 3 * * *',  -- Daily at 3 AM UTC
  $$
  DELETE FROM public.scraper_queue
  WHERE status IN ('completed', 'failed', 'skipped')
    AND created_at < now() - interval '7 days';
  $$
);
