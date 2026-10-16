import { createClient } from "jsr:@supabase/supabase-js@2";

// Contrôle d'accès commun aux fonctions appelées par le cockpit 125.
//
// La clé anon est publique (livrée dans le JavaScript du site) : un simple
// `verify_jwt` l'accepte, il ne suffit donc pas. On exige le jeton d'un
// UTILISATEUR connecté, puis on demande à la base s'il a accès au cockpit
// (public.f125_can_access() : f125_app_users ou admin de la paie). La fonction
// est SECURITY DEFINER et lit auth.uid() depuis le jeton : on l'appelle donc
// avec un client porteur du jeton de l'utilisateur, pas avec la service_role.

export type CockpitUser = { id: string; email: string | null };

export class AccessError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function requireCockpitUser(req: Request): Promise<CockpitUser> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) throw new AccessError("Authentification requise", 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } },
  );

  // getUser() valide le jeton auprès de GoTrue : un jeton anon n'a pas
  // d'utilisateur et est refusé ici.
  const { data: { user }, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !user) throw new AccessError("Session invalide ou expirée", 401);

  const { data: autorise, error } = await userClient.rpc("f125_can_access");
  if (error) throw new AccessError(`Contrôle d'accès impossible : ${error.message}`, 500);
  if (autorise !== true) throw new AccessError("Accès au cockpit 125 refusé", 403);

  return { id: user.id, email: user.email ?? null };
}
