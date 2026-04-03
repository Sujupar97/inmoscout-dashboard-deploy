-- ============================================================================
-- Migration: Add ambientes column to propiedades
-- Purpose: Ambientes and dormitorios are different concepts in Argentine
--          real estate. Previously ambientes was incorrectly stored as
--          bedrooms. This adds a dedicated column.
-- ============================================================================

ALTER TABLE public.propiedades ADD COLUMN IF NOT EXISTS ambientes integer;
