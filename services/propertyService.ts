import { supabase, isSupabaseConfigured, Database, MetricsSummary, ComparativeAnalysisData, MapProperty, DataQualitySummary, ScraperHistoryData } from '../supabase';
import { Property, PropertyStatus, Filters, View } from '../types';
import { getPortalNameFromId, PORTAL_ID_TO_NAME_MAP } from '../utils/translations';

type PropertyRow = Database['public']['Tables']['propiedades']['Row'];

// --- Portal name to DB ID mapping (reverse of translations.ts) ---
const PORTAL_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(PORTAL_ID_TO_NAME_MAP).map(([id, name]) => [name, Number(id)])
);

// ============================================================================
// SERVER-SIDE FILTERED QUERIES (New - uses RPC functions)
// ============================================================================

export interface PaginatedResult {
  data: Property[];
  totalCount: number;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

/**
 * Fetches properties with all filtering, sorting, and calculation done server-side.
 * This replaces the old pattern of fetchProperties() + client-side useMemo filtering.
 */
export const fetchFilteredProperties = async (
  filters: Filters,
  activeView: View,
  sort: SortConfig = { key: 'created_at', direction: 'desc' },
  page: number = 0,
  pageSize: number = 50
): Promise<PaginatedResult> => {
  if (!isSupabaseConfigured || !supabase) return { data: [], totalCount: 0 };

  const portalId = filters.portal !== 'All' ? PORTAL_NAME_TO_ID[filters.portal] : undefined;

  const params: Record<string, unknown> = {
    p_view: activeView === 'inventory' || activeView === 'opportunities' || activeView === 'anomalies'
      ? activeView : 'inventory',
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_sort_key: sort.key,
    p_sort_dir: sort.direction,
  };

  // Only include non-empty filter values
  if (filters.location !== 'All') params.p_zona = filters.location;
  if (portalId !== undefined) params.p_portal = portalId;
  if (filters.propertyType !== 'All') params.p_property_type = filters.propertyType;
  if (filters.status !== 'All') params.p_status = filters.status;
  if (filters.showOnlyDiscarded) params.p_show_only_discarded = true;
  if (filters.isPotentialOpportunity) params.p_is_opportunity = true;
  if (filters.searchUrl) params.p_search_url = filters.searchUrl.trim();
  if (filters.minPrice) params.p_min_price = parseFloat(filters.minPrice);
  if (filters.maxPrice) params.p_max_price = parseFloat(filters.maxPrice);
  if (filters.minDiscount) params.p_min_discount = parseFloat(filters.minDiscount);
  if (filters.minBeds) params.p_min_beds = parseInt(filters.minBeds, 10);
  if (filters.maxBeds) params.p_max_beds = parseInt(filters.maxBeds, 10);
  if (filters.minArea) params.p_min_area = parseFloat(filters.minArea);
  if (filters.maxArea) params.p_max_area = parseFloat(filters.maxArea);
  if (filters.minPricePerSqm) params.p_min_price_per_sqm = parseFloat(filters.minPricePerSqm);
  if (filters.maxPricePerSqm) params.p_max_price_per_sqm = parseFloat(filters.maxPricePerSqm);
  if (filters.minDaysOnMarket) params.p_min_days = parseInt(filters.minDaysOnMarket, 10);
  if (filters.maxDaysOnMarket) params.p_max_days = parseInt(filters.maxDaysOnMarket, 10);

  const { data, error } = await supabase.rpc('get_filtered_properties', params as any);

  if (error) {
    console.error('Error fetching filtered properties:', JSON.stringify(error, null, 2));
    throw new Error(`Error al cargar propiedades: ${error.message}`);
  }

  const result = data as unknown as { data: Property[]; totalCount: number };
  return {
    data: result.data || [],
    totalCount: result.totalCount || 0,
  };
};

// ============================================================================
// FILTER VALUES (New - uses RPC)
// ============================================================================

export interface FilterValues {
  portals: string[];
  zonas: string[];
  propertyTypes: string[];
}

/**
 * Efficiently fetches distinct filter values using a single DB query.
 * Replaces fetchUniquePortals() which used to fetch ALL rows.
 */
export const fetchFilterValues = async (): Promise<FilterValues> => {
  if (!isSupabaseConfigured || !supabase) return { portals: [], zonas: [], propertyTypes: [] };

  const { data, error } = await supabase.rpc('get_distinct_filter_values');

  if (error) {
    console.error('Error fetching filter values:', error);
    return { portals: [], zonas: [], propertyTypes: [] };
  }

  const result = data as unknown as FilterValues;
  return {
    portals: (result.portals || []).filter(Boolean).sort(),
    zonas: (result.zonas || []).filter(Boolean).sort(),
    propertyTypes: (result.propertyTypes || []).filter(Boolean).sort(),
  };
};

// ============================================================================
// ANALYTICS (New - uses RPC)
// ============================================================================

/**
 * Fetches pre-aggregated metrics from the server.
 * Replaces all the client-side calculation in MetricsView.tsx.
 */
export const fetchMetricsSummary = async (dateRange: number = 30): Promise<MetricsSummary | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc('get_metrics_summary', { p_date_range: dateRange });

