/**
 * Edge Function: scrape-orchestrator
 *
 * Replaces trigger-scrapers (which sent webhooks to n8n).
 * Creates scraping tasks in the scraper_queue table.
 *
 * Usage:
 *   Manual: POST { portal, zona, property_type, pages }
 *   Scheduled: POST { mode: "scheduled" }
 */

import { getSupabaseClient } from '../_shared/supabase-client.ts'
import { buildScraperUrl, buildPaginatedUrl } from '../_shared/url-builder.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabase = getSupabaseClient()
    let payload: Record<string, unknown> = {}
    try { payload = await req.json() } catch { /* empty payload ok */ }

    const results: string[] = []

    // --- MODE: Scheduled (pg_cron calls this) ---
    if (payload.mode === 'scheduled') {
      return await handleScheduledMode(supabase, results)
    }

    // --- MODE: Manual (frontend calls this with specific job) ---
    const portal = payload.portal as string
    const zona = payload.zona as string
    const propertyType = payload.property_type as string
    const pages = (payload.pages as number) || 5

    if (!portal || !zona || !propertyType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: portal, zona, property_type' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const runResult = await createScrapingRun(supabase, portal, zona, propertyType, pages)
    results.push(`Created run ${runResult.run_id} with ${runResult.tasks_created} tasks`)

    return new Response(
      JSON.stringify({ success: true, ...runResult, results }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Orchestrator error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleScheduledMode(supabase: ReturnType<typeof getSupabaseClient>, results: string[]) {
  const JOB_COOLDOWN_MS = 90 * 1000

  // Fetch active portal configs
  const { data: configs, error: configError } = await supabase
    .from('scheduler_config')
    .select('*')
    .eq('is_active', true)

  if (configError) throw configError
  if (!configs || configs.length === 0) {
    return new Response(
      JSON.stringify({ success: true, message: 'No active portals', results }),
      { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
    )
  }

  for (const config of configs) {
    const portal = config.portal
    const now = Date.now()
    const lastCycle = config.last_cycle_start ? new Date(config.last_cycle_start).getTime() : 0
    const cycleIntervalMs = (24 * 60 * 60 * 1000) / (config.frequency || 1)

    // Check if new cycle needed
    if (now - lastCycle > cycleIntervalMs) {
      // Reset all jobs for this portal to Pending
      await supabase
        .from('scraping_jobs')
        .update({ status: 'Pending' })
        .eq('portal', portal)

      await supabase
        .from('scheduler_config')
        .update({ last_cycle_start: new Date().toISOString() })
        .eq('portal', portal)

      results.push(`Started new cycle for ${portal}`)
    }

    // Check cooldown
    const lastJobRun = config.last_job_run ? new Date(config.last_job_run).getTime() : 0
    if (now - lastJobRun < JOB_COOLDOWN_MS) continue

    // Find next pending job
    const { data: nextJobs } = await supabase
      .from('scraping_jobs')
      .select('*')
      .eq('portal', portal)
      .eq('status', 'Pending')
      .order('id', { ascending: true })
      .limit(1)

    if (nextJobs && nextJobs.length > 0) {
      const job = nextJobs[0]

      // Create scraping run with tasks
      const runResult = await createScrapingRun(
        supabase, job.portal, job.zona, job.propertyType, 5
      )

      // Update job status
      await supabase
        .from('scraping_jobs')
        .update({ status: 'Running', updated_at: new Date().toISOString() })
        .eq('id', job.id)

      // Update config
      await supabase
        .from('scheduler_config')
        .update({ last_job_run: new Date().toISOString() })
        .eq('portal', portal)

      results.push(`Triggered ${job.id} (run_id: ${runResult.run_id})`)
    }
  }

  return new Response(
    JSON.stringify({ success: true, triggered: results }),
    { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
  )
}

async function createScrapingRun(
  supabase: ReturnType<typeof getSupabaseClient>,
  portal: string,
  zona: string,
  propertyType: string,
  pages: number
): Promise<{ run_id: number; tasks_created: number }> {
  const jobId = `${portal}-${zona}-${propertyType}`

  // 1. Create run log entry
  const { data: runLog, error: runError } = await supabase
    .from('scraper_run_log')
    .insert({
      portal,
      zona,
      property_type: propertyType,
      job_id: jobId,
      status: 'running',
    })
    .select('id')
    .single()

  if (runError) throw runError
  const runId = runLog.id

  // 2. Build paginated URLs and create queue tasks
  const baseUrl = buildScraperUrl(portal, zona, propertyType)
  const tasks = []

  for (let page = 1; page <= pages; page++) {
    const pageUrl = buildPaginatedUrl(baseUrl, portal, page)
    tasks.push({
      job_id: jobId,
      run_id: runId,
      task_type: 'scrape_listing_page',
      portal,
      zona,
      property_type: propertyType,
      target_url: pageUrl,
      page_number: page,
      status: 'pending',
      // Stagger pages: 0s, 15s, 30s, 45s...
      not_before: new Date(Date.now() + (page - 1) * 15000).toISOString(),
    })
  }

  const { error: insertError } = await supabase
    .from('scraper_queue')
    .insert(tasks)

  if (insertError) throw insertError

  return { run_id: runId, tasks_created: tasks.length }
}
