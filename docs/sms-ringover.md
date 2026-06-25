# SMS Ringover — Formation 125

## Flux d'envoi

```
Interface Groupes → SmsModal.jsx → sendSMSViaEdgeFunction()
  → POST /functions/v1/send-sms-ringover (verify_jwt: true)
    → INSERT sms_queue (statut: pending)
    → POST Ringover API /v2/sms
    → UPDATE sms_queue (statut: sent/failed)
    → INSERT sync_log_unifie (source: ringover_sms)
  ← { sent: N, failed: N, results }
```

## Prérequis Supabase

### 1. Colonnes à ajouter sur `sms_queue`

```sql
ALTER TABLE sms_queue
  ADD COLUMN IF NOT EXISTS ringover_message_id text,
  ADD COLUMN IF NOT EXISTS erreur_message text,
  ADD COLUMN IF NOT EXISTS envoye_par uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS groupe_numero smallint;

ALTER TABLE sms_queue
  ADD CONSTRAINT sms_queue_statut_check
  CHECK (statut IN ('pending', 'sent', 'failed'));
```

### 2. Templates SMS dans `f125_config`

```sql
INSERT INTO f125_config (cle, valeur, label) VALUES
  ('sms_template_pre_formation', 'Bonjour {prenom}, pour votre formation 125 nous constituons des groupes de niveau la veille. Votre horaire de début (10h ou 14h) vous sera confirmé par SMS. Pedagomi', 'Template SMS pré-formation'),
  ('sms_template_groupe_1', 'Bonjour {prenom}, rappel formation 125 le {date} à {horaire} à l''agence Pedagomi. Véhicule : {vehicule}. Merci d''arriver 15 min avant. À bientôt !', 'Template SMS Groupe 1'),
  ('sms_template_groupe_2', 'Bonjour {prenom}, rappel formation 125 le {date} à {horaire} à l''agence Pedagomi. Véhicule : {vehicule}. Merci d''arriver 15 min avant. À bientôt !', 'Template SMS Groupe 2')
ON CONFLICT (cle) DO NOTHING;
```

### 3. RLS sur `sms_queue`

```sql
ALTER TABLE sms_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_sms_queue" ON sms_queue FOR SELECT USING (true);
```

### 4. Déployer l'Edge Function

```bash
supabase functions deploy send-sms-ringover --project-ref yuolnqyejxtfpxntflle
```

Configurer `verify_jwt: true` dans le dashboard Supabase (Settings > Edge Functions).

### 5. Secrets Supabase requis

- `RINGOVER_API_KEY` : clé API avec droits Conversations lecture+écriture
- `RINGOVER_SMS_FROM_NUMBER` : `+33755545976`

## Templates

Les templates sont stockés dans `f125_config` avec les clés :
- `sms_template_groupe_1` — message pour le créneau 10h
- `sms_template_groupe_2` — message pour le créneau 14h
- `sms_template_pre_formation` — message envoyé J-2/J-3

Variables disponibles : `{prenom}`, `{horaire}`, `{vehicule}`

Pour modifier un template : ouvrir le SmsModal depuis l'interface Groupes, éditer le texte, cliquer "Enregistrer comme template".

## Vérifier les envois

### Via l'interface

L'icône SMS de chaque élève passe en vert (CheckCircle) quand un SMS a été envoyé avec succès.

### Via SQL

```sql
SELECT telephone, prenom, statut, message, sent_at, erreur_message
FROM sms_queue
WHERE calendly_event_uuid = '<uuid>'
ORDER BY created_at DESC;
```

## Numéro expéditeur

Le numéro `+33 7 55 54 59 76` peut recevoir des réponses — surveiller dans l'interface Ringover.

Pour changer le numéro : modifier le secret `RINGOVER_SMS_FROM_NUMBER` dans le dashboard Supabase.

## Coût estimé

~0.05-0.07€ par SMS France métropolitaine (selon plan Ringover). Un message > 160 caractères = 2 SMS facturés.
