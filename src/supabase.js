import { createClient } from '@supabase/supabase-js';

// La clé anon est PUBLIQUE par nature (elle part dans le JavaScript du site) :
// elle ne donne accès à rien tant que l'utilisateur n'est pas connecté, les
// tables du cockpit n'étant ouvertes qu'aux comptes listés dans f125_app_users
// (policies cockpit_125_* / fonction f125_can_access()).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || 'https://yuolnqyejxtfpxntflle.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1b2xucXllanh0ZnB4bnRmbGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTIzNzcsImV4cCI6MjA4Nzc2ODM3N30.cktsC7ly3ImeIY_2mVmxo0phSTz3obIG3UHgl_iDa7U';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Jeton de l'utilisateur connecté, à passer dans `Authorization: Bearer …`.
// Sans session, on refuse d'appeler l'API plutôt que de retomber sur la clé
// anon : une requête anonyme ne verrait de toute façon plus aucune donnée.
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Session expirée — reconnectez-vous.');
  return token;
}
