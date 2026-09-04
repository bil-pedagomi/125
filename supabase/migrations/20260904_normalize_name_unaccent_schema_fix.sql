-- Fix : TOUS les élèves d'une session recevaient les relances SMS « il manque
-- votre dossier », y compris ceux qui avaient déjà rempli le Typeform.
-- 15 SMS à tort le 03/09 (J-2) puis 15 le 04/09 (J-1) pour la formation du 05/09.
--
-- Cause — enchaînement en trois temps :
--   1. La migration 20260901190503_secu_sms_queue_and_extensions a déplacé
--      l'extension unaccent hors de public : `alter extension unaccent set
--      schema extensions`.
--   2. public.normalize_name() est figée par `SET search_path = ''` (durcissement
--      sécurité) et son corps appelait `public.unaccent(...)` en dur. Du jour au
--      lendemain la fonction lève « function public.unaccent(text) does not
--      exist », ce qui rend la vue v_125_form_matching — son unique dépendante —
--      totalement inutilisable.
--   3. Le cron relance-typeform-f125-cron lit cette vue pour savoir QUI a déjà
--      rempli son dossier. L'erreur était avalée (`const { data } = await ...`
--      sans lire `error`), data valait null, l'ensemble « a déjà rempli »
--      devenait vide — donc personne n'était exclu et tout le monde recevait le
--      SMS de relance.
--
-- Même classe de bug que 20260718_stats_rpc_search_path_fix.sql, qui avait
-- corrigé les RPC de stats mais pas cette fonction : sous search_path vide,
-- toute référence doit être qualifiée du BON schéma. unaccent vit désormais
-- dans `extensions`, pas dans `public`.
--
-- Correctif : qualifier extensions.unaccent, en conservant le durcissement.
-- Le garde-fou côté cron (ne jamais relancer sur une liste vide) est traité
-- dans l'edge function, pour que ce mode de panne ne puisse plus jamais se
-- solder par un envoi massif silencieux.

CREATE OR REPLACE FUNCTION public.normalize_name(name_input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT ARRAY_TO_STRING(
    (SELECT ARRAY_AGG(word ORDER BY word)
     FROM UNNEST(STRING_TO_ARRAY(LOWER(extensions.unaccent(TRIM(COALESCE(name_input, '')))), ' ')) AS word
     WHERE word != ''),
    ' '
  );
$function$;
