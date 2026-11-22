// Contrôle d'accès commun aux fonctions du cockpit 125 (audit sécurité du 22/11/2026).
// Le cockpit envoie le jeton de session du compte connecté ; on demande à la base
// si ce compte a accès au cockpit (f125_can_access : f125_app_users ou admin paie).

export function jetonDe(req: Request): string {
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return bearer || url.searchParams.get('token') || '';
}

export async function accesCockpit125(req: Request): Promise<boolean> {
  const token = jetonDe(req);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!token || !url || !anon) return false;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/f125_can_access`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}
