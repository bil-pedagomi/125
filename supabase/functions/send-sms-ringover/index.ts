import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders as baseCors } from "../_shared/cors.ts";
import { AccessError, requireCockpitUser } from "../_shared/auth.ts";

// Envoi des SMS de groupe depuis le cockpit (SmsModal → sendSMSViaEdgeFunction).
//
// Garde-fous : cette fonction parle au nom de Pedagomi, depuis son numéro et à
// ses frais. Elle n'accepte donc :
//  - qu'un utilisateur CONNECTÉ ayant accès au cockpit (pas la clé anon) ;
//  - que des destinataires INSCRITS à la session indiquée, au numéro enregistré
//    pour eux dans calendly_invitees (le numéro envoyé par le navigateur n'est
//    qu'un contrôle de cohérence : c'est celui de la base qui est utilisé) ;
//  - qu'un nombre de destinataires et une longueur de message raisonnables.
//
// Déployer avec verify_jwt = false ou true indifféremment : le contrôle est ici.

const RINGOVER_API_KEY = Deno.env.get('RINGOVER_API_KEY') ?? '';
const FROM_NUMBER = Deno.env.get('RINGOVER_SMS_FROM_NUMBER') ?? '';
const RINGOVER_SMS_URL = 'https://public-api.ringover.com/v2/push/sms';

// Une session 125 compte une vingtaine d'élèves au plus.
const MAX_DESTINATAIRES = 40;
// 4 SMS concaténés (4 × 153 caractères) : au-delà, c'est une erreur de saisie.
const MAX_LONGUEUR_MESSAGE = 612;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const CORS_HEADERS = { ...baseCors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

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
  if (!normalizedTo) return { success: false, error: 'Numero destinataire invalide' };
  if (!normalizedFrom) return { success: false, error: 'Numero expediteur invalide' };
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
  } catch (e) {
    return { success: false, error: `Fetch error: ${(e as Error).message}` };
  }
}

function reponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

type Inscrit = { id: number; invitee_uuid: string | null; email: string | null; phone: string | null };

