import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { accesCockpit125 } from "./acces125.ts";

// 22/11/2026 (audit sécurité) : l'envoi de SMS est réservé aux comptes du cockpit 125.
// Avant, la clé publique (anon) suffisait : n'importe qui pouvait envoyer un SMS
// depuis le numéro Pedagomi.

const RINGOVER_API_KEY = Deno.env.get('RINGOVER_API_KEY') ?? '';
const FROM_NUMBER = Deno.env.get('RINGOVER_SMS_FROM_NUMBER') ?? '';
const RINGOVER_SMS_URL = 'https://public-api.ringover.com/v2/push/sms';
const MAX_DESTINATAIRES = 40;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function toRingoverNumber(raw: string): string | null {
  if (!raw) return null;
  let n = raw.replace(/[^\d+]/g, '');
  if (n.startsWith('00')) n = n.substring(2);
  else if (n.startsWith('+')) n = n.substring(1);
  else if (n.startsWith('0') && n.length === 10) n = '33' + n.substring(1);
  if (!/^\d{10,15}$/.test(n)) return null;
  return n;
}

function toE164(raw: string): string | null {
  const r = toRingoverNumber(raw);
  return r ? '+' + r : null;
}

async function sendOneSms(toNumber: string, content: string): Promise<{ success: boolean; messageId?: string; convId?: string; error?: string; status?: number }> {
  const normalizedTo = toRingoverNumber(toNumber);
  const normalizedFrom = toRingoverNumber(FROM_NUMBER);
  if (!normalizedTo) return { success: false, error: `Numero destinataire invalide: ${toNumber}` };
  if (!normalizedFrom) return { success: false, error: `Numero expediteur invalide: ${FROM_NUMBER}` };
  try {
    const res = await fetch(RINGOVER_SMS_URL, {
      method: 'POST',
      headers: { 'Authorization': RINGOVER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_number: normalizedFrom, to_number: normalizedTo, content })
    });
    const body = await res.text();
    if (res.status >= 200 && res.status < 300) {
      try {
        const json = JSON.parse(body);
        return { success: true, messageId: String(json.message_id ?? ''), convId: String(json.conv_id ?? ''), status: res.status };
      } catch {
        return { success: true, status: res.status };
      }
    }
    return { success: false, error: `Ringover ${res.status}: ${body.substring(0, 300)}`, status: res.status };
  } catch (e: any) {
    return { success: false, error: `Fetch error: ${e.message}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const log: any = { total: 0, success: 0, failed: 0 };

  try {
    if (!(await accesCockpit125(req))) {
      return new Response(JSON.stringify({ error: 'Accès réservé au cockpit 125' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    if (!RINGOVER_API_KEY || !FROM_NUMBER) {
      return new Response(JSON.stringify({ error: 'Configuration serveur incomplete' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(jwt);
    const userId = user?.id ?? null;

    const payload = await req.json();
    const { calendly_event_uuid, groupe_numero, date_formation, heure_groupe, destinataires } = payload;

    if (!Array.isArray(destinataires) || destinataires.length === 0) {
      return new Response(JSON.stringify({ error: 'destinataires doit etre un tableau non vide' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
    if (destinataires.length > MAX_DESTINATAIRES) {
      return new Response(JSON.stringify({ error: `Trop de destinataires (max ${MAX_DESTINATAIRES})` }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    log.total = destinataires.length;
    const details: any[] = [];

    for (let i = 0; i < destinataires.length; i++) {
      const d = destinataires[i];
      const { invitee_uuid, prenom, numero, message } = d;
      const telephoneNormalise = toE164(numero) ?? numero;

      const { data: inserted, error: insertErr } = await supabase.from('sms_queue').insert({
        telephone: telephoneNormalise,
        prenom: prenom ?? '',
        message,
        date_formation: date_formation ?? new Date().toISOString().split('T')[0],
        heure_groupe: heure_groupe ?? '',
        statut: 'pending',
        calendly_event_uuid,
        invitee_uuid,
        groupe_numero: groupe_numero ?? null,
        envoye_par: userId
      }).select('id').single();

      if (insertErr || !inserted) {
        log.failed++;
        details.push({ invitee_uuid, numero, statut: 'failed', error: `DB insert: ${insertErr?.message}` });
        continue;
      }

      const result = await sendOneSms(numero, message);

      // Valeurs EN (maintenant acceptées par le check constraint élargi)
      await supabase.from('sms_queue').update({
        statut: result.success ? 'sent' : 'failed',
        ringover_message_id: result.messageId ?? null,
        erreur_message: result.error ?? null,
        sent_at: result.success ? new Date().toISOString() : null
      }).eq('id', inserted.id);

      if (result.success) {
        log.success++;
        details.push({ invitee_uuid, numero, statut: 'sent', message_id: result.messageId });
      } else {
        log.failed++;
        details.push({ invitee_uuid, numero, statut: 'failed', error: result.error });
      }

      if (i < destinataires.length - 1) await new Promise(r => setTimeout(r, 1100));
    }

    await supabase.from('sync_log_unifie').insert({
      source: 'ringover_sms',
      status: log.failed === 0 ? 'success' : (log.success === 0 ? 'error' : 'partial'),
      nb_fetched: log.total,
      nb_inserted: log.success,
      nb_skipped: log.failed,
      details: { calendly_event_uuid, groupe_numero, date_formation, user_id: userId },
      table_name: 'sms_queue'
    });

    return new Response(JSON.stringify({ ...log, details }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('send-sms-ringover error:', err);
    try {
      await supabase.from('sync_log_unifie').insert({ source: 'ringover_sms', status: 'error', error_message: err.message });
    } catch { /* journal facultatif */ }
    return new Response(JSON.stringify({ error: err.message, ...log }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});
