/**
 * Zonaprop Listing Page Parser
 * Ported from n8n workflow "01. Scrapeo PÁGINAS INICIALES" (Python/BeautifulSoup)
 *
 * Extracts property URLs from the preloaded JSON state and detects pagination.
 */

import { ListingPageResult } from '../types.ts'

const BASE_URL = 'https://www.zonaprop.com.ar'

export function parseZonapropListingPage(html: string): ListingPageResult {
  const result: ListingPageResult = { urls: [], hasNextPage: false }

  if (!html) return result

  try {
    // --- 1. Extract URLs from preloaded JSON state ---
    // The n8n code finds <script id="preloadedData"> and extracts window.__PRELOADED_STATE__
    const preloadedMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{.*?\});/s)
    if (preloadedMatch) {
      // Clean control characters that break JSON.parse
      const cleaned = preloadedMatch[1].replace(/[\x00-\x1f\x7f]/g, '')
      const jsonData = JSON.parse(cleaned)
      const postings = jsonData?.listStore?.listPostings || []

      for (const posting of postings) {
        const relativeUrl = posting?.url
        if (relativeUrl && typeof relativeUrl === 'string') {
          result.urls.push(`${BASE_URL}${relativeUrl}`)
        }
      }
    }

    // --- 2. Detect "Next" button ---
    // The n8n code checks for: <a data-qa="PAGING_NEXT">
    result.hasNextPage = html.includes('data-qa="PAGING_NEXT"')

  } catch (e) {
    console.error('Error parsing Zonaprop listing page:', e)
  }

  return result
}
