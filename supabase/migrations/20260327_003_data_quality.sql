-- ============================================================================
-- Migration: Data Quality Flags table and trigger
-- Purpose: Automatically flag properties with missing critical data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.data_quality_flags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  flag_type text NOT NULL CHECK (flag_type IN (
    'missing_price', 'missing_area', 'suspicious_price_per_sqm',
    'missing_location', 'missing_image'
  )),
  details text,
  resolved boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_dq_flags_property ON public.data_quality_flags (property_id);
CREATE INDEX IF NOT EXISTS idx_dq_flags_unresolved ON public.data_quality_flags (flag_type, resolved) WHERE resolved = false;

-- RLS
ALTER TABLE public.data_quality_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users"
ON public.data_quality_flags FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.data_quality_flags FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON public.data_quality_flags FOR UPDATE
TO authenticated
USING (true);

-- ============================================================================
-- Trigger: Auto-flag data quality issues on INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.flag_data_quality()
RETURNS TRIGGER AS $$
BEGIN
  -- Flag missing price
  IF NEW.precio IS NULL OR NEW.precio = 0 THEN
    INSERT INTO public.data_quality_flags (property_id, flag_type, details)
    VALUES (NEW.id, 'missing_price', 'Property inserted with no price');
  END IF;

  -- Flag missing area (both area and covered_area are null/zero)
  IF (NEW.area IS NULL OR NEW.area = 0) AND (NEW.covered_area IS NULL OR NEW.covered_area = 0) THEN
    INSERT INTO public.data_quality_flags (property_id, flag_type, details)
    VALUES (NEW.id, 'missing_area', 'Property inserted with no area data (area and covered_area both missing)');
  END IF;

  -- Flag missing location
  IF NEW.ubicacion IS NULL OR NEW.ubicacion = '' THEN
    INSERT INTO public.data_quality_flags (property_id, flag_type, details)
    VALUES (NEW.id, 'missing_location', 'Property inserted with no location');
  END IF;

  -- Flag missing image
  IF NEW.image_url IS NULL OR NEW.image_url = '' THEN
    INSERT INTO public.data_quality_flags (property_id, flag_type, details)
    VALUES (NEW.id, 'missing_image', 'Property inserted with no image URL');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_flag_data_quality
  AFTER INSERT ON public.propiedades
  FOR EACH ROW
  EXECUTE FUNCTION public.flag_data_quality();
