-- Fix: le badge "X/6 prévenu" restait à 0 car le front (clé anon) ne pouvait
-- pas lire sms_queue. sms_queue n'avait qu'une policy `authenticated_all`,
-- alors que toutes les autres tables lues par le front (formation_groupes,
-- formation_groupes_meta, f125_config) exposent une policy `anon`. L'état
-- "prévenu" de chaque élève est dérivé de cette table, donc anon a besoin d'un
-- accès en LECTURE. sms_queue est écrite exclusivement par l'edge function
-- send-sms-ringover (service_role), donc anon reçoit SELECT uniquement.
alter table public.sms_queue enable row level security;

drop policy if exists anon_read on public.sms_queue;
create policy anon_read on public.sms_queue
  for select
  to anon
  using (true);
