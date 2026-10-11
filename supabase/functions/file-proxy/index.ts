import { corsHeaders as baseCors } from '../_shared/cors.ts';
import { AccessError, requireCockpitUser } from '../_shared/auth.ts';

// Proxy de fichiers : récupère une pièce Typeform (permis, photo d'identité,
// signature) et la sert INLINE pour que le navigateur l'affiche au lieu de la
// télécharger. Ce sont des documents d'identité : l'accès exige un compte du
// cockpit (jeton de session), et non plus une clé partagée livrée dans le
// JavaScript du site.
//
// Déployer avec verify_jwt = false : le contrôle est fait ici (un jeton anon
// passerait verify_jwt).

const TYPEFORM_TOKEN = Deno.env.get('TYPEFORM_TOKEN') || '';
const PREFIXE_AUTORISE = 'https://api.typeform.com/responses/files/';

const corsHeaders = { ...baseCors, 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    await requireCockpitUser(req);
  } catch (e) {
    const status = e instanceof AccessError ? e.status : 401;
    return new Response((e as Error).message, { status, headers: corsHeaders });
  }

  const fileUrl = new URL(req.url).searchParams.get('url');
  if (!fileUrl) {
    return new Response('Missing url parameter', { status: 400, headers: corsHeaders });
  }

  // Sécurité : n'autoriser que les fichiers Typeform (le jeton Typeform est
  // joint à la requête sortante — il ne doit partir vers aucun autre hôte).
  let cible: URL;
  try {
    cible = new URL(fileUrl);
  } catch {
    return new Response('URL invalide', { status: 400, headers: corsHeaders });
  }
  if (cible.protocol !== 'https:' || cible.host !== 'api.typeform.com' || !cible.href.startsWith(PREFIXE_AUTORISE)) {
    return new Response('URL non autorisée', { status: 403, headers: corsHeaders });
  }

  try {
    const fetchHeaders: Record<string, string> = {};
    if (TYPEFORM_TOKEN) fetchHeaders['Authorization'] = `Bearer ${TYPEFORM_TOKEN}`;

    // redirect: 'manual' — on ne suit pas une redirection vers un autre hôte
    // avec le jeton Typeform.
    let fileResponse = await fetch(cible.href, { headers: fetchHeaders, redirect: 'manual' });
    if (fileResponse.status >= 300 && fileResponse.status < 400) {
      const location = fileResponse.headers.get('Location');
      if (!location) return new Response('Redirection invalide', { status: 502, headers: corsHeaders });
      // Le fichier peut être servi depuis un stockage signé : on le suit SANS jeton.
      fileResponse = await fetch(new URL(location, cible).href);
    }

    if (!fileResponse.ok) {
      return new Response(`Erreur Typeform: ${fileResponse.status}`, { status: fileResponse.status, headers: corsHeaders });
    }

    // Type de contenu limité aux formats attendus : jamais de text/html servi
    // depuis le domaine Supabase.
    const lowerUrl = cible.pathname.toLowerCase();
    let contentType = 'application/octet-stream';
    if (lowerUrl.endsWith('.pdf')) contentType = 'application/pdf';
    else if (/\.(jpg|jpeg)$/.test(lowerUrl)) contentType = 'image/jpeg';
    else if (lowerUrl.endsWith('.png')) contentType = 'image/png';
    else if (lowerUrl.endsWith('.heic')) contentType = 'image/heic';
    else if (lowerUrl.endsWith('.webp')) contentType = 'image/webp';
    else {
      const upstream = (fileResponse.headers.get('Content-Type') || '').split(';')[0].trim();
      if (upstream === 'application/pdf' || (upstream.startsWith('image/') && !upstream.includes('svg'))) contentType = upstream;
    }

    return new Response(fileResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return new Response(`Erreur: ${(e as Error).message}`, { status: 500, headers: corsHeaders });
  }
});
