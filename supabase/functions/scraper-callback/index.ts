import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: scraper-callback
 *
 * Called by n8n workflows when a scraping job completes.
 * Logs the results to `scraper_run_log` and updates job status in `scraping_jobs`.
 *
 * Expected payload:
 * {
 *   job_id: string,        // e.g., "Zonaprop-Belgrano-Departamento"
 *   portal: string,        // "Zonaprop", "MercadoLibre", "Argenprop"
 *   zona: string,          // "Belgrano"
 *   property_type: string, // "Departamento"
 *   properties_found: number,
 *   properties_new: number,
 *   properties_skipped: number,
 *   properties_failed: number,
 *   duration_seconds: number,
 *   status: "completed" | "failed",
 *   error_message?: string
 * }
 */

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()

    // Validate required fields
    if (!payload.portal || !payload.zona || !payload.property_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: portal, zona, property_type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const status = payload.status || 'completed'

    // 1. Insert into scraper_run_log
    const { data: logEntry, error: logError } = await supabaseClient
      .from('scraper_run_log')
      .insert({
        portal: payload.portal,
        zona: payload.zona,
        property_type: payload.property_type,
        job_id: payload.job_id || null,
        status: status,
        properties_found: payload.properties_found || 0,
        properties_new: payload.properties_new || 0,
        properties_skipped: payload.properties_skipped || 0,
        properties_failed: payload.properties_failed || 0,
        duration_seconds: payload.duration_seconds || null,
        error_message: payload.error_message || null,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (logError) {
      console.error('Error inserting scraper run log:', logError)
    }

    // 2. Update scraping_jobs status if job_id provided
    if (payload.job_id) {
      const jobStatus = status === 'completed' ? 'Completed' : 'Failed'
      const { error: jobError } = await supabaseClient
        .from('scraping_jobs')
        .update({
          status: jobStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.job_id)

      if (jobError) {
        console.error('Error updating scraping job:', jobError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        log_id: logEntry?.id,
        message: `Logged ${status} run for ${payload.portal}/${payload.zona}/${payload.property_type}: ${payload.properties_new || 0} new, ${payload.properties_skipped || 0} skipped`
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
