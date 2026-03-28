const SCRAPER_API_BASE = 'https://api.scraperapi.com'

/**
 * Fetches a URL through ScraperAPI proxy.
 * Returns the raw HTML content of the page.
 */
export async function fetchViaScraperApi(targetUrl: string): Promise<string> {
  const apiKey = Deno.env.get('SCRAPER_API_KEY')
  if (!apiKey) {
    throw new Error('SCRAPER_API_KEY environment variable is not set')
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    url: targetUrl,
  })

  const response = await fetch(`${SCRAPER_API_BASE}?${params.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'text/html' },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`ScraperAPI error ${response.status}: ${errorText}`)
  }

  return await response.text()
}
