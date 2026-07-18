-- Fix: les stats (vue Conversions + section Trafic & Conversion) affichaient
-- « Aucune donnée disponible pour cette période ».
--
-- Cause : get_page125_stats et get_traffic_conversion sont SECURITY DEFINER
-- avec `SET search_path = ''` (durcissement sécurité / advisor Supabase), mais
-- leurs corps référençaient les tables sans schéma (plausible_stats,
-- calendly_invitees, calendly_events). Sous un search_path vide, ces tables ne
-- sont pas résolues → ERROR « relation "plausible_stats" does not exist » → la
-- RPC renvoie 500 → le front met data=null → état vide.
--
-- Correctif : qualifier explicitement toutes les tables avec `public.` tout en
-- gardant `SET search_path = ''` (on conserve le durcissement sécurité).

CREATE OR REPLACE FUNCTION public.get_page125_stats(p_date_start date, p_date_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH daily_visitors AS (
    SELECT date,
           visitors,
           pageviews,
           bounce_rate,
           visit_duration,
           visits
    FROM public.plausible_stats
    WHERE page = '/formation-moto/formation-scooter-125/'
      AND date BETWEEN p_date_start AND p_date_end
  ),
  daily_inscriptions AS (
    SELECT ci.calendly_created_at::date AS date,
           COUNT(*) AS inscriptions,
           SUM(ci.payment_amount::numeric) AS ca
    FROM public.calendly_invitees ci
    JOIN public.calendly_events ce ON ci.calendly_event_id = ce.id
    WHERE ce.event_type_name IN ('Formation 125', 'Formation 125 semaine', 'Formation 125cc en semaine', 'Permis AM & 125 🛵')
      AND ci.status = 'active'
      AND ci.calendly_created_at::date BETWEEN p_date_start AND p_date_end
    GROUP BY ci.calendly_created_at::date
  )
  SELECT jsonb_build_object(
    'daily', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.date)
      FROM (
        SELECT v.date,
               v.visitors,
               v.pageviews,
               v.bounce_rate,
               v.visit_duration,
               v.visits,
               COALESCE(i.inscriptions, 0) AS inscriptions,
               COALESCE(i.ca, 0) AS ca,
               CASE WHEN v.visitors > 0
                    THEN ROUND(COALESCE(i.inscriptions, 0)::numeric / v.visitors * 100, 2)
                    ELSE 0
               END AS taux_conversion
        FROM daily_visitors v
        LEFT JOIN daily_inscriptions i ON v.date = i.date
      ) t
    ), '[]'::jsonb),
    'totals', (
      SELECT jsonb_build_object(
        'visitors', COALESCE(SUM(v.visitors), 0),
        'pageviews', COALESCE(SUM(v.pageviews), 0),
        'bounce_rate_avg', CASE WHEN COALESCE(SUM(v.visits), 0) > 0
                           THEN ROUND(SUM(v.bounce_rate * v.visits) / SUM(v.visits), 1)
                           ELSE 0 END,
        'visit_duration_avg', CASE WHEN COALESCE(SUM(v.visits), 0) > 0
                              THEN ROUND(SUM(v.visit_duration * v.visits) / SUM(v.visits), 0)
                              ELSE 0 END
      )
      FROM daily_visitors v
    ),
    'totals_inscriptions', (
      SELECT jsonb_build_object(
        'inscriptions', COALESCE(SUM(inscriptions), 0),
        'ca', COALESCE(SUM(ca), 0)
      )
      FROM daily_inscriptions
    ),
    'inscriptions_hors_plausible', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.date)
      FROM (
        SELECT ci.calendly_created_at::date AS date,
               COUNT(*) AS inscriptions,
               SUM(ci.payment_amount::numeric) AS ca
        FROM public.calendly_invitees ci
        JOIN public.calendly_events ce ON ci.calendly_event_id = ce.id
        WHERE ce.event_type_name IN ('Formation 125', 'Formation 125 semaine', 'Formation 125cc en semaine', 'Permis AM & 125 🛵')
          AND ci.status = 'active'
          AND ci.calendly_created_at::date BETWEEN p_date_start AND p_date_end
          AND ci.calendly_created_at::date NOT IN (SELECT date FROM daily_visitors)
        GROUP BY ci.calendly_created_at::date
      ) t
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_traffic_conversion(p_year integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  traffic json;
  conversions json;
  total_visitors bigint;
  total_inscrits bigint;
BEGIN
  -- Trafic : max visitors par date (dédupliqué), puis agrégé par semaine ou mois
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.period), '[]'::json)
  INTO traffic
  FROM (
    SELECT
      CASE
        WHEN p_year >= 2026 THEN to_char(DATE_TRUNC('week', date), 'YYYY-MM-DD')
        ELSE to_char(DATE_TRUNC('month', date), 'YYYY-MM-DD')
      END as period,
      SUM(max_visitors) as visiteurs,
      SUM(max_pageviews) as pageviews,
      ROUND(AVG(max_bounce_rate), 1) as bounce_rate
    FROM (
      SELECT date,
        MAX(visitors) as max_visitors,
        MAX(pageviews) as max_pageviews,
        MAX(bounce_rate) as max_bounce_rate
      FROM public.plausible_stats
      WHERE page = '/formation-moto/formation-scooter-125/'
        AND EXTRACT(YEAR FROM date) = p_year
      GROUP BY date
    ) deduped
    GROUP BY CASE
      WHEN p_year >= 2026 THEN to_char(DATE_TRUNC('week', date), 'YYYY-MM-DD')
      ELSE to_char(DATE_TRUNC('month', date), 'YYYY-MM-DD')
    END
  ) t;

  -- Inscriptions 125 par semaine/mois (date réelle = calendly_created_at)
  SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.period), '[]'::json)
  INTO conversions
  FROM (
    SELECT
      CASE
        WHEN p_year >= 2026 THEN to_char(DATE_TRUNC('week', ci.calendly_created_at::date), 'YYYY-MM-DD')
        ELSE to_char(DATE_TRUNC('month', ci.calendly_created_at::date), 'YYYY-MM-DD')
      END as period,
      COUNT(*) as inscrits
    FROM public.calendly_invitees ci
    JOIN public.calendly_events ce ON ci.calendly_event_id = ce.id
    WHERE (ce.event_type_name ILIKE '%125%'
       OR ce.event_type_name ILIKE '%scooter%'
       OR ce.event_type_name ~* '\mAM\M')
      AND ci.status != 'canceled'
      AND EXTRACT(YEAR FROM ci.calendly_created_at) = p_year
    GROUP BY CASE
      WHEN p_year >= 2026 THEN to_char(DATE_TRUNC('week', ci.calendly_created_at::date), 'YYYY-MM-DD')
      ELSE to_char(DATE_TRUNC('month', ci.calendly_created_at::date), 'YYYY-MM-DD')
    END
  ) c;

  -- Totaux pour KPI
  SELECT COALESCE(SUM(max_visitors), 0) INTO total_visitors
  FROM (
    SELECT MAX(visitors) as max_visitors
    FROM public.plausible_stats
    WHERE page = '/formation-moto/formation-scooter-125/'
      AND EXTRACT(YEAR FROM date) = p_year
    GROUP BY date
  ) d;

  SELECT COUNT(*) INTO total_inscrits
  FROM public.calendly_invitees ci
  JOIN public.calendly_events ce ON ci.calendly_event_id = ce.id
  WHERE (ce.event_type_name ILIKE '%125%'
     OR ce.event_type_name ILIKE '%scooter%'
     OR ce.event_type_name ~* '\mAM\M')
    AND ci.status != 'canceled'
    AND EXTRACT(YEAR FROM ci.calendly_created_at) = p_year;

  RETURN json_build_object(
    'traffic', traffic,
    'conversions', conversions,
    'total_visitors', total_visitors,
    'total_inscrits', total_inscrits
  );
END;
$function$;
