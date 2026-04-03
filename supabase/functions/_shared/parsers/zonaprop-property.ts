/**
 * Zonaprop Property Page Parser
 * Ported from n8n workflow "02. Scrapeo de Propiedades" (Python/BeautifulSoup)
 *
 * Extracts all property data from a Zonaprop property detail page.
 * Improved: also extracts uncovered_area and balcony_area.
 */

import { PropertyData } from '../types.ts'

/** Extracts a JSON snippet from a JS object by key name */
function extractJsonSnippet(text: string, keyName: string): unknown | null {
  try {
    const pattern = new RegExp(`['"]${keyName}['"]\\s*:\\s*([\\[{])`)
    const match = pattern.exec(text)
    if (!match) return null

    const openBracket = match[1]
    const closeBracket = openBracket === '{' ? '}' : ']'
    const startIndex = match.index + match[0].length - 1

    let bracketCount = 1
    for (let i = startIndex + 1; i < text.length; i++) {
      if (text[i] === openBracket) bracketCount++
      else if (text[i] === closeBracket) bracketCount--

      if (bracketCount === 0) {
        const jsonStr = text.substring(startIndex, i + 1)
        return JSON.parse(jsonStr)
      }
    }
    return null
  } catch {
    return null
  }
}

/** Parse a number from a string like "45 m²" or "45,5 m²" */
function parseNumber(text: string | undefined | null): number | null {
  if (!text) return null
  // Remove thousands separator (dot), convert decimal comma to dot
  const str = String(text).replace(/\./g, '').replace(',', '.')
  const nums = str.match(/\d+\.?\d*/)
  if (!nums) return null
  const num = parseFloat(nums[0])
  return isNaN(num) ? null : num
}

/** Clean text: decode unicode escapes and strip HTML */
function cleanText(text: string | undefined | null): string | null {
  if (!text) return null
  try {
    // Remove HTML tags
    let cleaned = text.replace(/<[^>]*>/g, ' ')
    // Decode common unicode escapes
    cleaned = cleaned.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    cleaned = cleaned.replace(/\\n/g, ' ').replace(/\\t/g, ' ')
    return cleaned.replace(/\s+/g, ' ').trim() || null
  } catch {
    return text
  }
}

/** Base64 decode (for lat/lng) */
function b64Decode(encoded: string): string {
  try {
    return atob(encoded)
  } catch {
    return ''
  }
}

