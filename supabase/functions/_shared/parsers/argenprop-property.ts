import { PropertyData } from '../types.ts'

/**
 * Argenprop Property Page Parser
 *
 * Data sources (in order of reliability):
 *
 * 1. JSON-LD `@type: Apartment` — rooms, bedrooms, address, image, description
 * 2. Section `id="section-superficie"` — area data:
 *    Sup. Cubierta: 35 m2
 *    Sup. Total: 35 m2
 * 3. Icon features `class="basico1-icon-*"`:
 *    <li class="basico1-icon-superficie_cubierta"> 35 m² Cubierta</li>
 *    <li class="basico1-icon-cantidad_dormitorios"> 1 dormitorio</li>
 * 4. Price from `class="*price*"` elements → "USD 104.000"
 * 5. Address from `class="titlebar__address"`
 * 6. Coordinates from `data-lat` / `data-lng` attributes
 */

/** Extract first number from text */
function extractNum(text: string): number | null {
  if (!text) return null
  const match = text.match(/(\d[\d.,]*)/)
  if (!match) return null
  // Remove thousands separator (dot) but keep decimal comma
  const clean = match[1].replace(/\./g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? null : num
}

export function parseArgenpropPropertyPage(html: string, zona: string): PropertyData {
  const prop: PropertyData = {
    titulo: null, precio: null, moneda: null, ubicacion: null,
    zona, link: '', image_url: null,
    area: null, covered_area: null, uncovered_area: null, balcony_area: null,
    bedrooms: null, bathrooms: null, description: null,
    seller_name: null, nombre_anunciante: null, telefono_contacto: null,
    dias_en_mercado: null, visualizaciones: null,
    latitude: null, longitude: null, antiguedad: null,
    'Tipo de Propiedad': 'Departamento',
    Portal: 2, // Argenprop
    status: 'New',
  }

  if (!html) return prop

  try {
    // =====================================================================
    // 1. JSON-LD: Apartment schema
    // =====================================================================
    const jsonLdBlocks = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
    for (const block of jsonLdBlocks) {
      try {
        const data = JSON.parse(block[1])

        if (data['@type'] === 'Apartment' || data['@type'] === 'House' || data['@type'] === 'SingleFamilyResidence') {
          if (!prop.titulo) prop.titulo = data.description || data.name || null
          if (data.numberOfBedrooms) prop.bedrooms = parseInt(String(data.numberOfBedrooms), 10) || null
          if (data.image) prop.image_url = data.image
          if (data.address) {
            const addr = data.address
            const parts = [addr.streetAddress, addr.addressRegion, addr.addressLocality].filter(Boolean)
            if (parts.length > 0) prop.ubicacion = parts.join(', ')
          }
        }

        // VideoObject has uploadDate → days on market
        if (data['@type'] === 'VideoObject' && data.uploadDate) {
          const pubDate = new Date(data.uploadDate)
          if (!isNaN(pubDate.getTime())) {
            const diffDays = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays >= 0 && diffDays < 3650) {
              prop.dias_en_mercado = diffDays
            }
          }
        }
      } catch { /* skip invalid blocks */ }
    }

    // =====================================================================
    // 2. Title from <h1>
    // =====================================================================
    if (!prop.titulo) {
      const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/s)
      if (h1) prop.titulo = h1[1].replace(/<[^>]*>/g, '').trim()
    }

    // =====================================================================
    // 3. Price from class="*price*" elements
    // =====================================================================
    const priceMatch = html.match(/class="[^"]*price[^"]*"[^>]*>\s*(USD|U\$S|US\$)\s*([\d.]+)/i)
    if (priceMatch) {
      prop.precio = parseInt(priceMatch[2].replace(/\./g, ''), 10)
      prop.moneda = 'USD'
    }
    if (!prop.precio) {
      const altPrice = html.match(/USD\s*([\d.]+)/)
      if (altPrice) {
        prop.precio = parseInt(altPrice[1].replace(/\./g, ''), 10)
        prop.moneda = 'USD'
      }
    }

    // =====================================================================
    // 4. Area from section-superficie
    // =====================================================================
    const supSection = html.match(/id="section-superficie"([\s\S]*?)<\/section>/i)
    if (supSection) {
      const content = supSection[1]
      // Extract "Sup. Cubierta: 35 m2" and "Sup. Total: 35 m2"
      const cubierta = content.match(/Sup\.\s*Cubierta[:\s]*(\d+)\s*m/i)
      const total = content.match(/Sup\.\s*Total[:\s]*(\d+)\s*m/i)
      const descubierta = content.match(/Sup\.\s*Descubierta[:\s]*(\d+)\s*m/i)
      const balcon = content.match(/Sup\.\s*Balc[oó]n[:\s]*(\d+)\s*m/i)

      if (cubierta) prop.covered_area = parseInt(cubierta[1], 10)
      if (total) prop.area = parseInt(total[1], 10)
      if (descubierta) prop.uncovered_area = parseInt(descubierta[1], 10)
      if (balcon) prop.balcony_area = parseInt(balcon[1], 10)
    }

    // =====================================================================
    // 5. Fallback: Icon features (basico1-icon-*)
    // =====================================================================
    if (!prop.covered_area) {
      const iconCubierta = html.match(/basico1-icon-superficie_cubierta[^>]*>\s*(\d+)\s*m/i)
      if (iconCubierta) prop.covered_area = parseInt(iconCubierta[1], 10)
    }
    if (!prop.area) {
      const iconTotal = html.match(/basico1-icon-superficie_total[^>]*>\s*(\d+)\s*m/i)
      if (iconTotal) prop.area = parseInt(iconTotal[1], 10)
    }
    if (!prop.bedrooms) {
      const iconDorm = html.match(/basico1-icon-cantidad_dormitorios[^>]*>\s*(\d+)/i)
      if (iconDorm) prop.bedrooms = parseInt(iconDorm[1], 10)
    }
    if (!prop.bathrooms) {
      const iconBath = html.match(/basico1-icon-cantidad_banos[^>]*>\s*(\d+)/i)
        || html.match(/basico1-icon-cantidad_ba[^>]*>\s*(\d+)/i)
      if (iconBath) prop.bathrooms = parseInt(iconBath[1], 10)
    }

    // =====================================================================
    // 6. Address
    // =====================================================================
    if (!prop.ubicacion) {
      const addr = html.match(/class="[^"]*titlebar__address[^"]*"[^>]*>(.*?)<\//s)
      if (addr) prop.ubicacion = addr[1].replace(/<[^>]*>/g, '').trim()
    }

    // =====================================================================
    // 7. Description
    // =====================================================================
    const descMatch = html.match(/class="[^"]*description-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    if (descMatch) {
      prop.description = descMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    }

    // =====================================================================
    // 8. Image fallback
    // =====================================================================
    if (!prop.image_url) {
      const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
      if (ogImg) prop.image_url = ogImg[1]
    }

    // =====================================================================
    // 9. Coordinates from data-lat / data-lng
    // =====================================================================
    const dataLat = html.match(/data-lat[itude]*\s*=\s*"(-?\d+\.?\d*)"/)
    const dataLng = html.match(/data-lng|data-lon[gitude]*\s*=\s*"(-?\d+\.?\d*)"/)
    if (dataLat) prop.latitude = parseFloat(dataLat[1])
    if (dataLng) prop.longitude = parseFloat(dataLng[1])
    // Fallback: search in script tags
    if (!prop.latitude) {
      const scriptLat = html.match(/"lat(?:itude)?"\s*:\s*(-?\d+\.\d{4,})/)
      const scriptLng = html.match(/"lng|lon(?:gitude)?"\s*:\s*(-?\d+\.\d{4,})/)
      if (scriptLat) prop.latitude = parseFloat(scriptLat[1])
      if (scriptLng) prop.longitude = parseFloat(scriptLng[1])
    }

    // =====================================================================
    // 10. Seller / publisher
    // =====================================================================
    const sellerMatch = html.match(/class="[^"]*publisher[^"]*"[^>]*>(.*?)<\//s)
      || html.match(/class="[^"]*inmobiliaria[^"]*"[^>]*>(.*?)<\//s)
    if (sellerMatch) {
      prop.seller_name = sellerMatch[1].replace(/<[^>]*>/g, '').trim()
      prop.nombre_anunciante = prop.seller_name
    }

    // =====================================================================
    // 11. Days on market: Argenprop doesn't show this.
    //     New properties start at 0. The app adds +1 per day from created_at.
    // =====================================================================
    if (prop.dias_en_mercado === null) {
      prop.dias_en_mercado = 0
    }

    // =====================================================================
    // 12. Ensure area consistency
    // =====================================================================
    if (prop.covered_area && !prop.area) {
      prop.area = prop.covered_area
    }

  } catch (e) {
    console.error('Error parsing Argenprop property page:', e)
  }

  return prop
}
