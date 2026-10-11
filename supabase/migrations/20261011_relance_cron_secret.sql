-- Relances SMS : le cron s'authentifie.
--
-- Indépendante du front : peut être appliquée seule, à condition de recopier
-- AUSSITÔT le secret dans la fonction (sinon les relances sont refusées en 401).
-- relance-typeform-f125-cron était appelable par n'importe qui (verify_jwt
-- false, aucun contrôle) ; `?dry_run=true` renvoyait prénoms, emails et
-- téléphones. La fonction exige maintenant `Authorization: Bearer <secret>`.
-- Le secret est généré ici, dans Vault (jamais dans git), et doit être recopié
-- dans le secret RELANCE_CRON_SECRET de la fonction :
--   select decrypted_secret from vault.decrypted_secrets where name = 'relance_cron_secret';
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'relance_cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'relance_cron_secret',
      'Secret partagé pg_cron → edge function relance-typeform-f125-cron'
    );
  end if;
end $$;

-- cron.schedule remplace le job existant du même nom (même horaire qu'avant).
select cron.schedule(
  'relance-typeform-f125-daily',
  '0 8 * * *',
  $job$
  select net.http_post(
    url := 'https://yuolnqyejxtfpxntflle.supabase.co/functions/v1/relance-typeform-f125-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'relance_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
