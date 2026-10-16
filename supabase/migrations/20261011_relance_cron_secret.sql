-- Relances SMS : le cron s'authentifie.
--
-- Indépendante du front : peut être appliquée seule (avant ou après le
-- déploiement de la fonction : l'ancienne version ignore l'en-tête ajouté).
-- relance-typeform-f125-cron était appelable par n'importe qui (verify_jwt
-- false, aucun contrôle) ; `?dry_run=true` renvoyait prénoms, emails et
-- téléphones. La fonction exige maintenant `Authorization: Bearer <secret>`.
-- Le secret est généré ici, dans Vault (jamais dans git ni dans les variables
-- de la fonction) : la fonction le vérifie via la RPC relance_cron_secret_valide,
-- réservée à service_role.
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

-- Vérification côté fonction, sans exposer la valeur du secret.
create or replace function public.relance_cron_secret_valide(p_secret text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(length(p_secret) >= 32, false) and exists (
    select 1 from vault.decrypted_secrets
    where name = 'relance_cron_secret' and decrypted_secret = p_secret
  );
$function$;

revoke execute on function public.relance_cron_secret_valide(text) from public, anon, authenticated;
grant execute on function public.relance_cron_secret_valide(text) to service_role;
