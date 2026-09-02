-- ⚠️ À APPLIQUER UNIQUEMENT APRÈS LE DÉPLOIEMENT DU FRONT AUTHENTIFIÉ.
--
-- Tant que la version en ligne du cockpit utilise la clé anon, appliquer ce
-- fichier casse l'application. Une fois le nouveau front déployé et une
-- connexion vérifiée, ceci ferme définitivement l'accès anonyme :
--   · plus aucune donnée 125 lisible avec la seule clé anon (publique) ;
--   · le GRANT temporaire posé sur les RPC stats pour dépanner est retiré ;
--   · seuls les comptes de f125_app_users (ou un admin paie) ont accès.

-- 1) RPC stats : retour à `authenticated` seul (état voulu par la passe
--    de durcissement du 01/09), le dépannage anon n'a plus lieu d'être.
revoke execute on function public.get_page125_stats(date, date) from anon;
revoke execute on function public.get_traffic_conversion(integer) from anon;

-- 2) Tables du cockpit : suppression des policies « ouvertes à tous ».
drop policy if exists anon_read   on public.f125_config;
drop policy if exists anon_update on public.f125_config;
drop policy if exists anon_all    on public.f125_session_meta;
drop policy if exists anon_all    on public.formation_groupes;
drop policy if exists anon_all    on public.formation_groupes_meta;
drop policy if exists anon_read   on public.plausible_stats;

-- 3) Ceinture et bretelles : retrait des droits table pour anon.
revoke all on public.f125_config            from anon;
revoke all on public.f125_session_meta      from anon;
revoke all on public.formation_groupes      from anon;
revoke all on public.formation_groupes_meta from anon;
revoke all on public.plausible_stats        from anon;
