import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://yuolnqyejxtfpxntflle.supabase.co';

// Clé anon : publique par nature (elle est dans le bundle). Elle n'ouvre plus
// aucune donnée par elle-même — depuis le passage à Supabase Auth, les tables
// du cockpit ne sont lisibles que par un compte listé dans f125_app_users.
// Elle ne sert plus qu'à identifier le projet auprès de PostgREST (header
// `apikey`) ; c'est le JWT de l'utilisateur connecté qui porte les droits.
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1b2xucXllanh0ZnB4bnRmbGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTIzNzcsImV4cCI6MjA4Nzc2ODM3N30.cktsC7ly3ImeIY_2mVmxo0phSTz3obIG3UHgl_iDa7U';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,      // la session survit à un rechargement de page
    autoRefreshToken: true,    // le token d'1h est renouvelé tout seul
    detectSessionInUrl: false, // pas de flow OAuth : login email/mot de passe
    storageKey: 'pedagomi125-auth',
  },
});

// Jeton d'accès de la session courante. Renvoie null si personne n'est connecté.
// supabase-js rafraîchit le token en tâche de fond ; on relit donc la session à
// chaque appel plutôt que de mémoriser le jeton.
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

// En-têtes PostgREST : `apikey` identifie le projet, `Authorization` porte le
// JWT de l'utilisateur (et donc ses droits RLS). Sans session, on n'envoie
// aucun jeton : la requête échoue en 401 au lieu de retomber en anon.
export async function sbHeaders(extra = {}) {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Prefer': 'return=representation',
    ...extra,
  };
}

// Le compte connecté a-t-il accès au cockpit 125 ? (f125_app_users, ou admin
// de l'app paie). Source de vérité côté base : le front ne fait que l'afficher.
export async function hasCockpitAccess() {
  const { data, error } = await supabase.rpc('f125_can_access');
  if (error) return false;
  return data === true;
}
