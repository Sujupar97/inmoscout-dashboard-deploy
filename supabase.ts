import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Property } from './types';

// --- RPC Return Types ---

export interface MetricsSummary {
  summary: {
    total_properties: number;
    opportunities: number;
    strong_opportunities: number;
    avg_price_per_sqm: number;
    avg_discount: number;
  };
  timeSeries: { date: string; count: number }[];
  byZone: { zona: string; count: number; avg_price_per_sqm: number; avg_discount: number }[];
  byPortal: { portal: string; count: number }[];
}

export interface ComparativeAnalysisData {
  byZoneAndType: {
    zona: string;
    propertyType: string;
    count: number;
    avgPrice: number;
    avgPricePerSqm: number;
    avgArea: number;
    minPrice: number;
    maxPrice: number;
  }[];
}

export interface MapProperty {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  price: number;
  currency: string;
  zona: string;
  propertyType: string;
  status: string;
}

export interface DataQualitySummary {
  totalFlags: number;
  byType: { type: string; count: number }[];
  recentFlags: {
    id: number;
    property_id: string;
    flag_type: string;
    details: string;
    created_at: string;
    property_title: string;
    property_link: string;
    property_zona: string;
  }[];
}

export interface ScraperHistoryData {
  runs: {
    id: number;
    created_at: string;
    portal: string;
    zona: string;
    property_type: string;
    status: string;
    properties_found: number;
    properties_new: number;
    properties_skipped: number;
    properties_failed: number;
    duration_seconds: number;
    error_message: string | null;
  }[];
  dailySummary: {
    date: string;
    total_new: number;
    total_skipped: number;
    total_failed: number;
    total_runs: number;
  }[];
  byPortal: {
    portal: string;
    total_runs: number;
    total_new: number;
    avg_duration: number;
  }[];
}

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
      automated_scraper_runs: {
        Row: {
          id: number;
          run_date: string;
          run_time_utc: number;
          status: string;
          last_completed_portal: string | null;
        };
        Insert: {
          id?: number;
          run_date: string;
          run_time_utc: number;
          status?: string;
          last_completed_portal?: string | null;
        };
        Update: {
          status?: string;
          last_completed_portal?: string | null;
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
      scraper_run_log: {
        Row: {
          id: number;
          created_at: string;
          portal: string;
          zona: string;
          property_type: string;
          job_id: string | null;
          status: string;
          properties_found: number;
          properties_new: number;
          properties_skipped: number;
          properties_failed: number;
          error_message: string | null;
          duration_seconds: number | null;
          completed_at: string | null;
        };
        Insert: {
          id?: never;
          created_at?: string;
          portal: string;
          zona: string;
          property_type: string;
          job_id?: string | null;
          status?: string;
          properties_found?: number;
          properties_new?: number;
          properties_skipped?: number;
          properties_failed?: number;
          error_message?: string | null;
          duration_seconds?: number | null;
          completed_at?: string | null;
        };
        Update: {
          status?: string;
          properties_found?: number;
          properties_new?: number;
          properties_skipped?: number;
          properties_failed?: number;
          error_message?: string | null;
          duration_seconds?: number | null;
          completed_at?: string | null;
        };
      };
      scraper_queue: {
        Row: {
          id: number;
          created_at: string;
          job_id: string;
          run_id: number | null;
          task_type: string;
          portal: string;
          zona: string;
          property_type: string;
          target_url: string;
          page_number: number | null;
          status: string;
          attempts: number;
          max_attempts: number;
          error_message: string | null;
          not_before: string;
          locked_until: string | null;
          result_data: Record<string, unknown> | null;
        };
        Insert: {
          id?: never;
          created_at?: string;
          job_id: string;
          run_id?: number | null;
          task_type: string;
          portal: string;
          zona: string;
          property_type: string;
          target_url: string;
          page_number?: number | null;
          status?: string;
          not_before?: string;
        };
        Update: {
          status?: string;
          attempts?: number;
          error_message?: string | null;
          locked_until?: string | null;
          not_before?: string;
          result_data?: Record<string, unknown> | null;
        };
      };
      data_quality_flags: {
        Row: {
          id: number;
          property_id: string;
          created_at: string;
          flag_type: string;
          details: string | null;
          resolved: boolean;
        };
        Insert: {
          id?: never;
          property_id: string;
          created_at?: string;
          flag_type: string;
          details?: string | null;
          resolved?: boolean;
        };
        Update: {
          resolved?: boolean;
          details?: string | null;
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
      get_filtered_properties: {
        Args: {
          p_view?: string;
          p_zona?: string;
          p_portal?: number;
          p_status?: string;
          p_property_type?: string;
          p_min_price?: number;
          p_max_price?: number;
          p_min_beds?: number;
          p_max_beds?: number;
          p_min_area?: number;
          p_max_area?: number;
          p_min_days?: number;
          p_max_days?: number;
          p_min_price_per_sqm?: number;
          p_max_price_per_sqm?: number;
          p_min_discount?: number;
          p_show_only_discarded?: boolean;
          p_is_opportunity?: boolean;
          p_search_url?: string;
          p_sort_key?: string;
          p_sort_dir?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          data: Property[];
          totalCount: number;
        };
      };
      get_zone_averages: {
        Args: Record<string, never>;
        Returns: { zona: string; property_type: string; avg_price_per_sqm: number; property_count: number }[];
      };
      get_metrics_summary: {
        Args: { p_date_range?: number };
        Returns: MetricsSummary;
      };
      get_distinct_filter_values: {
        Args: Record<string, never>;
        Returns: { portals: string[]; zonas: string[]; propertyTypes: string[] };
      };
      get_todays_counts_by_zone: {
        Args: Record<string, never>;
        Returns: { zona: string; count: number }[];
      };
      get_comparative_analysis: {
        Args: Record<string, never>;
        Returns: ComparativeAnalysisData;
      };
      get_map_properties: {
        Args: {
          p_zona?: string;
          p_portal?: number;
          p_property_type?: string;
          p_status?: string;
          p_show_only_discarded?: boolean;
          p_limit?: number;
        };
        Returns: MapProperty[];
      };
      get_data_quality_summary: {
        Args: Record<string, never>;
        Returns: DataQualitySummary;
      };
      get_scraper_history: {
        Args: { p_days?: number };
        Returns: ScraperHistoryData;
      };
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