  if (error) {
    console.error('Error fetching metrics summary:', error);
    return null;
  }

  return data as unknown as MetricsSummary;
};

/**
 * Fetches pre-aggregated comparative analysis data.
 */
export const fetchComparativeAnalysis = async (): Promise<ComparativeAnalysisData | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc('get_comparative_analysis');

  if (error) {
    console.error('Error fetching comparative analysis:', error);
    return null;
  }

  return data as unknown as ComparativeAnalysisData;
};

// ============================================================================
// MAP (New - lightweight query for markers)
// ============================================================================

export const fetchMapProperties = async (
  filters: Partial<Filters> = {},
  limit: number = 2000
): Promise<MapProperty[]> => {
  if (!isSupabaseConfigured || !supabase) return [];

  const params: Record<string, unknown> = { p_limit: limit };
  if (filters.location && filters.location !== 'All') params.p_zona = filters.location;
  if (filters.portal && filters.portal !== 'All') params.p_portal = PORTAL_NAME_TO_ID[filters.portal];
  if (filters.propertyType && filters.propertyType !== 'All') params.p_property_type = filters.propertyType;
  if (filters.status && filters.status !== 'All') params.p_status = filters.status;
  if (filters.showOnlyDiscarded) params.p_show_only_discarded = true;

  const { data, error } = await supabase.rpc('get_map_properties', params as any);

  if (error) {
    console.error('Error fetching map properties:', error);
    return [];
  }

  return (data as unknown as MapProperty[]) || [];
};

// ============================================================================
// DATA QUALITY (New)
// ============================================================================

export const fetchDataQualitySummary = async (): Promise<DataQualitySummary | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc('get_data_quality_summary');

  if (error) {
    console.error('Error fetching data quality summary:', error);
    return null;
  }

  return data as unknown as DataQualitySummary;
};

// ============================================================================
// SCRAPER HISTORY (New)
// ============================================================================

export const fetchScraperHistory = async (days: number = 7): Promise<ScraperHistoryData | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc('get_scraper_history', { p_days: days });

  if (error) {
    console.error('Error fetching scraper history:', error);
    return null;
  }

  return data as unknown as ScraperHistoryData;
};

// ============================================================================
// TODAY'S COUNTS (New - uses RPC)
// ============================================================================

export const fetchTodaysPropertyCountsByZone = async (): Promise<Map<string, number>> => {
  if (!isSupabaseConfigured || !supabase) return new Map();

  const { data, error } = await supabase.rpc('get_todays_counts_by_zone');

  if (error) {
    console.error("Error fetching today's property counts:", error);
    return new Map();
  }

  const counts = new Map<string, number>();
  if (data && Array.isArray(data)) {
    for (const row of data as { zona: string; count: number }[]) {
      counts.set(row.zona, row.count);
    }
  }
  return counts;
};

// ============================================================================
// MUTATIONS (Unchanged - these are already efficient)
// ============================================================================

