-- ============================================================================
-- FIX: Replace all references to p.uncovered_area with correct column names
-- The table has: area, covered_area, total_area, balcony_area
-- There is NO uncovered_area column. Uncovered = total_area - covered_area
-- ============================================================================

-- Helper formula used everywhere:
-- weighted_sqm = covered_area + ((total_area - covered_area) * 0.5)
-- If no covered_area, use area as fallback

-- ============================================================================
-- 1. RECREATE get_zone_averages
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_zone_averages()
RETURNS TABLE (
  zona text,
  property_type text,
  avg_price_per_sqm numeric,
  property_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH calculated AS (
    SELECT
      p.zona,
      p."Tipo de Propiedad" AS property_type,
      p.precio,
      CASE
        WHEN (p.covered_area IS NULL OR p.covered_area = 0) AND p.area IS NOT NULL AND p.area > 0
          THEN p.area
        ELSE
          COALESCE(p.covered_area, 0) +
          GREATEST(COALESCE(p.total_area, p.area, 0) - COALESCE(p.covered_area, 0), 0) * 0.5
      END AS total_sqm
    FROM public.propiedades p
    WHERE p.status != 'Discarded'
      AND p.zona IS NOT NULL
      AND p."Tipo de Propiedad" IS NOT NULL
  ),
  with_price AS (
    SELECT
      c.zona,
      c.property_type,
      CASE WHEN c.total_sqm > 0 THEN c.precio / c.total_sqm ELSE 0 END AS price_per_sqm
    FROM calculated c
    WHERE c.total_sqm > 0
      AND c.precio > 0
  )
  SELECT
    wp.zona,
    wp.property_type,
    ROUND(AVG(wp.price_per_sqm)::numeric, 2) AS avg_price_per_sqm,
    COUNT(*) AS property_count
  FROM with_price wp
  WHERE wp.price_per_sqm > 100
  GROUP BY wp.zona, wp.property_type;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 2. RECREATE get_filtered_properties
-- ============================================================================

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
        GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - wc.created_at::date))::integer) AS dynamic_days_on_market
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
           AND wd.status != 'Discarded')
        ELSE true
      END
      AND (p_search_url IS NULL OR wd.link ILIKE '%' || p_search_url || '%')
      AND (p_zona IS NULL OR wd.zona = p_zona)
      AND (p_portal IS NULL OR wd."Portal" = p_portal)
      AND (p_property_type IS NULL OR wd."Tipo de Propiedad" = p_property_type)
      AND (
        CASE
          WHEN p_show_only_discarded THEN wd.status = 'Discarded'
          ELSE
            wd.status != 'Discarded'
            AND (p_status IS NULL OR wd.status = p_status)
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
        'bedrooms', s.bedrooms,
        'bathrooms', s.bathrooms,
        'description', s.description,
        'status', s.status,
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

-- ============================================================================
-- 3. RECREATE get_metrics_summary
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_metrics_summary(p_date_range integer DEFAULT 30)
RETURNS json AS $$
DECLARE
  result json;
  start_date date;
BEGIN
  start_date := CURRENT_DATE - p_date_range;

  WITH calculated AS (
    SELECT
      p.*,
      CASE
        WHEN (p.covered_area IS NULL OR p.covered_area = 0) AND p.area IS NOT NULL AND p.area > 0
          THEN p.area
        ELSE
          COALESCE(p.covered_area, 0) +
          GREATEST(COALESCE(p.total_area, p.area, 0) - COALESCE(p.covered_area, 0), 0) * 0.5
      END AS total_sqm
    FROM public.propiedades p
    WHERE p.status != 'Discarded'
  ),
  with_price AS (
    SELECT c.*, CASE WHEN c.total_sqm > 0 THEN c.precio / c.total_sqm ELSE 0 END AS price_per_sqm
    FROM calculated c
  ),
  zone_avgs AS (
    SELECT * FROM public.get_zone_averages()
  ),
  with_discount AS (
    SELECT wp.*,
      za.avg_price_per_sqm,
      CASE WHEN za.avg_price_per_sqm IS NOT NULL AND za.avg_price_per_sqm > 0 AND wp.price_per_sqm > 0
        THEN ((wp.price_per_sqm - za.avg_price_per_sqm) / za.avg_price_per_sqm * 100)
        ELSE NULL
      END AS discount_pct
    FROM with_price wp
    LEFT JOIN zone_avgs za ON za.zona = wp.zona AND za.property_type = wp."Tipo de Propiedad"
  ),
  summary AS (
    SELECT
      COUNT(*) AS total_properties,
      COUNT(*) FILTER (WHERE discount_pct IS NOT NULL AND discount_pct < 0) AS opportunities,
      COUNT(*) FILTER (WHERE discount_pct IS NOT NULL AND discount_pct <= -30) AS strong_opportunities,
      ROUND(AVG(price_per_sqm) FILTER (WHERE price_per_sqm > 100)::numeric, 2) AS avg_price_per_sqm,
      ROUND(AVG(discount_pct) FILTER (WHERE discount_pct IS NOT NULL)::numeric, 2) AS avg_discount
    FROM with_discount
  ),
  time_series AS (
    SELECT json_agg(json_build_object('date', d.day::text, 'count', COALESCE(c.cnt, 0)) ORDER BY d.day)
    FROM generate_series(start_date, CURRENT_DATE, '1 day'::interval) AS d(day)
    LEFT JOIN (
      SELECT created_at::date AS day, COUNT(*) AS cnt
      FROM public.propiedades WHERE created_at::date >= start_date GROUP BY created_at::date
    ) c ON c.day = d.day::date
  ),
  by_zone AS (
    SELECT json_agg(json_build_object('zona', zona, 'count', cnt, 'avg_price_per_sqm', avg_pps, 'avg_discount', avg_disc) ORDER BY zona)
    FROM (
      SELECT zona, COUNT(*) AS cnt,
        ROUND(AVG(price_per_sqm) FILTER (WHERE price_per_sqm > 100)::numeric, 2) AS avg_pps,
        ROUND(AVG(discount_pct) FILTER (WHERE discount_pct IS NOT NULL)::numeric, 2) AS avg_disc
      FROM with_discount WHERE zona IS NOT NULL GROUP BY zona
    ) z
  ),
  by_portal AS (
    SELECT json_agg(json_build_object(
      'portal', CASE "Portal" WHEN 1 THEN 'Zonaprop' WHEN 2 THEN 'Argenprop' WHEN 3 THEN 'MercadoLibre' ELSE 'Unknown' END,
      'count', cnt
    ))
    FROM (SELECT "Portal", COUNT(*) AS cnt FROM with_discount WHERE "Portal" IS NOT NULL GROUP BY "Portal") p
  )
  SELECT json_build_object(
    'summary', (SELECT row_to_json(summary) FROM summary),
    'timeSeries', (SELECT * FROM time_series),
    'byZone', (SELECT * FROM by_zone),
    'byPortal', (SELECT * FROM by_portal)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. RECREATE get_comparative_analysis
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_comparative_analysis()
RETURNS json AS $$
BEGIN
  RETURN json_build_object(
    'byZoneAndType', COALESCE((
      SELECT json_agg(json_build_object(
        'zona', zona, 'propertyType', property_type, 'count', cnt,
        'avgPrice', avg_price, 'avgPricePerSqm', avg_pps, 'avgArea', avg_area,
        'minPrice', min_price, 'maxPrice', max_price
      ) ORDER BY zona, property_type)
      FROM (
        SELECT
          p.zona, p."Tipo de Propiedad" AS property_type, COUNT(*) AS cnt,
          ROUND(AVG(p.precio)::numeric, 0) AS avg_price,
          ROUND(AVG(
            CASE
              WHEN (p.covered_area IS NULL OR p.covered_area = 0) AND p.area IS NOT NULL AND p.area > 0
                THEN p.precio / p.area
              WHEN COALESCE(p.covered_area, 0) + GREATEST(COALESCE(p.total_area, p.area, 0) - COALESCE(p.covered_area, 0), 0) * 0.5 > 0
                THEN p.precio / (COALESCE(p.covered_area, 0) + GREATEST(COALESCE(p.total_area, p.area, 0) - COALESCE(p.covered_area, 0), 0) * 0.5)
              ELSE NULL
            END
          ) FILTER (WHERE p.precio > 0)::numeric, 2) AS avg_pps,
          ROUND(AVG(COALESCE(p.area, p.covered_area))::numeric, 2) AS avg_area,
          MIN(p.precio) FILTER (WHERE p.precio > 0) AS min_price,
          MAX(p.precio) AS max_price
        FROM public.propiedades p
        WHERE p.status != 'Discarded' AND p.zona IS NOT NULL AND p."Tipo de Propiedad" IS NOT NULL
        GROUP BY p.zona, p."Tipo de Propiedad"
      ) analysis
    ), '[]'::json)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5. RECREATE get_map_properties (no uncovered_area reference, just in case)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_map_properties(
  p_zona text DEFAULT NULL, p_portal integer DEFAULT NULL,
  p_property_type text DEFAULT NULL, p_status text DEFAULT NULL,
  p_show_only_discarded boolean DEFAULT false, p_limit integer DEFAULT 2000
) RETURNS json AS $$
BEGIN
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', p.id, 'latitude', p.latitude, 'longitude', p.longitude,
      'title', p.titulo, 'price', p.precio, 'currency', p.moneda,
      'zona', p.zona, 'propertyType', p."Tipo de Propiedad", 'status', p.status
    ))
    FROM public.propiedades p
    WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      AND (p_zona IS NULL OR p.zona = p_zona)
      AND (p_portal IS NULL OR p."Portal" = p_portal)
      AND (p_property_type IS NULL OR p."Tipo de Propiedad" = p_property_type)
      AND (CASE WHEN p_show_only_discarded THEN p.status = 'Discarded'
           ELSE p.status != 'Discarded' AND (p_status IS NULL OR p.status = p_status) END)
    LIMIT p_limit
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql STABLE;
