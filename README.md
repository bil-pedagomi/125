# Pedagomi 125 — Cockpit

Cockpit interne de la formation 125 : agenda des sessions, fiches élèves,
répartition des groupes, SMS (Ringover), stats et conversions.

- Front : React + Vite (`src/`), déployé sur Vercel.
- Back : Supabase, projet `yuolnqyejxtfpxntflle` — tables, vues, RPC et Edge Functions (`supabase/`).

## Développement

```bash
npm install
npm run dev      # serveur local
npm run lint
npm run build
```

Variables optionnelles (`.env.local`) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Sans elles, le front utilise le projet de production. La clé anon est publique
par nature : elle ne donne accès à aucune donnée sans connexion.

## Accès et sécurité

- **Connexion** : comptes Supabase Auth. Seuls les comptes listés dans
  `public.f125_app_users` (ou admins de `paie_app_users`) ont accès — cf.
  `public.f125_can_access()`. Pour ajouter quelqu'un : créer le compte dans
  *Authentication → Users*, puis
  `insert into public.f125_app_users (user_id) values ('<uuid>');`
- **Données** : toutes les requêtes portent le jeton de session. Les tables du
  cockpit sont protégées par les policies `cockpit_125_*` ; aucune n'est
  ouverte au rôle `anon`.
- **Edge Functions** (`supabase/functions/`) :

  | Fonction | Appelée par | Contrôle |
  |---|---|---|
  | `dashboard-125` | cockpit | jeton utilisateur + `f125_can_access()` |
  | `file-proxy` | cockpit (pièces Typeform) | jeton utilisateur + `f125_can_access()`, URLs `api.typeform.com` uniquement |
  | `send-sms-ringover` | cockpit (SmsModal) | jeton utilisateur + `f125_can_access()`, destinataires = inscrits de la session, au numéro enregistré |
  | `relance-typeform-f125-cron` | pg_cron (job `relance-typeform-f125-daily`) | `Authorization: Bearer <RELANCE_CRON_SECRET>` (secret dans Vault : `relance_cron_secret`) |

  Le contrôle étant fait dans le code, ces fonctions peuvent être déployées
  avec `--no-verify-jwt`.

## Déploiement

L'ordre compte : le front authentifié doit être en ligne **avant** que les
accès anonymes soient fermés.

1. Déployer les Edge Functions :
   ```bash
   supabase functions deploy dashboard-125 file-proxy send-sms-ringover --no-verify-jwt
   ```
2. Mettre en ligne le front (merge sur la branche de production Vercel).
3. Appliquer la migration `supabase/migrations/20261011_cockpit_125_fermeture_anon.sql`.
4. Cron des relances (indépendant des étapes 1 à 3) : appliquer
   `20261011_relance_cron_secret.sql`, recopier le secret dans la fonction, puis la déployer :
   ```bash
   # valeur : select decrypted_secret from vault.decrypted_secrets where name = 'relance_cron_secret';
   supabase secrets set RELANCE_CRON_SECRET=<valeur>
   supabase functions deploy relance-typeform-f125-cron --no-verify-jwt
   ```

Voir aussi [`docs/sms-ringover.md`](docs/sms-ringover.md).
