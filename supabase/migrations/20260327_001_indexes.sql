-- ============================================================================
-- Migration: Indexes for propiedades table
-- Purpose: Optimize query performance for filtered searches and dedup checks
-- ============================================================================

-- Single-column indexes for common filter fields
CREATE INDEX IF NOT EXISTS idx_propiedades_zona ON public.propiedades (zona);
CREATE INDEX IF NOT EXISTS idx_propiedades_portal ON public.propiedades ("Portal");
CREATE INDEX IF NOT EXISTS idx_propiedades_status ON public.propiedades (status);
CREATE INDEX IF NOT EXISTS idx_propiedades_tipo ON public.propiedades ("Tipo de Propiedad");
CREATE INDEX IF NOT EXISTS idx_propiedades_created_at ON public.propiedades (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_propiedades_precio ON public.propiedades (precio);

-- Dedup check: the scraper checks if a property URL already exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_propiedades_link_unique ON public.propiedades (link);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_propiedades_zona_tipo ON public.propiedades (zona, "Tipo de Propiedad");
CREATE INDEX IF NOT EXISTS idx_propiedades_zona_portal ON public.propiedades (zona, "Portal");
CREATE INDEX IF NOT EXISTS idx_propiedades_status_created ON public.propiedades (status, created_at DESC);

-- For the opportunities view: filters by price > 0, area > 0, status != Discarded
CREATE INDEX IF NOT EXISTS idx_propiedades_opportunity ON public.propiedades (status, precio, covered_area, area)
  WHERE precio > 0 AND status != 'Discarded';

-- For today's counts query
CREATE INDEX IF NOT EXISTS idx_propiedades_created_zona ON public.propiedades (created_at, zona);
