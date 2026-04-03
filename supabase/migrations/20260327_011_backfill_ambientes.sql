-- ============================================================================
-- Migration: Backfill ambientes from bedrooms for existing properties
-- Purpose: Previously ambientes was incorrectly stored in the bedrooms column.
--          This copies the existing values to the new ambientes column.
--          New properties scraped after this fix will have correct separate values.
-- ============================================================================

UPDATE public.propiedades
SET ambientes = bedrooms
WHERE ambientes IS NULL
  AND bedrooms IS NOT NULL;
