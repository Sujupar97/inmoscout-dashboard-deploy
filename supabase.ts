import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      propiedades: {
        Row: {
          id: string;
          created_at: string;
          titulo: string;
          precio: number;
          moneda: string;
          ubicacion: string;
          zona: string | null;
          link: string;
          image_url: string | null;
          bedrooms: number | null;
          bathrooms: number | null;
          description: string | null;
          status: string;
          Portal: number | null;
          seller_name: string | null;
          dias_en_mercado: number | null;
          area: number | null;
          covered_area: number | null;
          uncovered_area: number | null;
          balcony_area: number | null;
          visualizaciones: number | null;
          latitude: number | null;
          longitude: number | null;
          "Tipo de Propiedad": string | null;
          is_potential_opportunity: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          titulo: string;
          precio: number;
          moneda: string;
          ubicacion: string;
          zona?: string | null;
          link: string;
          image_url?: string | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          description: string | null;
          status: string;
          Portal?: number | null;
          seller_name?: string | null;
          dias_en_mercado?: number | null;
          area?: number | null;
          covered_area?: number | null;
          uncovered_area?: number | null;
          balcony_area?: number | null;
          visualizaciones?: number | null;
          latitude?: number | null;
          longitude?: number | null;
          "Tipo de Propiedad"?: string | null;
          is_potential_opportunity?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          titulo?: string;
          precio?: number;
          moneda?: string;
          ubicacion?: string;
          zona?: string | null;
          link?: string;
          image_url?: string | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          description?: string | null;
          status?: string;
          Portal?: number | null;
          seller_name?: string | null;
          dias_en_mercado?: number | null;
          area?: number | null;
          covered_area?: number | null;
          uncovered_area?: number | null;
          balcony_area?: number | null;
          visualizaciones?: number | null;
          latitude?: number | null;
          longitude?: number | null;
          "Tipo de Propiedad"?: string | null;
          is_potential_opportunity?: boolean;
        };
      };
      propietarios: {
        Row: {
          id: string;
          created_at: string;
          nombre_propietario: string;
          email: string | null;
          telefono: string | null;
          direccion_propiedad: string;
          estado: string;
          notas: string | null;
          fecha_visita: string | null;
          valor_tasacion: number | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          nombre_propietario: string;
          email?: string | null;
          telefono?: string | null;
          direccion_propiedad: string;
          estado?: string;
          notas?: string | null;
          fecha_visita?: string | null;
          valor_tasacion?: number | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          nombre_propietario?: string;
          email?: string | null;
          telefono?: string | null;
          direccion_propiedad?: string;
          estado?: string;
          notas?: string | null;
          fecha_visita?: string | null;
          valor_tasacion?: number | null;
        };
      };
      scraping_jobs: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string | null;
          portal: string;
          zona: string;
          propertyType: string;
          status: string;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string | null;
          portal: string;
          zona: string;
          propertyType: string;
          status: string;
        };
        Update: {
          id?: string;
          updated_at?: string | null;
          status?: string;
        };
      };
      scheduler_config: {
        Row: {
          portal: string;
          is_active: boolean;
          frequency: number;
          last_run: string | null;
          created_at: string;
          updated_at: string;
          last_cycle_start: string | null;
          last_job_run: string | null;
        };
        Insert: {
          portal: string;
          is_active?: boolean;
          frequency?: number;
          last_run?: string | null;
          created_at?: string;
          updated_at?: string;
          last_cycle_start?: string | null;
          last_job_run?: string | null;
        };
        Update: {
          portal?: string;
          is_active?: boolean;
          frequency?: number;
          last_run?: string | null;
          created_at?: string;
          updated_at?: string;
          last_cycle_start?: string | null;
          last_job_run?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          updated_at: string | null;
          email: string;
          role: string;
        };
        Insert: {
          id: string;
          updated_at?: string | null;
          email: string;
          role: string;
        };
        Update: {
          id?: string;
          updated_at?: string | null;
          email?: string;
          role?: string;
        };
      };
    };
    Views: {
      // empty
    };
    Functions: {
      // empty
    };
    Enums: {
      // empty
    };
    CompositeTypes: {
      // empty
    };
  };
}


const supabaseUrl: string = 'https://lwcsouyknwbxeexektyr.supabase.co';
const supabaseAnonKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3Y3NvdXlrbndieGVleGVrdHlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzU1MTgsImV4cCI6MjA2ODg1MTUxOH0.HSejOE04B7PXnXYF8sOO8MFVD52hS4u7cz06IqicBmw';

const createSupabaseClient = () => {
  const isConfigured = supabaseUrl && supabaseUrl !== 'YOUR_SUPABASE_URL' && supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

  if (isConfigured) {
    try {
      // Let the Supabase client automatically detect the fetch implementation.
      // Explicitly passing `fetch` can cause issues in some environments.
      return createClient<Database>(supabaseUrl, supabaseAnonKey);
    } catch (error) {
      console.error("Error al crear el cliente de Supabase:", error);
      return null;
    }
  }

  console.warn("La URL de Supabase y la Anon Key no están configuradas. Por favor, actualiza supabase.ts");
  return null;
};

export const supabase = createSupabaseClient();
export const isSupabaseConfigured = !!supabase;