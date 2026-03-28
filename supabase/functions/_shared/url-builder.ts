/**
 * URL building utilities for the scraper Edge Functions.
 * Ported from frontend utils/urlBuilder.ts + utils/slugify.ts
 */

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
}

const PROPERTY_TYPE_MAPPINGS: Record<string, Record<string, string>> = {
  Zonaprop: { Departamento: 'departamentos', PH: 'ph', Casa: 'casas' },
  Argenprop: { Departamento: 'departamentos', PH: 'ph', Casa: 'casas' },
  MercadoLibre: { Departamento: 'departamentos', PH: 'departamentos', Casa: 'casas' },
}

/**
 * Builds the base scraping URL for page 1 of a portal/zone/type combination.
 */
export function buildScraperUrl(portal: string, zona: string, propertyType: string): string {
  const zonaSlug = slugify(zona)
  const typeSlug = PROPERTY_TYPE_MAPPINGS[portal]?.[propertyType] || slugify(propertyType)

  switch (portal) {
    case 'Zonaprop':
      return `https://www.zonaprop.com.ar/${typeSlug}-venta-${zonaSlug}-orden-publicado-descendente.html`
    case 'Argenprop':
      return `https://www.argenprop.com/${typeSlug}/venta/${zonaSlug}?orden-masnuevos`
    case 'MercadoLibre':
      return `https://inmuebles.mercadolibre.com.ar/${typeSlug}/venta/capital-federal/${zonaSlug}`
    default:
      throw new Error(`Unknown portal: ${portal}`)
  }
}

/**
 * Builds the paginated URL for page N of a listing.
 * Page 1 uses the base URL. Page 2+ appends pagination parameters.
 */
export function buildPaginatedUrl(baseUrl: string, portal: string, pageNumber: number): string {
  if (pageNumber <= 1) return baseUrl

  switch (portal) {
    case 'Zonaprop':
      // Pattern from n8n: url_base.replace('.html', '')-pagina-N.html
      return baseUrl.replace('.html', '') + `-pagina-${pageNumber}.html`

    case 'Argenprop':
      // Argenprop uses pagina-N in the URL
      const separator = baseUrl.includes('?') ? '&' : '?'
      return `${baseUrl}${separator}pagina-${pageNumber}`

    case 'MercadoLibre':
      // MercadoLibre uses _Desde_X where X = (page-1)*48 + 1
      const offset = (pageNumber - 1) * 48 + 1
      return `${baseUrl}_Desde_${offset}`

    default:
      return baseUrl
  }
}
