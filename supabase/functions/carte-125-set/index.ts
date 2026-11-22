import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { accesCockpit125 } from './acces125.ts';

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// 22/11/2026 : plus de clé partagée — accès réservé aux comptes du cockpit 125.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });

  if (!(await accesCockpit125(req))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

  try {
    const body = await req.json();
    const invitee_uuid = (body.invitee_uuid || '').trim();
    if (!invitee_uuid) return new Response(JSON.stringify({ error: 'invitee_uuid requis' }), { status: 400, headers: corsHeaders });

    const carte_faite = body.carte_faite === true;
    const record: Record<string, unknown> = {
      invitee_uuid,
      carte_faite,
      carte_faite_at: carte_faite ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    // On ne renseigne email / event que si fournis, pour ne pas ecraser l'existant avec null
    if (body.email) record.email = String(body.email).toLowerCase().trim();
    if (body.calendly_event_uuid) record.calendly_event_uuid = String(body.calendly_event_uuid).trim();

    const { data, error } = await sb
      .from('f125_carte_125')
      .upsert(record, { onConflict: 'invitee_uuid' })
      .select('invitee_uuid, carte_faite, carte_faite_at')
      .single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ ok: true, carte: data }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
