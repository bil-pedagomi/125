// Connexion au cockpit par les comptes Supabase (Auth).
// Remplace l'ancien identifiant/mot de passe écrit dans le code (22/11/2026).
// L'accès aux données est ensuite contrôlé côté base : seuls les comptes
// inscrits dans f125_app_users (ou admins paie) passent les règles RLS.

export const SUPABASE_URL = 'https://yuolnqyejxtfpxntflle.supabase.co';
// Clé publique (anon) : elle identifie le projet, elle ne donne aucun droit seule.
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1b2xucXllanh0ZnB4bnRmbGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTIzNzcsImV4cCI6MjA4Nzc2ODM3N30.cktsC7ly3ImeIY_2mVmxo0phSTz3obIG3UHgl_iDa7U';

const STORAGE_KEY = 'pedagomi125_session';
let session = null;
let refreshing = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    session = raw ? JSON.parse(raw) : null;
  } catch {
    session = null;
  }
}

function save(s) {
  session = s;
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // stockage indisponible : la session reste en mémoire pour cet onglet
  }
}

load();

function fromTokenResponse(j) {
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + (j.expires_in ?? 3600) * 1000,
    email: j.user?.email ?? session?.email ?? null,
  };
}

async function tokenRequest(grantType, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(j.error_description || j.msg || j.error || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return j;
}

// Vérifie aussi que le compte a bien accès au cockpit 125.
export async function signIn(email, password) {
  const j = await tokenRequest('password', { email: email.trim(), password });
  save(fromTokenResponse(j));
  const ok = await fetch(`${SUPABASE_URL}/rest/v1/rpc/f125_can_access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${j.access_token}` },
    body: '{}',
  }).then(r => (r.ok ? r.json() : false)).catch(() => false);
  if (ok !== true) {
    await signOut();
    const err = new Error('Ce compte n’a pas accès au cockpit 125.');
    err.status = 403;
    throw err;
  }
  return session;
}

export async function signOut() {
  const token = session?.access_token;
  save(null);
  if (token) {
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

export function hasSession() {
  return !!session?.refresh_token;
}

// Jeton d'accès valide (renouvelé automatiquement s'il expire dans moins de 2 min).
export async function getAccessToken() {
  if (!session?.refresh_token) throw new Error('Session expirée, reconnectez-vous.');
  if (session.expires_at - Date.now() > 120_000) return session.access_token;
  if (!refreshing) {
    refreshing = tokenRequest('refresh_token', { refresh_token: session.refresh_token })
      .then(j => { save(fromTokenResponse(j)); return session.access_token; })
      .catch(e => { save(null); throw new Error('Session expirée, reconnectez-vous. (' + e.message + ')'); })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

// Jeton courant sans attente (pour les adresses d'images/PDF). Le renouvellement
// périodique ci-dessous le garde frais tant que le cockpit est ouvert.
export function currentAccessToken() {
  return session?.access_token ?? '';
}

setInterval(() => {
  if (session?.refresh_token) getAccessToken().catch(() => {});
}, 5 * 60 * 1000);

// En-têtes pour l'API REST Supabase avec le compte connecté.
export async function sbHeaders(extra = {}) {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    Prefer: 'return=representation',
    ...extra,
  };
}
