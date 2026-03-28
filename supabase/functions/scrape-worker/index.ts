/**
 * Edge Function: scrape-worker
 *
 * The core scraping engine. Picks tasks from scraper_queue and processes them:
 * - scrape_listing_page: Fetch listing HTML → extract property URLs → create property tasks
 * - scrape_property: Fetch property HTML → parse data → save to propiedades table
 *
 * Processes multiple tasks per invocation (batch mode) within the 150s timeout.
 * Called by pg_cron every minute and/or by the frontend.
 */

import { getSupabaseClient } from '../_shared/supabase-client.ts'
import { fetchViaScraperApi } from '../_shared/scraper-api.ts'
import { parseListingPage, parsePropertyPage } from '../_shared/parsers/index.ts'
import { QueueTask, PORTAL_IDS } from '../_shared/types.ts'

const MAX_RUNTIME_MS = 120_000  // 120s safety margin (Edge Function timeout is 150s)
const DELAY_BETWEEN_TASKS_MS = 5_000  // Rate limit: 5s between ScraperAPI calls

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const startTime = Date.now()
  const supabase = getSupabaseClient()
  let tasksProcessed = 0
  let errors = 0

  try {
    while (Date.now() - startTime < MAX_RUNTIME_MS) {
      // Claim next task atomically
      const { data: taskData, error: claimError } = await supabase
        .rpc('claim_next_scraper_task')

      if (claimError) {
        console.error('Error claiming task:', claimError)
        break
      }

      const task = taskData as unknown as QueueTask | { idle: true }
      if (!task || 'idle' in task) break  // No more pending tasks

      try {
        await processTask(supabase, task as QueueTask)
        tasksProcessed++
      } catch (e) {
        errors++
        console.error(`Error processing task ${(task as QueueTask).id}:`, e)
        await handleTaskError(supabase, task as QueueTask, (e as Error).message)
      }

      // Rate limit: wait between ScraperAPI calls
      const elapsed = Date.now() - startTime
      if (elapsed + DELAY_BETWEEN_TASKS_MS + 20_000 < MAX_RUNTIME_MS) {
        await delay(DELAY_BETWEEN_TASKS_MS)
      } else {
        break  // Not enough time for another task
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tasks_processed: tasksProcessed,
        errors,
        runtime_ms: Date.now() - startTime,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Worker fatal error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message, tasks_processed: tasksProcessed }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================================
// Task Processing
// ============================================================================

async function processTask(supabase: ReturnType<typeof getSupabaseClient>, task: QueueTask) {
  if (task.task_type === 'scrape_listing_page') {
    await processListingPage(supabase, task)
  } else if (task.task_type === 'scrape_property') {
    await processPropertyPage(supabase, task)
  }
}

// --- Listing Page Processing ---

async function processListingPage(supabase: ReturnType<typeof getSupabaseClient>, task: QueueTask) {
  // 1. Fetch HTML via ScraperAPI
  const html = await fetchViaScraperApi(task.target_url)

  // 2. Parse with portal-specific parser
  const result = parseListingPage(task.portal, html)
  console.log(`[${task.portal}] Page ${task.page_number}: found ${result.urls.length} URLs, hasNextPage: ${result.hasNextPage}`)

  // 3. Dedup check: which URLs are already in our database?
  let newUrls: string[] = []
  if (result.urls.length > 0) {
    const { data: existingRows } = await supabase
      .from('propiedades')
      .select('link')
      .in('link', result.urls)

    const existingLinks = new Set((existingRows || []).map((r: any) => r.link))
    newUrls = result.urls.filter(url => !existingLinks.has(url))
  }

  // 4. Create property scraping tasks for new URLs
  if (newUrls.length > 0) {
    const propertyTasks = newUrls.map((url, i) => ({
      job_id: task.job_id,
      run_id: task.run_id,
      task_type: 'scrape_property' as const,
      portal: task.portal,
      zona: task.zona,
      property_type: task.property_type,
      target_url: url,
      status: 'pending' as const,
      // Stagger: 10s apart to respect rate limits
      not_before: new Date(Date.now() + (i + 1) * 10_000).toISOString(),
    }))

    await supabase.from('scraper_queue').insert(propertyTasks)
  }

  // 5. Also create 'skipped' entries for existing URLs (for tracking)
  const skippedCount = result.urls.length - newUrls.length

  // 6. Mark task as completed
  await supabase
    .from('scraper_queue')
    .update({
      status: 'completed',
      result_data: {
        urls_found: result.urls.length,
        new_urls: newUrls.length,
        skipped_urls: skippedCount,
        has_next_page: result.hasNextPage,
      },
    })
    .eq('id', task.id)
}

// --- Property Page Processing ---

async function processPropertyPage(supabase: ReturnType<typeof getSupabaseClient>, task: QueueTask) {
  // 1. Double-check dedup (another worker might have processed it)
  const { data: existing } = await supabase
    .from('propiedades')
    .select('id')
    .eq('link', task.target_url)
    .limit(1)

  if (existing && existing.length > 0) {
    // Already exists, skip
    await supabase
      .from('scraper_queue')
      .update({
        status: 'skipped',
        result_data: { inserted: false, reason: 'duplicate' },
      })
      .eq('id', task.id)
    return
  }

  // 2. Fetch HTML via ScraperAPI
  const html = await fetchViaScraperApi(task.target_url)

  // 3. Parse with portal-specific parser
  const propertyData = parsePropertyPage(task.portal, html, task.zona)
  propertyData.link = task.target_url
  propertyData['Tipo de Propiedad'] = task.property_type
  propertyData.Portal = PORTAL_IDS[task.portal] || 1

  // 4. Validate minimum required data
  if (!propertyData.titulo && !propertyData.precio) {
    console.warn(`[${task.portal}] Empty parse result for ${task.target_url}`)
    // Still insert but it'll get flagged by data_quality trigger
  }

  // 5. Insert into propiedades (using exact column names from the DB)
  const { data: inserted, error: insertError } = await supabase
    .from('propiedades')
    .insert({
      titulo: propertyData.titulo || 'Sin título',
      precio: propertyData.precio || 0,
      moneda: propertyData.moneda || 'USD',
      ubicacion: propertyData.ubicacion || '',
      zona: task.zona,
      link: task.target_url,
      image_url: propertyData.image_url,
      area: propertyData.area,
      covered_area: propertyData.covered_area,
      total_area: propertyData.area,  // total_area = area in this DB schema
      balcony_area: propertyData.balcony_area,
      bedrooms: propertyData.bedrooms,
      bathrooms: propertyData.bathrooms,
      description: propertyData.description,
      seller_name: propertyData.seller_name,
      dias_en_mercado: propertyData.dias_en_mercado,
      visualizaciones: propertyData.visualizaciones,
      latitude: propertyData.latitude,
      longitude: propertyData.longitude,
      'Tipo de Propiedad': task.property_type,
      Portal: PORTAL_IDS[task.portal] || 1,
      status: 'New',
      nombre_anunciante: propertyData.nombre_anunciante,
      telefono_contacto: propertyData.telefono_contacto,
      antiguedad: propertyData.antiguedad,
    })
    .select('id')
    .single()

  if (insertError) {
    // If it's a unique constraint violation (duplicate link), skip gracefully
    if (insertError.code === '23505') {
      await supabase
        .from('scraper_queue')
        .update({ status: 'skipped', result_data: { inserted: false, reason: 'duplicate_on_insert' } })
        .eq('id', task.id)
      return
    }
    throw insertError
  }

  // 6. Mark task as completed
  await supabase
    .from('scraper_queue')
    .update({
      status: 'completed',
      result_data: { inserted: true, property_id: inserted?.id },
    })
    .eq('id', task.id)

  console.log(`[${task.portal}] Saved property: ${propertyData.titulo?.substring(0, 50)}`)
}

// ============================================================================
// Error Handling
// ============================================================================

async function handleTaskError(supabase: ReturnType<typeof getSupabaseClient>, task: QueueTask, errorMsg: string) {
  if (task.attempts >= task.max_attempts) {
    // Max retries exceeded
    await supabase
      .from('scraper_queue')
      .update({ status: 'failed', error_message: errorMsg })
      .eq('id', task.id)
  } else {
    // Retry after 60 seconds
    await supabase
      .from('scraper_queue')
      .update({
        status: 'pending',
        error_message: errorMsg,
        not_before: new Date(Date.now() + 60_000).toISOString(),
        locked_until: null,
      })
      .eq('id', task.id)
  }
}
