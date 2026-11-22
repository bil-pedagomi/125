import { accesCockpit125 } from './acces125.ts';

// 22/11/2026 : accès réservé aux comptes du cockpit 125 (jeton de session en
// en-tête ou dans ?token=, car une balise <iframe>/<img> ne peut pas envoyer d'en-tête).
const TYPEFORM_TOKEN = Deno.env.get('TYPEFORM_TOKEN') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Proxy de fichiers : récupère un fichier Typeform et le sert INLINE (affichage navigateur)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!(await accesCockpit125(req))) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const fileUrl = url.searchParams.get('url');
  if (!fileUrl) {
    return new Response('Missing url parameter', { status: 400, headers: corsHeaders });
  }

  // Sécurité : n'autoriser que les URLs Typeform
  if (!fileUrl.startsWith('https://api.typeform.com/responses/files/')) {
    return new Response('URL non autorisée', { status: 403, headers: corsHeaders });
  }

  try {
    const fetchHeaders: Record<string, string> = {};
    if (TYPEFORM_TOKEN) {
      fetchHeaders['Authorization'] = `Bearer ${TYPEFORM_TOKEN}`;
    }

    const fileResponse = await fetch(fileUrl, { headers: fetchHeaders });

    if (!fileResponse.ok) {
      return new Response(`Erreur Typeform: ${fileResponse.status}`, { status: fileResponse.status, headers: corsHeaders });
    }

    let contentType = fileResponse.headers.get('Content-Type') || 'application/octet-stream';
    const lowerUrl = fileUrl.toLowerCase();
    if (lowerUrl.includes('.pdf')) contentType = 'application/pdf';
    else if (lowerUrl.match(/\.(jpg|jpeg)/)) contentType = 'image/jpeg';
    else if (lowerUrl.includes('.png')) contentType = 'image/png';
    else if (lowerUrl.includes('.heic')) contentType = 'image/heic';
    else if (lowerUrl.includes('.webp')) contentType = 'image/webp';

    const fileData = await fileResponse.arrayBuffer();

    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e: any) {
    return new Response(`Erreur: ${e.message}`, { status: 500, headers: corsHeaders });
  }
});
