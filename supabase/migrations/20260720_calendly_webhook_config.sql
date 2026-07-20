-- Synchro temps réel des invités Calendly (webhook).
-- Table de configuration/traçabilité de l'abonnement webhook Calendly.
-- L'abonnement lui-même est créé via la fonction edge `calendly-webhook`
-- (GET ?action=register). Le webhook pousse invitee.created / invitee.canceled
-- vers cette fonction, qui upsert dans calendly_invitees en < 1 s.
-- Les triggers existants (trg_update_nb_invitees, trg_match_invitee_eleve)
-- maintiennent nb_invitees et le matching élève automatiquement.
-- Les crons calendly-sync / calendly-sync-invitees restent en filet de sécurité.

create table if not exists public.calendly_webhook_config (
  id int primary key default 1,
  subscription_uri text,
  callback_url text,
  events text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint calendly_webhook_config_singleton check (id = 1)
);

comment on table public.calendly_webhook_config is
  'Abonnement webhook Calendly (temps réel invitee.created/canceled). Une seule ligne (id=1).';