// Inscrits (actifs) de la session 125 visée. calendly_event_uuid porte, pour
// le cockpit, l'id numérique de calendly_events (cf. formation_groupes).
async function chargerInscrits(calendlyEventUuid: string): Promise<Inscrit[]> {
  const eventId = Number(calendlyEventUuid);
  if (!Number.isInteger(eventId) || eventId <= 0) throw new AccessError('Session inconnue', 400);

  const { data: session, error: sessionErr } = await supabase.from('calendly_events')
    .select('id, event_type_name').eq('id', eventId).maybeSingle();
  if (sessionErr) throw new Error(`Lecture session impossible : ${sessionErr.message}`);
  if (!session || !/125/.test(session.event_type_name ?? '')) throw new AccessError('Session 125 introuvable', 400);

  const { data, error } = await supabase.from('calendly_invitees')
    .select('id, invitee_uuid, email, phone, status')
    .eq('calendly_event_id', eventId);
  if (error) throw new Error(`Lecture des inscrits impossible : ${error.message}`);
  return (data || []).filter((i) => i.status !== 'canceled');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return reponse({ error: 'Methode non autorisee' }, 405);

  let userId: string;
  try {
    userId = (await requireCockpitUser(req)).id;
  } catch (e) {
    return reponse({ error: (e as Error).message }, e instanceof AccessError ? e.status : 401);
  }

  const log = { total: 0, success: 0, failed: 0 };

  try {
    if (!RINGOVER_API_KEY || !FROM_NUMBER) {
      return reponse({ error: 'Configuration serveur incomplete' }, 500);
    }

    const payload = await req.json();
    const { calendly_event_uuid, groupe_numero, date_formation, heure_groupe, destinataires } = payload;

    if (!Array.isArray(destinataires) || destinataires.length === 0) {
      return reponse({ error: 'destinataires doit etre un tableau non vide' }, 400);
    }
    if (destinataires.length > MAX_DESTINATAIRES) {
      return reponse({ error: `Trop de destinataires (max ${MAX_DESTINATAIRES})` }, 400);
    }

    let inscrits: Inscrit[];
    try {
      inscrits = await chargerInscrits(String(calendly_event_uuid ?? ''));
    } catch (e) {
      return reponse({ error: (e as Error).message }, e instanceof AccessError ? e.status : 500);
    }
    // Le front identifie un élève par invitee_uuid, à défaut id ou email
    // (cf. inviteeKey / SmsModal) : on accepte les trois.
    const inscritParCle = new Map<string, Inscrit>();
    for (const i of inscrits) {
      for (const cle of [i.invitee_uuid, String(i.id), i.email?.toLowerCase().trim()]) {
        if (cle) inscritParCle.set(cle, i);
      }
    }

    log.total = destinataires.length;
    const details: Record<string, unknown>[] = [];
    const dejaEnvoye = new Set<number>();

    for (let i = 0; i < destinataires.length; i++) {
      const d = destinataires[i] ?? {};
      const invitee_uuid = d.invitee_uuid != null ? String(d.invitee_uuid) : '';
      const prenom = typeof d.prenom === 'string' ? d.prenom.slice(0, 80) : '';
      const message = typeof d.message === 'string' ? d.message.trim() : '';
      const numero = typeof d.numero === 'string' ? d.numero : '';

      const refus = (raison: string) => {
        log.failed++;
        details.push({ invitee_uuid, numero, statut: 'failed', error: raison });
      };

      const inscrit = inscritParCle.get(invitee_uuid) ?? inscritParCle.get(invitee_uuid.toLowerCase().trim());
      if (!inscrit) { refus("Destinataire non inscrit a cette session"); continue; }
      if (dejaEnvoye.has(inscrit.id)) { refus('Destinataire en double dans la requete'); continue; }
      if (!message) { refus('Message vide'); continue; }
      if (message.length > MAX_LONGUEUR_MESSAGE) { refus(`Message trop long (max ${MAX_LONGUEUR_MESSAGE} caracteres)`); continue; }

      const numeroBase = toE164(inscrit.phone ?? '');
      if (!numeroBase) { refus("Pas de numero valide enregistre pour cet eleve"); continue; }
      if (numero && toE164(numero) !== numeroBase) { refus('Numero different de celui de l\'inscription'); continue; }
      dejaEnvoye.add(inscrit.id);

      const { data: inserted, error: insertErr } = await supabase.from('sms_queue').insert({
        telephone: numeroBase,
        prenom,
        message,
        date_formation: date_formation ?? new Date().toISOString().split('T')[0],
        heure_groupe: heure_groupe ?? '',
        statut: 'pending',
        calendly_event_uuid: String(calendly_event_uuid),
        invitee_uuid,
        groupe_numero: groupe_numero ?? null,
        envoye_par: userId
      }).select('id').single();

      if (insertErr || !inserted) {
        refus(`DB insert: ${insertErr?.message}`);
        continue;
      }

      const result = await sendOneSms(numeroBase, message);

      const { error: updateErr } = await supabase.from('sms_queue').update({
        statut: result.success ? 'sent' : 'failed',
        ringover_message_id: result.messageId ?? null,
        erreur_message: result.error ?? null,
        sent_at: result.success ? new Date().toISOString() : null
      }).eq('id', inserted.id);
      if (updateErr) console.error('send-sms-ringover: maj sms_queue', inserted.id, updateErr.message);

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

    return reponse({ ...log, details });
  } catch (err) {
    const message = (err as Error).message;
    console.error('send-sms-ringover error:', err);
    await supabase.from('sync_log_unifie').insert({ source: 'ringover_sms', status: 'error', error_message: message });
    return reponse({ error: message, ...log }, 500);
  }
});
