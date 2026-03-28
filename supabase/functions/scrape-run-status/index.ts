/**
 * Edge Function: scrape-run-status
 *
 * Returns progress of a scraping run and auto-finalizes completed runs.
 * Called by frontend polling every 5s while a run is active.
 *
 * Usage: POST { run_id: 42 } or POST { job_id: "Zonaprop-Belgrano-Departamento" }
 */

import { getSupabaseClient } from '../_shared/supabase-client.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabase = getSupabaseClient()
    const payload = await req.json().catch(() => ({}))

    const runId = payload.run_id ? Number(payload.run_id) : null
    const jobId = payload.job_id as string | null || null

    if (!runId && !jobId) {
      return new Response(
        JSON.stringify({ error: 'Provide run_id or job_id' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Get progress via RPC
    const { data: progress, error: progressError } = await supabase
      .rpc('get_run_progress', {
        p_run_id: runId,
        p_job_id: jobId,
      })

    if (progressError) throw progressError

    const stats = progress as unknown as {
      total: number
      pending: number
      processing: number
      completed: number
      failed: number
      skipped: number
      properties_new: number
      properties_skipped: number
    }

    // Check if run is complete (no pending or processing tasks)
    const isComplete = stats.total > 0 && stats.pending === 0 && stats.processing === 0

    if (isComplete && runId) {
      // Finalize the run log
      await supabase
        .from('scraper_run_log')
        .update({
          status: 'completed',
          properties_found: stats.completed + stats.skipped + stats.failed,
          properties_new: stats.properties_new,
          properties_skipped: stats.properties_skipped,
          properties_failed: stats.failed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)
        .eq('status', 'running')  // Only update if still running (idempotent)

      // Also update scraping_jobs if job_id available
      if (jobId) {
        await supabase
          .from('scraping_jobs')
          .update({ status: 'Completed', updated_at: new Date().toISOString() })
          .eq('id', jobId)
      }
    }

    return new Response(
      JSON.stringify({
        ...stats,
        is_complete: isComplete,
        run_id: runId,
        job_id: jobId,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Status check error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
