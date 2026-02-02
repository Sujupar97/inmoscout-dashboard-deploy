import { PropertyStatus } from '../types';

export const propertyStatusTranslations: Record<PropertyStatus, string> = {
  [PropertyStatus.New]: "Nuevo",
  [PropertyStatus.Contacted]: "Contactado",
  [PropertyStatus.VisitScheduled]: "Visita Agendada",
  [PropertyStatus.Negotiating]: "En Negociación",
  [PropertyStatus.Acquired]: "Adquirido",
  [PropertyStatus.Discarded]: "Descartado",
};

// --- Portal ID Mapping ---

// Este mapa proporciona la conversión canónica del ID numérico del 'Portal'
// almacenado en la base de datos a un nombre legible para su uso en toda la aplicación.
// Esta es la única fuente de verdad para la correspondencia entre ID y nombre.
// 1 = Zonaprop
// 2 = Argenprop
// 3 = MercadoLibre
export const PORTAL_ID_TO_NAME_MAP: Record<number, string> = {
  1: 'Zonaprop',
  2: 'Argenprop',
  3: 'MercadoLibre',
};

/**
 * Convierte un ID numérico de portal a su correspondiente nombre en formato string.
 * Esta función garantiza que el filtro de portales funcione correctamente
 * basándose en los valores de la base de datos.
 * @param id El ID numérico de la columna 'Portal' de la base de datos.
 * @returns El nombre del portal (ej. "Zonaprop") o null si el ID no es válido o no existe.
 */
export const getPortalNameFromId = (id: number | null): string | null => {
  if (id === null || id === undefined) {
    return null;
  }
  return PORTAL_ID_TO_NAME_MAP[id] || null;
};

// A sorted list of portal names for use in UI elements like filters.
export const PORTAL_NAMES: string[] = Object.values(PORTAL_ID_TO_NAME_MAP).sort();