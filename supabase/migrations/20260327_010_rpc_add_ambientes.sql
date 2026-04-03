-- ============================================================================
-- Migration: Add 'ambientes' to get_filtered_properties RPC output
-- BASED EXACTLY on migration 007's working function, only adding ambientes.
-- IMPORTANT: Uses total_area (NOT uncovered_area). Same param order as 007.
-- Uses status::text (status_text) for all comparisons since status is an enum.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_filtered_properties;

CREATE OR REPLACE FUNCTION public.get_filtered_properties(
  p_view text DEFAULT 'inventory',
  p_zona text DEFAULT NULL,
  p_portal integer DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_beds integer DEFAULT NULL,
  p_max_beds integer DEFAULT NULL,
  p_min_area numeric DEFAULT NULL,
  p_max_area numeric DEFAULT NULL,
  p_min_days integer DEFAULT NULL,
  p_max_days integer DEFAULT NULL,
  p_min_price_per_sqm numeric DEFAULT NULL,
  p_max_price_per_sqm numeric DEFAULT NULL,
  p_min_discount numeric DEFAULT NULL,
  p_show_only_discarded boolean DEFAULT false,
  p_is_opportunity boolean DEFAULT false,
  p_search_url text DEFAULT NULL,
  p_sort_key text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS json AS $$
DECLARE
  result json;
BEGIN
  WITH zone_avgs AS (
    SELECT * FROM public.get_zone_averages()
  ),
  base AS (
    SELECT
      p.*,
      p.status::text AS status_text,
      CASE
        WHEN (p.covered_area IS NULL OR p.covered_area = 0) AND p.area IS NOT NULL AND p.area > 0
          THEN p.area
        ELSE
          COALESCE(p.covered_area, 0) +
          GREATEST(COALESCE(p.total_area, p.area, 0) - COALESCE(p.covered_area, 0), 0) * 0.5
      END AS total_calculated_sqm
    FROM public.propiedades p
  ),
  with_calcs AS (
    SELECT
      b.*,
      CASE WHEN b.total_calculated_sqm > 0 THEN b.precio / b.total_calculated_sqm ELSE 0 END AS calculated_price_per_sqm,
      za.avg_price_per_sqm AS average_price_per_sqm
    FROM base b
    LEFT JOIN zone_avgs za ON za.zona = b.zona AND za.property_type = b."Tipo de Propiedad"
  ),
  with_discount AS (
    SELECT
      wc.*,
      CASE
        WHEN wc.average_price_per_sqm IS NOT NULL
          AND wc.average_price_per_sqm > 0
          AND wc.calculated_price_per_sqm > 0
        THEN ROUND(((wc.calculated_price_per_sqm - wc.average_price_per_sqm) / wc.average_price_per_sqm * 100)::numeric, 2)
        ELSE NULL
      END AS discount_percentage,
      COALESCE(wc.dias_en_mercado, 0) +
        GREATEST(0, (CURRENT_DATE - (wc.created_at AT TIME ZONE 'UTC')::date)) AS dynamic_days_on_market
    FROM with_calcs wc
  ),
  filtered AS (
    SELECT *
    FROM with_discount wd
    WHERE
      CASE
        WHEN p_view = 'anomalies' THEN
          (wd.precio = 0 OR wd.total_calculated_sqm IS NULL OR wd.total_calculated_sqm = 0
           OR (wd.discount_percentage IS NOT NULL AND wd.discount_percentage >= 300))
        WHEN p_view = 'opportunities' THEN
          (wd.precio > 0
           AND wd.total_calculated_sqm IS NOT NULL AND wd.total_calculated_sqm > 0
           AND wd.calculated_price_per_sqm <= 1100 AND wd.calculated_price_per_sqm >= 290
           AND wd.status_text != 'Discarded')
        ELSE true
      END
      AND (p_search_url IS NULL OR wd.link ILIKE '%' || p_search_url || '%')
      AND (p_zona IS NULL OR wd.zona = p_zona)
      AND (p_portal IS NULL OR wd."Portal" = p_portal)
      AND (p_property_type IS NULL OR wd."Tipo de Propiedad" = p_property_type)
      AND (
        CASE
          WHEN p_show_only_discarded THEN wd.status_text = 'Discarded'
          ELSE
            wd.status_text != 'Discarded'
            AND (p_status IS NULL OR wd.status_text = p_status)
        END
      )
      AND (p_min_price IS NULL OR wd.precio >= p_min_price)
      AND (p_max_price IS NULL OR wd.precio <= p_max_price)
      AND (p_min_discount IS NULL OR (wd.discount_percentage IS NOT NULL AND wd.discount_percentage <= p_min_discount))
      AND (p_min_beds IS NULL OR (wd.bedrooms IS NOT NULL AND wd.bedrooms >= p_min_beds))
      AND (p_max_beds IS NULL OR (wd.bedrooms IS NOT NULL AND wd.bedrooms <= p_max_beds))
      AND (p_min_area IS NULL OR (wd.total_calculated_sqm IS NOT NULL AND wd.total_calculated_sqm >= p_min_area))
      AND (p_max_area IS NULL OR (wd.total_calculated_sqm IS NOT NULL AND wd.total_calculated_sqm <= p_max_area))
      AND (p_min_price_per_sqm IS NULL OR (wd.calculated_price_per_sqm IS NOT NULL AND wd.calculated_price_per_sqm >= p_min_price_per_sqm))
      AND (p_max_price_per_sqm IS NULL OR (wd.calculated_price_per_sqm IS NOT NULL AND wd.calculated_price_per_sqm <= p_max_price_per_sqm))
      AND (p_min_days IS NULL OR (wd.dynamic_days_on_market >= p_min_days))
      AND (p_max_days IS NULL OR (wd.dynamic_days_on_market <= p_max_days))
      AND (NOT p_is_opportunity OR wd.is_potential_opportunity = true)
  ),
  total AS (
    SELECT COUNT(*) AS total_count FROM filtered
  ),
  sorted AS (
    SELECT *
    FROM filtered
    ORDER BY
      CASE WHEN p_sort_key = 'created_at' AND p_sort_dir = 'desc' THEN created_at END DESC NULLS LAST,
      CASE WHEN p_sort_key = 'created_at' AND p_sort_dir = 'asc' THEN created_at END ASC NULLS LAST,
      CASE WHEN p_sort_key = 'precio' AND p_sort_dir = 'desc' THEN precio END DESC NULLS LAST,
      CASE WHEN p_sort_key = 'precio' AND p_sort_dir = 'asc' THEN precio END ASC NULLS LAST,
      CASE WHEN p_sort_key = 'discount' AND p_sort_dir = 'desc' THEN discount_percentage END DESC NULLS LAST,
      CASE WHEN p_sort_key = 'discount' AND p_sort_dir = 'asc' THEN discount_percentage END ASC NULLS LAST,
      CASE WHEN p_sort_key = 'area' AND p_sort_dir = 'desc' THEN total_calculated_sqm END DESC NULLS LAST,
      CASE WHEN p_sort_key = 'area' AND p_sort_dir = 'asc' THEN total_calculated_sqm END ASC NULLS LAST,
      CASE WHEN p_sort_key = 'days' AND p_sort_dir = 'desc' THEN dynamic_days_on_market END DESC NULLS LAST,
      CASE WHEN p_sort_key = 'days' AND p_sort_dir = 'asc' THEN dynamic_days_on_market END ASC NULLS LAST,
      CASE WHEN p_sort_key = 'price_per_sqm' AND p_sort_dir = 'desc' THEN calculated_price_per_sqm END DESC NULLS LAST,
      CASE WHEN p_sort_key = 'price_per_sqm' AND p_sort_dir = 'asc' THEN calculated_price_per_sqm END ASC NULLS LAST,
      created_at DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT json_build_object(
    'data', COALESCE((
      SELECT json_agg(json_build_object(
        'id', s.id,
        'created_at', s.created_at,
        'title', s.titulo,
        'price', s.precio,
        'currency', s.moneda,
        'location', s.ubicacion,
        'zona', s.zona,
        'link', s.link,
        'imageUrl', s.image_url,
        'ambientes', s.ambientes,
        'bedrooms', s.bedrooms,
        'bathrooms', s.bathrooms,
        'description', s.description,
        'status', s.status_text,
        'portal', CASE s."Portal"
          WHEN 1 THEN 'Zonaprop'
          WHEN 2 THEN 'Argenprop'
          WHEN 3 THEN 'MercadoLibre'
          ELSE NULL
        END,
        'seller_name', s.seller_name,
        'days_on_market', s.dynamic_days_on_market,
        'area', s.area,
        'covered_area', s.covered_area,
        'uncovered_area', GREATEST(COALESCE(s.total_area, s.area, 0) - COALESCE(s.covered_area, 0), 0),
        'balcony_area', s.balcony_area,
        'visualizaciones', s.visualizaciones,
        'latitude', s.latitude,
        'longitude', s.longitude,
        'propertyType', s."Tipo de Propiedad",
        'is_potential_opportunity', s.is_potential_opportunity,
        'total_calculated_sqm', ROUND(s.total_calculated_sqm::numeric, 2),
        'calculated_price_per_sqm', ROUND(s.calculated_price_per_sqm::numeric, 2),
        'averagePricePerSqm', ROUND(s.average_price_per_sqm::numeric, 2),
        'discountPercentage', s.discount_percentage
      ))
      FROM sorted s
    ), '[]'::json),
    'totalCount', (SELECT total_count FROM total)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

NOTIFY pgrst, 'reload schema';
