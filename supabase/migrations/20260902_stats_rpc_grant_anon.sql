-- Fix : la vue Conversions (et la section « Trafic & Conversion » des Stats)
-- affichait de nouveau « Aucune donnée disponible pour cette période ».
--
-- Cause : le cockpit n'utilise pas Supabase Auth (le login est un simple écran
-- côté client), donc TOUS les appels REST partent avec la clé anon → rôle
-- `anon`. Or l'EXECUTE sur get_page125_stats et get_traffic_conversion avait
-- été révoqué à `anon` (ACL réduite à postgres/authenticated/service_role).
-- PostgREST renvoyait alors 403 « permission denied for function », le front
-- passait dans le catch → data = null → état vide trompeur.
--
-- Correctif : rendre l'EXECUTE à `anon` (et `authenticated`, si un jour le
-- cockpit passe par Supabase Auth). Les fonctions restent SECURITY DEFINER
-- avec `SET search_path = ''` : le durcissement de la migration précédente
-- (20260718) est conservé.
GRANT EXECUTE ON FUNCTION public.get_page125_stats(date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_traffic_conversion(integer) TO anon, authenticated;
