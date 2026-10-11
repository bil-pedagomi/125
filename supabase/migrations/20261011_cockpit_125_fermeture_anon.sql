-- Cockpit 125 : fin de l'accès anonyme.
--
-- Jusqu'ici le cockpit tournait avec la clé anon, PUBLIQUE (elle est livrée
-- dans le JavaScript du site), derrière un identifiant/mot de passe vérifié
-- uniquement dans le navigateur. Toute personne lisant ce JavaScript pouvait
-- donc, sans se connecter :
--   - réécrire f125_config (dont le modèle de SMS envoyé aux élèves, l'adresse
--     et le téléphone de contact) ;
--   - lire, modifier ou vider les groupes (formation_groupes, _meta),
--     l'attribution formateur — qui alimente la paie — (f125_session_meta) et
--     l'état des cartes 125 (f125_carte_125) ;
--   - appeler les RPC de stats.
--
-- Le front se connecte désormais avec un compte Supabase Auth (bilel@…, Adam)
-- et chaque requête porte le jeton de l'utilisateur. Les policies
-- `cockpit_125_*` (migration 20260902211541_f125_cockpit_acces_authentifie,
-- fonction public.f125_can_access()) prennent le relais : on retire donc les
-- policies `anon` qui les court-circuitaient.
--
-- À appliquer APRÈS la mise en ligne du front authentifié, sinon le cockpit
-- actuellement en production perd l'accès à ses données.

-- 1. Tables du cockpit : plus aucune policy pour anon -------------------------
drop policy if exists anon_all    on public.formation_groupes;
drop policy if exists anon_all    on public.formation_groupes_meta;
drop policy if exists anon_all    on public.f125_session_meta;
drop policy if exists anon_all    on public.f125_carte_125;  -- écrite par service_role (carte-125-set) et lue par dashboard-125
drop policy if exists anon_read   on public.f125_config;
drop policy if exists anon_update on public.f125_config;

-- Défense en profondeur : même si une policy anon réapparaissait, le rôle
-- n'aurait plus de privilège sur ces tables.
revoke all on public.formation_groupes      from anon;
revoke all on public.formation_groupes_meta from anon;
revoke all on public.f125_session_meta      from anon;
revoke all on public.f125_carte_125         from anon;
revoke all on public.f125_config            from anon;

-- 2. Suivi d'envoi des SMS -----------------------------------------------------
-- La vue lisait sms_queue avec les droits de son propriétaire pour contourner
-- l'absence d'accès anon. Les comptes du cockpit ont maintenant leur propre
-- policy de lecture (sms_queue.cockpit_125_read) : la vue repasse en
-- security_invoker, et donc sous RLS — un compte authentifié sans accès au
-- cockpit (ex. un salarié de l'app paie) n'y voit plus rien.
alter view public.v_sms_queue_cockpit set (security_invoker = on);
revoke all on public.v_sms_queue_cockpit from anon;

-- 3. RPC de stats --------------------------------------------------------------
-- Annule 20260902210409_stats_rpc_grant_execute_anon : le front les appelle
-- désormais avec le jeton de l'utilisateur.
revoke execute on function public.get_page125_stats(date, date) from public, anon;
revoke execute on function public.get_traffic_conversion(integer) from public, anon;
grant execute on function public.get_page125_stats(date, date) to authenticated;
grant execute on function public.get_traffic_conversion(integer) to authenticated;
