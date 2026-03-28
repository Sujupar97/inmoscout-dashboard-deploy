import { ListingPageResult } from '../types.ts'

/**
 * Argenprop Listing Page Parser
 *
 * Argenprop property links follow this pattern:
 *   /departamento-en-venta-en-belgrano-1-ambiente--12134393
 * They end with --NNNNN (numeric ID)
 */

const BASE_URL = 'https://www.argenprop.com'

export function parseArgenpropListingPage(html: string): ListingPageResult {
  const result: ListingPageResult = { urls: [], hasNextPage: false }

  if (!html) return result

  try {
    // Property links end with --DIGITS (the listing ID)
    const linkRegex = /href="(\/[^"]*--\d+)"/g
    const seen = new Set<string>()
    let match

    while ((match = linkRegex.exec(html)) !== null) {
      const path = match[1]
      // Filter out non-property links (must contain "venta" or "en-")
      if (path.includes('-en-') || path.includes('venta')) {
        const url = `${BASE_URL}${path}`
        if (!seen.has(url)) {
          seen.add(url)
          result.urls.push(url)
        }
      }
    }

    // Check for next page: look for pagina-N links
    const currentPageMatch = html.match(/pagina-(\d+)/)
    const allPageLinks = [...html.matchAll(/pagina-(\d+)/g)].map(m => parseInt(m[1]))
    if (allPageLinks.length > 0) {
      const maxPage = Math.max(...allPageLinks)
      // If there are pagination links with higher page numbers, there's a next page
      result.hasNextPage = maxPage > 1
    }

    // Alternative: check for "Siguiente" text in pagination
    if (!result.hasNextPage) {
      result.hasNextPage = /siguiente/i.test(html) || /class="[^"]*pagination[^"]*next/i.test(html)
    }

  } catch (e) {
    console.error('Error parsing Argenprop listing page:', e)
  }

  return result
}
