import { supabase, isSupabaseConfigured, Database } from '../supabase';
import { Property, PropertyStatus } from '../types';
import { getPortalNameFromId } from '../utils/translations';

type PropertyRow = Database['public']['Tables']['propiedades']['Row'];

const mapDbRowToProperty = (row: PropertyRow): Property => {
  const portalName = getPortalNameFromId(row.Portal);
  
  // LÓGICA CORREGIDA: Días en Mercado
  // Antes estaba restringido solo a 'Zonaprop' y forzaba un inicio en 1.
  // Ahora aplica a TODOS los portales (incluyendo Argenprop) y comienza en 0 si es null.

  // 1. Obtener los días base. Si es null o 0, usamos 0. 
  // Esto corrige el error de asignar "1" a propiedades nuevas y maneja los nulls de Argenprop como 0.
  const initialDaysOnMarket = row.dias_en_mercado || 0;

  // 2. Calcular el número de días que han pasado desde que se extrajo la propiedad.
  let daysSinceScraped = 0;
  if (row.created_at) {
    const scrapedDate = new Date(row.created_at);
    const today = new Date();
    
    scrapedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const timeDifference = today.getTime() - scrapedDate.getTime();
    daysSinceScraped = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
  }

  // 3. El valor final es la suma base + días transcurridos.
  // Usamos Math.max(0, ...) para evitar números negativos si hay desajustes de zona horaria.
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
      // Order by a timestamp and a unique key for stable, performant pagination.
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(CHUNK_SIZE);

    if (lastItem) {
      // This is keyset/cursor-based pagination. It's much more efficient
      // than `range()` (OFFSET) for large datasets, preventing timeouts.
      // We fetch the next set of rows "after" the last one from the previous batch.
      // The logic is: WHERE (created_at < last_created_at) OR (created_at = last_created_at AND id < last_id)
      
      // FIX: The `+` in timestamptz strings can cause issues in URL filters.
      // Converting the timestamp to the standard ISO 8601 UTC format (with 'Z')
      // ensures it's parsed correctly by the database backend (PostgREST). This
      // resolves the "invalid input syntax for type timestamp" error.
      const createdAtFilter = new Date(lastItem.created_at).toISOString();
      query = query.or(
        `created_at.lt.${createdAtFilter},and(created_at.eq.${createdAtFilter},id.lt.${lastItem.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      // Improved error logging to provide more details than '[object Object]'
      console.error(`Error fetching properties chunk ${page}:`, JSON.stringify(error, null, 2));
      throw new Error(`Error al cargar propiedades: ${error.message || 'Unknown database error.'}`);
    }

    if (data && data.length > 0) {
      allProperties = [...allProperties, ...(data as PropertyRow[])];
      lastItem = data[data.length - 1] as PropertyRow;
    }
    
    // Se corrigió la condición de terminación del bucle para manejar correctamente las páginas vacías y evitar cargas infinitas.
    if (!data || data.length < CHUNK_SIZE) {
      moreData = false;
    }

    page++;
  }
  
  return allProperties.map(mapDbRowToProperty);
};


export const updatePropertyStatus = async (propertyId: string, status: PropertyStatus): Promise<void> => {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured");
  
  // FIX: Resolved Supabase client type inference issue by removing the cast to 'any'.
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

  // FIX: Resolved Supabase client type inference issue by removing the cast to 'any'.
  const { error } = await supabase
    .from('propiedades')
    .update(dbUpdates)
    .in('id', propertyIds);
    
  if (error) {
    console.error('Error bulk updating properties:', error);
    throw new Error(error.message);
  }
};

export const fetchUniquePortals = async (): Promise<string[]> => {
    if (!isSupabaseConfigured || !supabase) return [];
    
    // NOTE: This is not the most efficient way to get distinct values,
    // as it fetches all rows. An RPC function on the database would be
    // a better approach for performance with large datasets.
    const { data, error } = await supabase
        .from('propiedades')
        .select('Portal');
        
    if (error) {
        console.error('Error fetching distinct portals:', error);
        throw new Error(error.message);
    }
    if (!data) {
        return [];
    }
    
    // FIX: Cast `data` to `any[]` to work around a Supabase client type inference issue causing `p` to be typed as `never`.
    const portalIds = new Set((data as any[]).map(p => p.Portal as number | null).filter((id): id is number => id !== null));
    const portalNames = Array.from(portalIds)
        // FIX: Explicitly cast `id` to `number`. In some strict TypeScript configurations,
        // the type information from `Array.from(Set<number>)` can be lost, resulting in `id` being `unknown`.
        .map(id => getPortalNameFromId(id as number))
        .filter((name): name is string => name !== null)
        .sort();
        
    return portalNames;
};

export const fetchTodaysPropertyCountsByZone = async (): Promise<Map<string, number>> => {
  if (!isSupabaseConfigured || !supabase) return new Map();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // NOTE: This aggregates counts client-side. For very large datasets,
  // a database function (RPC) would be more performant.
  const { data, error } = await supabase
    .from('propiedades')
    .select('zona')
    .gte('created_at', todayISO);

  if (error) {
    console.error("Error fetching today's property counts:", error);
    throw new Error(error.message);
  }

  const counts = new Map<string, number>();
  if (data) {
    // FIX: Cast `data` to `any[]` to work around a Supabase client type inference issue causing `row` to be typed as `never`.
    for (const row of (data as any[])) {
      if (row.zona) {
        counts.set(row.zona, (counts.get(row.zona) || 0) + 1);
      }
    }
  }
  return counts;
};