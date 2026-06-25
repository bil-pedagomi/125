-- BUG : le bouton "Enregistrer comme template" (modale SMS) ne persistait pas.
-- Le front utilise la clé anon et fait un PATCH sur f125_config, mais la table
-- n'avait qu'une policy anon SELECT (anon_read). PostgREST renvoyait alors 200
-- en mettant à jour 0 ligne (RLS) → aucune erreur, UI "ok", mais rien d'écrit.
--
-- Les tables opérationnelles déjà écrites depuis le front (formation_groupes,
-- formation_groupes_meta) ont une policy anon_all ; f125_config était la seule
-- exception en lecture seule. On aligne en autorisant l'UPDATE anon (aucun
-- secret dans cette table). Pas d'INSERT/DELETE anon : les clés préexistent et
-- le front ne fait que des PATCH (UPDATE).
-- Appliquée sur PEDAGOMI le 2026-06-25.

do $$
begin
  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.f125_config'::regclass and polname = 'anon_update'
  ) then
    create policy "anon_update" on public.f125_config
      for update to anon using (true) with check (true);
  end if;
end $$;
