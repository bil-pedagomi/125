-- SMS : remplacer le "demain" en dur par la variable dynamique {date}.
-- Quand les groupes sont constitués plusieurs jours avant la formation, le mot
-- "demain" est faux. {date} affiche la vraie date de formation, formatée en
-- français côté front depuis calendly_events.start_time ("samedi 11 avril").
-- Variables disponibles : {prenom} {date} {horaire} {vehicule}.
-- Appliquée sur PEDAGOMI le 2026-06-25.

update public.f125_config
  set valeur = 'Bonjour {prenom}, rappel formation 125 le {date} a {horaire} a l''agence Pedagomi. Vehicule : {vehicule}. Merci d''arriver 15 min avant. A bientot !',
      updated_at = now()
  where cle in ('sms_template_groupe_1', 'sms_template_groupe_2');
