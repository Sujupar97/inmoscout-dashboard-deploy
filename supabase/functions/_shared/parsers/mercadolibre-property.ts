import { PropertyData } from '../types.ts'

/**
 * MercadoLibre Property Page Parser
 *
 * PRIMARY source: JSON "specs" array embedded in the page with ALL attributes:
 *   "specs":[{"title":"Principales","attributes":[
 *     {"id":"Superficie total","text":"38 m²"},
 *     {"id":"Superficie cubierta","text":"38 m²"},
 *     {"id":"Superficie de balcón","text":"0 m²"},
 *     {"id":"Ambientes","text":"2"},
 *     {"id":"Dormitorios","text":"1"},
 *     {"id":"Baños","text":"1"},
 *     {"id":"Antigüedad","text":"50 años"}
 *   ]}]
 *
 * SECONDARY source: HTML table rows with andes-table__row class
 * TERTIARY source: JSON-LD Product schema for title/price/image
 */

/** Extract number from text like "38 m²" or "2". For ranges like "24 a 121 m²", uses the first (minimum) value */
function extractNumber(text: string): number | null {
  if (!text) return null
  const match = text.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

export function parseMercadoLibrePropertyPage(html: string, zona: string): PropertyData {
  const prop: PropertyData = {
    titulo: null, precio: null, moneda: null, ubicacion: null,
    zona, link: '', image_url: null,
    area: null, covered_area: null, uncovered_area: null, balcony_area: null,
    ambientes: null, bedrooms: null, bathrooms: null, description: null,
    seller_name: null, nombre_anunciante: null, telefono_contacto: null,
    dias_en_mercado: null, visualizaciones: null,
    latitude: null, longitude: null, antiguedad: null,
    'Tipo de Propiedad': 'Departamento',
    Portal: 3,
    status: 'New',
  }

  if (!html) return prop

  try {
    // =====================================================================
    // 1. PRIMARY: Extract from "specs" JSON (most reliable source)
    // =====================================================================
    const specsMatch = html.match(/"specs"\s*:\s*(\[\s*\{.*?\}\s*\])/s)
    if (specsMatch) {
      try {
        const specs = JSON.parse(specsMatch[1]) as Array<{ title: string; attributes: Array<{ id: string; text: string }> }>
        const attrs = new Map<string, string>()

        for (const section of specs) {
          if (section.attributes) {
            for (const attr of section.attributes) {
              attrs.set(attr.id, attr.text)
            }
          }
        }

        // Area
        const supTotal = extractNumber(attrs.get('Superficie total') || '')
        const supCubierta = extractNumber(attrs.get('Superficie cubierta') || '')
        const supBalcon = extractNumber(attrs.get('Superficie de balcón') || attrs.get('Superficie de balcon') || '')

        if (supTotal && supTotal > 0 && supTotal < 5000) prop.area = supTotal
        if (supCubierta && supCubierta > 0 && supCubierta < 5000) prop.covered_area = supCubierta
        if (supBalcon && supBalcon > 0) prop.balcony_area = supBalcon

        // Calculate uncovered: total - cubierta (if both exist)
        if (prop.area && prop.covered_area && prop.area > prop.covered_area) {
          prop.uncovered_area = prop.area - prop.covered_area
        }

        // Rooms
        const ambientes = extractNumber(attrs.get('Ambientes') || '')
        const dormitorios = extractNumber(attrs.get('Dormitorios') || '')
        const banos = extractNumber(attrs.get('Baños') || attrs.get('Banos') || '')

        if (ambientes && ambientes > 0 && ambientes < 20) prop.ambientes = ambientes
        if (dormitorios && dormitorios > 0 && dormitorios < 20) prop.bedrooms = dormitorios

        if (banos && banos > 0 && banos < 20) prop.bathrooms = banos

        // Antigüedad
        const antiguedad = attrs.get('Antigüedad') || attrs.get('Antiguedad')
        if (antiguedad) prop.antiguedad = antiguedad

      } catch { /* specs parsing failed, continue to fallbacks */ }
    }

    // =====================================================================
    // 2. SECONDARY: HTML table rows (andes-table)
    // =====================================================================
    if (!prop.covered_area) {
      const rows = html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)
      for (const rowMatch of rows) {
        const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)]
        if (cells.length >= 2) {
          const label = cells[0][1].replace(/<[^>]*>/g, '').trim()
          const value = cells[1][1].replace(/<[^>]*>/g, '').trim()

          switch (label) {
            case 'Superficie total': {
              const n = extractNumber(value); if (n && n < 5000) prop.area = n; break
            }
            case 'Superficie cubierta': {
              const n = extractNumber(value); if (n && n < 5000) prop.covered_area = n; break
            }
            case 'Superficie de balcón': {
              const n = extractNumber(value); if (n) prop.balcony_area = n; break
            }
            case 'Ambientes': {
              if (!prop.ambientes) { const n = extractNumber(value); if (n && n < 20) prop.ambientes = n }
              break
            }
            case 'Dormitorios': {
              const n = extractNumber(value); if (n && n < 20) prop.bedrooms = n; break
            }
            case 'Baños': {
              const n = extractNumber(value); if (n && n < 20) prop.bathrooms = n; break
            }
            case 'Antigüedad': {
              if (!prop.antiguedad) prop.antiguedad = value; break
            }
          }
        }
      }
    }

    // =====================================================================
    // 3. JSON-LD: title, price, image
    // =====================================================================
    const jsonLdBlocks = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
    for (const block of jsonLdBlocks) {
      try {
        const data = JSON.parse(block[1].replace(/\\u002F/g, '/'))

        if (data['@type'] === 'Product' || data['@type'] === 'RealEstateListing') {
          if (!prop.titulo) prop.titulo = data.name || null
          if (!prop.precio && data.offers) {
            prop.precio = data.offers.price || data.offers.lowPrice || null
            prop.moneda = data.offers.priceCurrency || 'USD'
          }
          if (!prop.image_url && data.image) {
            prop.image_url = Array.isArray(data.image) ? data.image[0] : data.image
          }
          if (!prop.description && data.description) {
            prop.description = data.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          }
        }

        // VideoObject uploadDate as fallback for days on market
        if (!prop.dias_en_mercado && data['@type'] === 'VideoObject' && data.uploadDate) {
          const pubDate = new Date(data.uploadDate)
          if (!isNaN(pubDate.getTime())) {
            const diffDays = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays >= 0 && diffDays < 3650) {
              prop.dias_en_mercado = diffDays
            }
          }
        }
      } catch { /* skip */ }
    }

    // =====================================================================
    // 3b. Days on market: "Publicado hace X meses/días/años"
    //     Found in subtitle field of embedded JSON
    // =====================================================================
    if (!prop.dias_en_mercado) {
      const pubMatch = html.match(/Publicado hace\s+(\d+)\s*(día|dias|mes|meses|año|años|semana|semanas)/i)
      if (pubMatch) {
        const num = parseInt(pubMatch[1], 10)
        const unit = pubMatch[2].toLowerCase()
        if (unit.startsWith('día') || unit.startsWith('dia')) {
          prop.dias_en_mercado = num
        } else if (unit.startsWith('semana')) {
          prop.dias_en_mercado = num * 7
        } else if (unit.startsWith('mes')) {
          prop.dias_en_mercado = num * 30
        } else if (unit.startsWith('año')) {
          prop.dias_en_mercado = num * 365
        }
      }
    }

    // =====================================================================
    // 4. Fallbacks for title and price
    // =====================================================================
    if (!prop.titulo) {
      const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/s)
      if (h1) prop.titulo = h1[1].replace(/<[^>]*>/g, '').trim()
    }

    if (!prop.precio) {
      const priceMatch = html.match(/US\$\s*([\d.]+)/)
      if (priceMatch) {
        prop.precio = parseInt(priceMatch[1].replace(/\./g, ''), 10)
        prop.moneda = 'USD'
      }
    }

    // =====================================================================
    // 5. Image fallback
    // =====================================================================
    if (!prop.image_url) {
      const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
      if (ogImg) prop.image_url = ogImg[1]
    }

    // =====================================================================
    // 6. Location
    // =====================================================================
    const locMeta = html.match(/<meta[^>]*name="twitter:text:ubicacion"[^>]*content="([^"]+)"/i)
    if (locMeta) {
      prop.ubicacion = locMeta[1].trim()
    }

    // =====================================================================
    // 7. Coordinates
    // =====================================================================
    const latMatch = html.match(/"latitude"\s*:\s*(-?\d+\.\d+)/)
    const lngMatch = html.match(/"longitude"\s*:\s*(-?\d+\.\d+)/)
    if (latMatch) prop.latitude = parseFloat(latMatch[1])
    if (lngMatch) prop.longitude = parseFloat(lngMatch[1])

    // =====================================================================
    // 8. Seller
    // =====================================================================
    const sellerMatch = html.match(/Publicado por\s*<[^>]*>\s*<[^>]*>([^<]+)/)
      || html.match(/"seller_name"\s*:\s*"([^"]+)"/)
    if (sellerMatch) {
      prop.seller_name = sellerMatch[1].trim()
      prop.nombre_anunciante = prop.seller_name
    }

    // =====================================================================
    // 9. Ensure area consistency
    // =====================================================================
    if (prop.covered_area && !prop.area) {
      prop.area = prop.covered_area
    }

    // Final sanity: reject absurd values
    if (prop.covered_area && prop.covered_area > 2000) {
      prop.covered_area = null
      prop.area = null
    }

  } catch (e) {
    console.error('Error parsing MercadoLibre property page:', e)
  }

  return prop
}
