import { ListingPageResult } from '../types.ts'

/**
 * MercadoLibre Listing Page Parser
 *
 * MercadoLibre property links follow this pattern:
 *   https://departamento.mercadolibre.com.ar/MLA-1234567890-description_JM
 * The domain varies (departamento, casa, etc.) but always contains MLA-DIGITS
 */

export function parseMercadoLibreListingPage(html: string): ListingPageResult {
  const result: ListingPageResult = { urls: [], hasNextPage: false }

  if (!html) return result

  try {
    // MLA links: https://SUBDOMAIN.mercadolibre.com.ar/MLA-NNNNNNN-description_JM
    const linkRegex = /href="(https:\/\/[^"]*\.mercadolibre\.com\.ar\/MLA-\d+[^"]*?)"/g
    const seen = new Set<string>()
    let match

    while ((match = linkRegex.exec(html)) !== null) {
      // Clean URL: remove tracking fragments (#polycard_client...) and query params
      let url = match[1].split('#')[0]
      // Keep the base URL without tracking params but preserve _JM suffix
      const jmIndex = url.indexOf('_JM')
      if (jmIndex > -1) {
        url = url.substring(0, jmIndex + 3)  // Keep up to _JM
      }

      if (!seen.has(url)) {
        seen.add(url)
        result.urls.push(url)
      }
    }

    // Check for next page: "Siguiente" button or rel="next"
    result.hasNextPage = /rel="next"/i.test(html)
      || /Siguiente/i.test(html)
      || /aria-label="Siguiente"/i.test(html)

  } catch (e) {
    console.error('Error parsing MercadoLibre listing page:', e)
  }

  return result
}
