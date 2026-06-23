-- Formation 125 — groupes éditables (heure / capacité / nombre dynamiques)
-- Appliquée sur le projet PEDAGOMI (yuolnqyejxtfpxntflle) le 2026-06-23.

-- 1. Débloquer plus de 3 groupes (l'ancien CHECK limitait groupe_numero à 1,2,3)
alter table public.formation_groupes
  drop constraint if exists formation_groupes_groupe_numero_check;

-- 2. Métadonnées de groupe : heure + capacité par groupe, groupes vides possibles
create table if not exists public.formation_groupes_meta (
  calendly_event_uuid text     not null,
  numero              smallint not null,
  heure               time     not null,
  capacite            smallint not null default 6,
  date_formation      date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint formation_groupes_meta_pkey primary key (calendly_event_uuid, numero)
);

alter table public.formation_groupes_meta enable row level security;

-- Accès répliqué EXACTEMENT sur le modèle de formation_groupes (anon + authenticated)
create policy anon_all on public.formation_groupes_meta
  for all to anon using (true) with check (true);
create policy authenticated_all on public.formation_groupes_meta
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.formation_groupes_meta to anon, authenticated;

-- 3. Rendre f125_config lisible par le client navigateur (anon) — audit : aucun secret
create policy anon_read on public.f125_config
  for select to anon using (true);

-- 4. Heure par défaut du 3e groupe = 15:00 (au lieu de 18:00)
update public.f125_config
  set valeur = '15:00', updated_at = now()
  where cle = 'heure_groupe_3';
