export interface QueueTask {
  id: number
  created_at: string
  job_id: string
  run_id: number | null
  task_type: 'scrape_listing_page' | 'scrape_property'
  portal: string
  zona: string
  property_type: string
  target_url: string
  page_number: number | null
  status: string
  attempts: number
  max_attempts: number
  error_message: string | null
  not_before: string
  locked_until: string | null
  result_data: Record<string, unknown> | null
}

export interface ListingPageResult {
  urls: string[]
  hasNextPage: boolean
}

export interface PropertyData {
  titulo: string | null
  precio: number | null
  moneda: string | null
  ubicacion: string | null
  zona: string
  link: string
  image_url: string | null
  area: number | null
  covered_area: number | null
  uncovered_area: number | null
  balcony_area: number | null
  ambientes: number | null
  bedrooms: number | null
  bathrooms: number | null
  description: string | null
  seller_name: string | null
  nombre_anunciante: string | null
  telefono_contacto: string | null
  dias_en_mercado: number | null
  visualizaciones: number | null
  latitude: number | null
  longitude: number | null
  antiguedad: string | null
  "Tipo de Propiedad": string
  Portal: number  // 1=Zonaprop, 2=Argenprop, 3=MercadoLibre
  status: string
}

export interface RunProgress {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  skipped: number
  properties_new: number
  properties_skipped: number
}

export const PORTAL_IDS: Record<string, number> = {
  'Zonaprop': 1,
  'Argenprop': 2,
  'MercadoLibre': 3,
}
