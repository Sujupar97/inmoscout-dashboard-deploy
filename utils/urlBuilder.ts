import { slugify } from './slugify';

const propertyTypeMappings: { [key: string]: { [key: string]: string } } = {
  Zonaprop: {
    'Departamento': 'departamentos',
    'PH': 'ph',
    'Casa': 'casas',
  },
  Argenprop: {
    'Departamento': 'departamentos',
    'PH': 'ph',
    'Casa': 'casas',
  },
  MercadoLibre: {
    'Departamento': 'departamentos',
    'PH': 'departamentos', // MercadoLibre a menudo agrupa los PH con los departamentos
    'Casa': 'casas',
  }
};

/**
 * Constructs the correct scraping URL for a given portal, zone, and property type.
 * @param portalName The name of the portal (e.g., 'Zonaprop').
 * @param zona The name of the neighborhood (e.g., 'Belgrano').
 * @param propertyType The type of property (e.g., 'Departamento').
 * @returns The fully constructed URL for scraping.
 */
export const buildScraperUrl = (portalName: string, zona: string, propertyType: string): string => {
  const zonaSlug = slugify(zona);
  const typeSlug = propertyTypeMappings[portalName]?.[propertyType] || slugify(propertyType);

  switch (portalName) {
    case 'Zonaprop':
      // Example: https://www.zonaprop.com.ar/departamentos-venta-belgrano-orden-publicado-descendente.html
      return `https://www.zonaprop.com.ar/${typeSlug}-venta-${zonaSlug}-orden-publicado-descendente.html`;

    case 'Argenprop':
      // Example: https://www.argenprop.com/departamentos/venta/caballito?orden-masnuevos
      return `https://www.argenprop.com/${typeSlug}/venta/${zonaSlug}?orden-masnuevos`;
      
    case 'MercadoLibre':
      // Using a more modern and robust URL structure for MercadoLibre
      // Example: https://inmuebles.mercadolibre.com.ar/casas/venta/capital-federal/belgrano
      return `https://inmuebles.mercadolibre.com.ar/${typeSlug}/venta/capital-federal/${zonaSlug}`;

    default:
      console.warn(`Unknown portal name for URL building: ${portalName}`);
      return '';
  }
};