// FIX: Removed self-import of `Property` and `PropertyStatus`.
export enum PropertyStatus {
  New = "New",
  Contacted = "Contacted",
  VisitScheduled = "VisitScheduled",
  Negotiating = "Negotiating",
  Acquired = "Acquired",
  Discarded = "Discarded",
}

export interface Property {
  id: string;
  created_at: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  zona: string | null;
  link: string;
  imageUrl: string | null;
  ambientes: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  status: PropertyStatus;
  portal: string | null;
  seller_name: string | null;
  days_on_market: number | null;
  area: number | null;
  covered_area: number | null;
  uncovered_area: number | null;
  balcony_area: number | null;
  visualizaciones: number | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  is_potential_opportunity: boolean;
  // Calculated fields
  total_calculated_sqm?: number;
  calculated_price_per_sqm?: number;
  averagePricePerSqm?: number;
  discountPercentage?: number;
}

export type View = 'inventory' | 'opportunities' | 'analysis' | 'metrics' | 'orchestrator' | 'user_management' | 'anomalies';

export interface Filters {
  location: string;
  portal: string;
  minPrice: string;
  maxPrice: string;
  minDiscount: string;
  status: PropertyStatus | 'All';
  minBeds: string;
  maxBeds: string;
  minPricePerSqm: string;
  maxPricePerSqm: string;
  minPricePerTotalSqm: string;
  maxPricePerTotalSqm: string;
  minDaysOnMarket: string;
  maxDaysOnMarket: string;
  minArea: string;
  maxArea: string;
  isPotentialOpportunity: boolean;
  showOnlyDiscarded: boolean;
  propertyType: string;
  searchUrl: string;
}

export interface ChatMessage {
  id: number;
  sender: 'user' | 'ai';
  type: 'text' | 'property_list';
  text?: string;
  properties?: Pick<Property, 'id' | 'title' | 'location' | 'price'>[];
}

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  USER = "USER",
}

export interface UserProfile {
  id: string;
  email: string;
  role: Role;
  updated_at?: string | null;
}

// --- Tipos para el Orquestador de Scrapers ---
export enum ScrapingJobStatus {
  Pending = "Pending",
  Running = "Running",
  Completed = "Completed",
  Failed = "Failed",
  Paused = "Paused",
}

export interface ScrapingJob {
  id: string; // e.g., "Zonaprop-Belgrano-Departamento"
  portal: string;
  zona: string;
  propertyType: string;
  status: ScrapingJobStatus;
  lastRun?: number; // timestamp
  errorMessage?: string;
  propertiesToday?: number;
  duration?: number; // in seconds
}

// --- Tipos para el Actualizador Diario ---
export enum UpdateJobStatus {
  Pending = "Pending",
  Running = "Running",
  Completed = "Completed",
  Failed = "Failed",
}

export interface UpdateJob {
  id: string;
  portal: string;
  zona: string;
  propertyType: string;
  status: UpdateJobStatus;
  lastRun?: number;
  errorMessage?: string;
}

export interface AutomatedRun {
  id: number;
  run_date: string;
  run_time_utc: number;
  status: 'pending' | 'running' | 'completed';
  last_completed_portal: string | null;
}


// --- Tipos para el CRM ---
export enum OwnerStatus {
  NuevoLead = "Nuevo Lead",
  Contactado = "Contactado",
  VisitaAgendada = "Visita Agendada",
  Negociando = "Negociando",
  Captado = "Captado",
  Descartado = "Descartado",
}

export interface Owner {
  id: string;
  created_at: string;
  nombre_propietario: string;
  email: string | null;
  telefono: string | null;
  direccion_propiedad: string;
  estado: OwnerStatus;
  notas: string | null;
  fecha_visita: string | null;
  valor_tasacion: number | null;
}