// This file contains configuration variables for the application.

// Configuration for the automated scraping orchestrator.
export const SCRAPER_CONFIG = [
  {
    name: 'Zonaprop',
    webhook: 'https://n8n.srv1022992.hstgr.cloud/webhook/750e883c-85ce-4995-8537-161dd63e3890'
  },
  {
    name: 'Argenprop',
    webhook: 'https://n8n.srv1022992.hstgr.cloud/webhook/5125f692-bbc2-452c-bc30-176df6f5c4c8'
  },
  {
    name: 'MercadoLibre',
    webhook: 'https://n8n.srv1022992.hstgr.cloud/webhook/750e883c-85ce-4995-8537-161dd63e3890'
  }
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