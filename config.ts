// This file contains configuration variables for the application.

// Supabase Edge Functions base URL for the scraping system.
// All scraping is handled internally via Edge Functions (no external n8n).
export const EDGE_FUNCTION_BASE_URL = 'https://lwcsouyknwbxeexektyr.supabase.co/functions/v1';

// Portal configurations for the scraping orchestrator.
export const SCRAPER_CONFIG = [
  { name: 'Zonaprop' },
  { name: 'Argenprop' },
  { name: 'MercadoLibre' },
];

// List of property types to be scraped by the orchestrator.
export const PROPERTY_TYPES: string[] = ['Departamento', 'Casa', 'PH'];

// List of zones to be scraped by the orchestrator.
export const TARGET_ZONES: string[] = [
  "Agronomía",
  "Belgrano",
  "Caballito",
  "Chacarita",
  "Coghlan",
  "Colegiales",
  "Núñez",
  "Palermo",
  "Recoleta",
  "Saavedra",
  "Villa Crespo",
  "Villa del Parque",
  "Villa Ortúzar",
  "Villa Pueyrredón",
  "Villa Urquiza",
].sort();
