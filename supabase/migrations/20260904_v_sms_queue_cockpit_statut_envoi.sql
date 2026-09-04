-- Le cockpit doit pouvoir répondre à « ce groupe a-t-il déjà été prévenu ? »,
-- pour qu'Adam et Bilel ne refassent pas le travail l'un de l'autre.
--
-- Depuis 20260901190503_secu_sms_queue_and_extensions, anon n'a plus accès à
-- sms_queue — à raison : la table contient les numéros de téléphone et le
-- texte des messages, et la clé anon est publique (elle est livrée dans le
-- JavaScript du site). Résultat : les badges « X/N prévenu » et l'historique
-- affichent 0 alors que les SMS partent bien.
--
-- On expose donc le STRICT NÉCESSAIRE au suivi d'envoi, sans donnée
-- personnelle : ni téléphone, ni contenu de message, ni message d'erreur du
-- fournisseur (qui peut réémettre le numéro). Le prénom est conservé pour que
-- l'historique reste lisible — le cockpit affiche déjà les noms complets de
-- ces mêmes élèves par ailleurs.
--
-- security_invoker = false : la vue lit sms_queue avec les droits de son
-- propriétaire, ce qui laisse la table elle-même fermée à anon.
--
-- Ceci reste un correctif intermédiaire. La cible est l'authentification
-- Supabase du cockpit (voir 20260902211541_f125_cockpit_acces_authentifie,
-- dont la policy `cockpit_125_read` attend déjà des comptes connectés) : une
-- fois le front migré, cette vue et les accès anon pourront disparaître.

create or replace view public.v_sms_queue_cockpit
with (security_invoker = false) as
select
  q.id,
  q.calendly_event_uuid,
  q.invitee_uuid,
  q.prenom,
  q.groupe_numero,
  q.heure_groupe,
  q.statut,
  q.date_formation,
  q.sent_at,
  q.created_at
from public.sms_queue q;

comment on view public.v_sms_queue_cockpit is
  'Suivi d''envoi des SMS pour le cockpit 125, sans donnée personnelle '
  '(pas de téléphone, pas de contenu de message). Voir la migration '
  '20260904_v_sms_queue_cockpit_statut_envoi.';

revoke all on public.v_sms_queue_cockpit from anon, authenticated;
grant select on public.v_sms_queue_cockpit to anon, authenticated;
