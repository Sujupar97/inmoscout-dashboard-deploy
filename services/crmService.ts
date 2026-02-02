import { supabase, isSupabaseConfigured, Database } from '../supabase';
import { Owner, OwnerStatus } from '../types';

type OwnerRow = Database['public']['Tables']['propietarios']['Row'];
type OwnerInsert = Database['public']['Tables']['propietarios']['Insert'];
type OwnerUpdate = Database['public']['Tables']['propietarios']['Update'];

const mapDbRowToOwner = (row: OwnerRow): Owner => ({
  id: row.id,
  created_at: row.created_at,
  nombre_propietario: row.nombre_propietario,
  email: row.email,
  telefono: row.telefono,
  direccion_propiedad: row.direccion_propiedad,
  estado: row.estado as OwnerStatus,
  notas: row.notas,
  fecha_visita: row.fecha_visita,
  valor_tasacion: row.valor_tasacion,
});

export const fetchOwners = async (): Promise<Owner[]> => {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('propietarios')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching owners:', error);
    throw new Error(error.message);
  }
  if (!data) {
    return [];
  }
  return (data as OwnerRow[]).map(mapDbRowToOwner);
};

export const addOwner = async (owner: Omit<Owner, 'id' | 'created_at'>): Promise<Owner> => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured");
    
    const payload: OwnerInsert = {
        ...owner,
        estado: owner.estado || OwnerStatus.NuevoLead
    };
    
    // FIX: Cast payload to 'any' to resolve Supabase client type inference issue where parameter is incorrectly inferred as 'never'.
    const { data, error } = await supabase
      .from('propietarios')
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      console.error('Error adding owner:', error);
      throw new Error(error.message);
    }
    if (!data) {
        throw new Error("Could not create owner, no data returned.");
    }
    return mapDbRowToOwner(data as OwnerRow);
};

export const updateOwner = async (id: string, updates: Partial<Owner>): Promise<Owner> => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured");
    
    const updatePayload: OwnerUpdate = updates;

    // FIX: Resolved Supabase client type inference issue by removing the cast to 'any'.
    const { data, error } = await supabase
        .from('propietarios')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating owner:', error);
        throw new Error(error.message);
    }
    if (!data) {
        throw new Error("Could not update owner, no data returned.");
    }
    return mapDbRowToOwner(data as OwnerRow);
};