export function parseZonapropPropertyPage(html: string, zona: string): PropertyData {
  const prop: PropertyData = {
    titulo: null, precio: null, moneda: null, ubicacion: null,
    zona, link: '', image_url: null,
    area: null, covered_area: null, uncovered_area: null, balcony_area: null,
    ambientes: null, bedrooms: null, bathrooms: null, description: null,
    seller_name: null, nombre_anunciante: null, telefono_contacto: null,
    dias_en_mercado: null, visualizaciones: null,
    latitude: null, longitude: null, antiguedad: null,
    'Tipo de Propiedad': 'Departamento',
    Portal: 1, // Zonaprop
    status: 'New',
  }

  if (!html) return prop

  try {
    // Find the script containing avisoInfo (main data source)
    const scriptMatch = html.match(/const\s+avisoInfo\s+=[\s\S]*?(?=const\s+\w+\s+=|<\/script>)/s)
    const searchArea = scriptMatch ? scriptMatch[0] : html

    // --- Title ---
    const titleMatch = searchArea.match(/'postingTitle'\s*:\s*"(.*?)"/)
    if (titleMatch) prop.titulo = cleanText(titleMatch[1])

    // --- Price ---
    const pricesData = extractJsonSnippet(searchArea, 'pricesData') as Array<Record<string, unknown>> | null
    if (pricesData && Array.isArray(pricesData) && pricesData.length > 0) {
      const prices = (pricesData[0] as any)?.prices || []
      if (prices.length > 0) {
        prop.precio = prices[0]?.amount ?? null
        prop.moneda = prices[0]?.isoCode ?? null
      }
    }

    // --- Main Features (area, rooms, etc.) ---
    const mainFeatures = extractJsonSnippet(searchArea, 'mainFeatures') as Record<string, any> | null
    if (mainFeatures) {
      for (const feature of Object.values(mainFeatures)) {
        const label = (feature?.label || '').toLowerCase()
        const value = feature?.value

        if (label.includes('tot') || label.includes('total')) {
          prop.area = parseNumber(value)
        } else if (label.includes('cub') || label.includes('cubierta')) {
          prop.covered_area = parseNumber(value)
        } else if (label.includes('desc') || label.includes('descubierta')) {
          prop.uncovered_area = parseNumber(value)
        } else if (label.includes('balc') || label.includes('balcón')) {
          prop.balcony_area = parseNumber(value)
        } else if (label.includes('amb') || label.includes('ambiente')) {
          prop.ambientes = parseNumber(value)
        } else if (label.includes('dorm') || label.includes('dormitorio')) {
          prop.bedrooms = parseNumber(value)
        } else if (label.includes('baño')) {
          prop.bathrooms = parseNumber(value)
        } else if (label.includes('antigüedad') || label.includes('antiguedad')) {
          prop.antiguedad = cleanText(value)
        }
      }
    }

    // Also check generalFeatures for uncovered/balcony data as fallback
    const generalFeatures = extractJsonSnippet(searchArea, 'generalFeatures') as Record<string, any> | null
    if (generalFeatures) {
      for (const feature of Object.values(generalFeatures)) {
        const label = (feature?.label || '').toLowerCase()
        const value = feature?.value
        if (!prop.uncovered_area && (label.includes('desc') || label.includes('descubierta'))) {
          prop.uncovered_area = parseNumber(value)
        }
        if (!prop.balcony_area && (label.includes('balc') || label.includes('balcón'))) {
          prop.balcony_area = parseNumber(value)
        }
      }
    }

    // --- Image ---
    const pictures = extractJsonSnippet(searchArea, 'pictures') as Array<Record<string, string>> | null
    if (pictures && Array.isArray(pictures) && pictures.length > 0) {
      prop.image_url = pictures[0]?.resizeUrl1200x1200 || pictures[0]?.url730x532 || null
    }

    // --- Location ---
    const locationData = extractJsonSnippet(searchArea, 'location') as Record<string, any> | null
    const addressData = extractJsonSnippet(searchArea, 'address') as Record<string, any> | null
    if (addressData || locationData) {
      const parts = [
        cleanText(addressData?.name),
        cleanText(locationData?.name),
        cleanText(locationData?.parent?.name),
      ].filter(Boolean)
      prop.ubicacion = parts.join(', ') || null
    }

    // --- Lat/Lng (base64 encoded) ---
    const latMatch = html.match(/const\s+mapLatOf\s*=\s*"(.*?)"/)
    if (latMatch) {
      const decoded = b64Decode(latMatch[1])
      if (decoded) prop.latitude = parseFloat(decoded) || null
    }

    const lngMatch = html.match(/const\s+mapLngOf\s*=\s*"(.*?)"/)
    if (lngMatch) {
      const decoded = b64Decode(lngMatch[1])
      if (decoded) prop.longitude = parseFloat(decoded) || null
    }

    // Fallback: mapData object
    if (prop.latitude === null || prop.longitude === null) {
      const mapData = extractJsonSnippet(searchArea, 'mapData') as Record<string, any> | null
      if (mapData?.point) {
        prop.latitude = mapData.point.lat ?? null
        prop.longitude = mapData.point.lng ?? null
      }
    }

    // --- Publisher ---
    const publisher = extractJsonSnippet(searchArea, 'publisher') as Record<string, any> | null
    if (publisher) {
      prop.seller_name = cleanText(publisher.name)
      prop.nombre_anunciante = prop.seller_name
    }

    // --- Phone (WhatsApp) ---
    const whatsappMatch = searchArea.match(/'whatsApp':\s*'(.*?)'/)
    if (whatsappMatch && whatsappMatch[1].trim()) {
      prop.telefono_contacto = whatsappMatch[1].trim()
    }

    // --- Description ---
    const descMatch = searchArea.match(/'description'\s*:\s*"(.*?)"/s)
    if (descMatch) {
      prop.description = cleanText(descMatch[1])
    }

    // --- Days on Market ---
    const antiquityMatch = html.match(/const\s+antiquity\s*=\s*'Publicado hace (.*?)'/)
    if (antiquityMatch) {
      const text = antiquityMatch[1]
      const numMatch = text.match(/(\d+)/)
      if (numMatch) {
        const num = parseInt(numMatch[1], 10)
        if (text.includes('día')) prop.dias_en_mercado = num
        else if (text.includes('mes')) prop.dias_en_mercado = num * 30
        else if (text.includes('año')) prop.dias_en_mercado = num * 365
      }
    }

    // --- Views ---
    const viewsMatch = html.match(/const\s+usersViews\s*=\s*(\d+)/)
    if (viewsMatch) {
      prop.visualizaciones = parseInt(viewsMatch[1], 10)
    }

  } catch (e) {
    console.error('Error parsing Zonaprop property page:', e)
  }

  return prop
}
