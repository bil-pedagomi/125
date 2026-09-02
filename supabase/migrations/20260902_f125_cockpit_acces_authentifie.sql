-- Le cockpit 125 passe sur Supabase Auth : il n'utilise plus le rôle `anon`.
--
-- Contexte : le « login » du cockpit était un écran côté client avec
-- identifiant/mot de passe écrits en clair dans le bundle JS. Toutes les
-- requêtes partaient donc avec la clé anon, elle aussi publique — n'importe
-- qui pouvait lire les données. La passe de durcissement du 01/09
-- (secu_functions_revoke_anon, secu_sms_queue_and_extensions) a fermé `anon`,
-- ce qui a cassé Conversions, la section Trafic des Stats et l'historique SMS.
--
-- Plutôt que de rouvrir `anon`, on branche le cockpit sur l'authentification
-- déjà utilisée par l'app paie : chacun se connecte avec son compte, et c'est
-- la base qui décide de l'accès.
--
-- Cette migration est ADDITIVE : les policies anon_* restent en place le temps
-- que le nouveau front soit déployé. Elles sont supprimées ensuite par
-- 20260902_f125_verrouillage_anon.sql.

create table if not exists public.f125_app_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  label      text,
  created_at timestamptz not null default now()
);

alter table public.f125_app_users enable row level security;

-- Chacun peut vérifier sa propre ligne ; la gestion se fait en service_role.
drop policy if exists f125_app_users_self_read on public.f125_app_users;
create policy f125_app_users_self_read on public.f125_app_users
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.f125_app_users to authenticated;

-- Prédicat d'accès au cockpit : membre déclaré OU admin de l'app paie.
create or replace function public.f125_can_access()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.f125_app_users where user_id = (select auth.uid())
  ) or public.paie_is_admin();
$$;

revoke execute on function public.f125_can_access() from public, anon;
grant execute on function public.f125_can_access() to authenticated, service_role;

-- Tables pilotées par le cockpit : lecture + écriture pour les comptes cockpit.
do $$
declare t text;
begin
  foreach t in array array[
    'f125_config','f125_session_meta','formation_groupes','formation_groupes_meta'
  ]
  loop
    execute format('drop policy if exists cockpit_125_all on public.%I', t);
    execute format(
      'create policy cockpit_125_all on public.%I for all to authenticated '
      'using (public.f125_can_access()) with check (public.f125_can_access())', t);
  end loop;
end $$;

-- Historique SMS : lecture seule (l'envoi passe par l'edge function en service_role).
drop policy if exists cockpit_125_read on public.sms_queue;
create policy cockpit_125_read on public.sms_queue
  for select to authenticated
  using (public.f125_can_access());

-- Statistiques Plausible : lecture seule.
drop policy if exists cockpit_125_read on public.plausible_stats;
create policy cockpit_125_read on public.plausible_stats
  for select to authenticated
  using (public.f125_can_access());

-- Les personnes qui utilisaient le cockpit avant, chacune avec son compte.
insert into public.f125_app_users (user_id, label)
select id, email from auth.users
where email in ('bilel@pedagomi.com', 'benabbes@hotmail.fr')
on conflict (user_id) do nothing;