export const updatePropertyStatus = async (propertyId: string, status: PropertyStatus): Promise<void> => {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured");

  const updateData: Database['public']['Tables']['propiedades']['Update'] = { status: status };
  const { error } = await supabase
    .from('propiedades')
    .update(updateData)
    .eq('id', propertyId);

  if (error) {
    console.error('Error updating property status:', error);
    throw new Error(error.message);
  }
};

export const bulkUpdateProperties = async (propertyIds: string[], updates: Partial<Pick<Property, 'status' | 'is_potential_opportunity'>>): Promise<void> => {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured");

  const dbUpdates: Database['public']['Tables']['propiedades']['Update'] = {};
  if (updates.status) {
    dbUpdates.status = updates.status;
  }
  if (updates.is_potential_opportunity !== undefined) {
    dbUpdates.is_potential_opportunity = updates.is_potential_opportunity;
  }

  if (Object.keys(dbUpdates).length === 0) return;

  const { error } = await supabase
    .from('propiedades')
    .update(dbUpdates)
    .in('id', propertyIds);

  if (error) {
    console.error('Error bulk updating properties:', error);
    throw new Error(error.message);
  }
};

// ============================================================================
// LEGACY (Kept as fallback during transition, will be removed)
// ============================================================================

const mapDbRowToProperty = (row: PropertyRow): Property => {
  const portalName = getPortalNameFromId(row.Portal);
  const initialDaysOnMarket = row.dias_en_mercado || 0;
  let daysSinceScraped = 0;
  if (row.created_at) {
    const scrapedDate = new Date(row.created_at);
    const today = new Date();
    scrapedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const timeDifference = today.getTime() - scrapedDate.getTime();
    daysSinceScraped = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
  }
  const dynamicDaysOnMarket = initialDaysOnMarket + Math.max(0, daysSinceScraped);

  return {
    id: row.id,
    created_at: row.created_at,
    title: row.titulo,
    price: row.precio,
    currency: row.moneda,
    location: row.ubicacion,
    zona: row.zona,
    link: row.link,
    imageUrl: row.image_url,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    description: row.description,
    status: row.status as PropertyStatus,
    portal: portalName,
    seller_name: row.seller_name,
    days_on_market: dynamicDaysOnMarket,
    area: row.area,
    covered_area: row.covered_area,
    uncovered_area: row.uncovered_area,
    balcony_area: row.balcony_area,
    visualizaciones: row.visualizaciones,
    latitude: row.latitude,
    longitude: row.longitude,
    propertyType: row['Tipo de Propiedad'],
    is_potential_opportunity: row.is_potential_opportunity,
  };
};

/** @deprecated Use fetchFilteredProperties() instead */
export const fetchProperties = async (): Promise<Property[]> => {
  if (!isSupabaseConfigured || !supabase) return [];

  const CHUNK_SIZE = 1000;
  let allProperties: PropertyRow[] = [];
  let moreData = true;
  let lastItem: PropertyRow | null = null;
  let page = 0;

  while (moreData) {
    let query = supabase
      .from('propiedades')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(CHUNK_SIZE);

    if (lastItem) {
      const createdAtFilter = new Date(lastItem.created_at).toISOString();
      query = query.or(
        `created_at.lt.${createdAtFilter},and(created_at.eq.${createdAtFilter},id.lt.${lastItem.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching properties chunk ${page}:`, JSON.stringify(error, null, 2));
      throw new Error(`Error al cargar propiedades: ${error.message || 'Unknown database error.'}`);
    }

    if (data && data.length > 0) {
      allProperties = [...allProperties, ...(data as PropertyRow[])];
      lastItem = data[data.length - 1] as PropertyRow;
    }

    if (!data || data.length < CHUNK_SIZE) {
      moreData = false;
    }

    page++;
  }

  return allProperties.map(mapDbRowToProperty);
};

/** @deprecated Use fetchFilterValues() instead */
export const fetchUniquePortals = async (): Promise<string[]> => {
  const values = await fetchFilterValues();
  return values.portals;
};
