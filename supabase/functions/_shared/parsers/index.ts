/**
 * Parser registry - routes to the correct parser based on portal name.
 */

import { ListingPageResult, PropertyData } from '../types.ts'
import { parseZonapropListingPage } from './zonaprop-listing.ts'
import { parseZonapropPropertyPage } from './zonaprop-property.ts'
import { parseArgenpropListingPage } from './argenprop-listing.ts'
import { parseArgenpropPropertyPage } from './argenprop-property.ts'
import { parseMercadoLibreListingPage } from './mercadolibre-listing.ts'
import { parseMercadoLibrePropertyPage } from './mercadolibre-property.ts'

export function parseListingPage(portal: string, html: string): ListingPageResult {
  switch (portal) {
    case 'Zonaprop': return parseZonapropListingPage(html)
    case 'Argenprop': return parseArgenpropListingPage(html)
    case 'MercadoLibre': return parseMercadoLibreListingPage(html)
    default: throw new Error(`No listing parser for portal: ${portal}`)
  }
}

export function parsePropertyPage(portal: string, html: string, zona: string): PropertyData {
  switch (portal) {
    case 'Zonaprop': return parseZonapropPropertyPage(html, zona)
    case 'Argenprop': return parseArgenpropPropertyPage(html, zona)
    case 'MercadoLibre': return parseMercadoLibrePropertyPage(html, zona)
    default: throw new Error(`No property parser for portal: ${portal}`)
  }
}
