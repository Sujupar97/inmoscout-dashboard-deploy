
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuration for webhooks (Must match config.ts slightly or be env vars)
const WEBHOOKS = {
  'Zonaprop': 'https://n8n.srv1022992.hstgr.cloud/webhook/750e883c-85ce-4995-8537-161dd63e3890',
  'MercadoLibre': 'https://n8n.srv1022992.hstgr.cloud/webhook/708a0331-35a2-480b-af9c-fbcb6fae250d',
  'Argenprop': 'https://n8n.srv1022992.hstgr.cloud/webhook/5125f692-bbc2-452c-bc30-176df6f5c4c8'
}

const JOB_COOLDOWN_MS = 90 * 1000; // 90 seconds

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if it's a manual trigger
    let payload = {}
    try { payload = await req.json() } catch { }

    // 1. Fetch Configuration
    const { data: configs, error: configError } = await supabaseClient
      .from('scheduler_config')
      .select('*')
      .eq('is_active', true)

    if (configError) throw configError

    const results = []

    for (const config of configs) {
      const portal = config.portal
      let shouldRunJob = false
      let newCycleStarted = false

      // A. Check if we need to start a NEW CYCLE
      // Logic: If last_cycle_start is older than (24h / frequency)
      const now = new Date().getTime()
      const lastCycle = config.last_cycle_start ? new Date(config.last_cycle_start).getTime() : 0
      const cycleIntervalMs = (24 * 60 * 60 * 1000) / (config.frequency || 1)

      if (now - lastCycle > cycleIntervalMs) {
        // START NEW CYCLE: Reset all Pending jobs for this portal
        // But we only do this if all previous are done? No, force restart.
        // Actually, let's just ensure we have pending jobs.
        // If we are "Starting a cycle", we might want to reset 'Completed' to 'Pending' for today?
        // The requirement is "execute X times a day". 
        // Strategy: If time for new cycle, mark ALL jobs for this portal as 'Pending'.

        const { error: resetError } = await supabaseClient
          .from('scraping_jobs')
          .update({ status: 'Pending', duration: 0, errorMessage: null }) // Reset for new run
          .eq('portal', portal)

        if (!resetError) {
          await supabaseClient
            .from('scheduler_config')
            .update({ last_cycle_start: new Date().toISOString() })
            .eq('portal', portal)
          newCycleStarted = true
          console.log(`Started new cycle for ${portal}`)
        }
      }

      // B. Trigger NEXT PENDING JOB if cooldown passed
      const lastJobRun = config.last_job_run ? new Date(config.last_job_run).getTime() : 0

      // If we just started a cycle, or if enough time has passed since last job
      if (newCycleStarted || (now - lastJobRun > JOB_COOLDOWN_MS)) {
        // Find first Pending job
        const { data: nextJobs, error: jobError } = await supabaseClient
          .from('scraping_jobs')
          .select('*')
          .eq('portal', portal)
          .eq('status', 'Pending')
          .order('id', { ascending: true }) // Order by ID or some sequence? ID usually contains zone name, alphabetical is fine
          .limit(1)

        if (nextJobs && nextJobs.length > 0) {
          const job = nextJobs[0]

          // TRIGGER WEBHOOK
          const webhookUrl = WEBHOOKS[portal as keyof typeof WEBHOOKS]
          if (webhookUrl) {
            // Construct payload similar to frontend
            // url generation is tricky server-side if we depend on 'buildScraperUrl' logic being identical
            // For now, we construct query params manually or verify if webhook needs full URL.
            // Frontend payload: { zona, property_type, portal, pages: 5, url: ..., jobId }
            // N8N likely uses the 'url' param.
            // We need to replicate buildScraperUrl logic roughly or store it in DB?
            // Storing in DB would be safer, but 'scraping_jobs' table lacks 'url' column?
            // Checking frontend: syncAndLoadJobs constructs ID but not URL in DB. 
            // Wait, frontend constructs URL on the fly.
            // For the edge function to be robust, it needs to generate the URL.
            // Simple URL builder for Zonaprop/Argenprop/ML

            // Simulating URL Builder (Basic version)
            let targetUrl = ''
            const zonaClean = job.zona.toLowerCase().replace(/ /g, '-')
            const typeClean = job.propertyType.toLowerCase() // casa, departamento, ph

            if (portal === 'Zonaprop') {
              let typePath = 'departamentos'
              if (typeClean === 'casa') typePath = 'casas'
              if (typeClean === 'ph') typePath = 'ph'
              targetUrl = `https://www.zonaprop.com.ar/${typePath}-venta-${zonaClean}.html`
            } else if (portal === 'Argenprop') {
              let typePath = 'departamento'
              if (typeClean === 'casa') typePath = 'casa'
              if (typeClean === 'ph') typePath = 'ph'
              targetUrl = `https://www.argenprop.com/${typePath}-venta-en-${zonaClean}`
            } else if (portal === 'MercadoLibre') {
              let typePath = 'departamentos'
              if (typeClean === 'casa') typePath = 'casas'
              if (typeClean === 'ph') typePath = 'ph'
              targetUrl = `https://inmuebles.mercadolibre.com.ar/${typePath}/venta/capital-federal/${zonaClean}/`
            }

            const scrapePayload = {
              zona: job.zona,
              property_type: job.propertyType,
              portal: job.portal,
              pages: 5,
              url: targetUrl,
              jobId: job.id
            }

            try {
              const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scrapePayload)
              })

              if (res.ok) {
                // Update Job Status to Running
                await supabaseClient
                  .from('scraping_jobs')
                  .update({ status: 'Running', lastRun: new Date().getTime(), updated_at: new Date().toISOString() })
                  .eq('id', job.id)

                // Update Config Last Job Run
                await supabaseClient
                  .from('scheduler_config')
                  .update({ last_job_run: new Date().toISOString() })
                  .eq('portal', portal)

                results.push(`Triggered ${job.id}`)
              } else {
                console.error(`Webhook failed for ${job.id}: ${res.status}`)
              }
            } catch (e) {
              console.error(`Webhook error for ${job.id}:`, e)
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, triggered: results }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
