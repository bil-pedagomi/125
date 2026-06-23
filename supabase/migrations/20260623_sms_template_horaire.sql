-- SMS : rendre les templates de groupe indépendants de l'heure en dur.
-- L'heure réelle du groupe est désormais injectée via la variable {horaire}
-- (le front sélectionne un template canonique, indépendant du numéro de groupe
--  qui est renuméroté chronologiquement). Appliquée sur PEDAGOMI le 2026-06-23.

update public.f125_config
  set valeur = 'Bonjour {prenom}, rappel formation 125 demain a {horaire} a l''agence Pedagomi. Vehicule : {vehicule}. Merci d''arriver 15 min avant. A demain !',
      updated_at = now()
  where cle in ('sms_template_groupe_1', 'sms_template_groupe_2');
