import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RINGOVER_API_KEY = Deno.env.get('RINGOVER_API_KEY') ?? '';
const FROM_NUMBER = Deno.env.get('RINGOVER_SMS_FROM_NUMBER') ?? '';
const RINGOVER_URL = 'https://public-api.ringover.com/v2/push/sms';
const TYPEFORM_URL = 'https://form.typeform.com/to/npPOcgRV';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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

function buildMessage(prenom: string, type: 'anticipation' | 'j-2' | 'j-1'): string {
  const nom = prenom || '';
  if (type === 'anticipation') {
    return `Bonjour ${nom}, merci pour votre reservation a la formation 125 ! Pour preparer votre carte, merci de remplir votre dossier des maintenant : ${TYPEFORM_URL} A bientot, Pedagomi`;
  } else if (type === 'j-2') {
    return `Bonjour ${nom}, votre formation 125 approche. Pensez a remplir votre dossier : ${TYPEFORM_URL} Merci ! Pedagomi`;
  } else {
    return `Bonjour ${nom}, formation 125 demain. Il manque votre dossier : ${TYPEFORM_URL} Merci de le remplir au plus vite. Pedagomi`;
  }
}

async function sendSms(toNum: string, content: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const to = toRingoverNumber(toNum);
  const from = toRingoverNumber(FROM_NUMBER);
  if (!to) return { success: false, error: 'Numero destinataire invalide' };
  if (!from) return { success: false, error: 'Numero expediteur invalide' };
  try {
    const res = await fetch(RINGOVER_URL, {
      method: 'POST',
      headers: { 'Authorization': RINGOVER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_number: from, to_number: to, content })
    });
    const body = await res.text();
    if (res.status >= 200 && res.status < 300) {
      try { const json = JSON.parse(body); return { success: true, messageId: String(json.message_id ?? '') }; }
      catch { return { success: true }; }
    }
    return { success: false, error: `Ringover ${res.status}: ${body.substring(0, 200)}` };
  } catch (e: any) {
    return { success: false, error: `Fetch error: ${e.message}` };
  }
}

function extractPrenom(name: string | null, firstName: string | null): string {
  if (firstName) return firstName.trim();
  if (!name) return '';
  return name.trim().split(/\s+/)[0] || '';
}

// Qui a DEJA rempli son dossier. C'est la seule chose qui empeche un SMS de
// partir : si cette liste revient vide ou incomplete, tout le monde parait sans
// dossier et recoit une relance a tort (incident du 03-04/09/2026, 30 SMS).
// Deux protections, apprises de cet incident :
//  - l'erreur PostgREST est LUE (elle etait avalee : `const { data } = ...`),
//  - la pagination est explicite. PostgREST plafonne a 1000 lignes par defaut ;
//    la vue en compte deja 662 et grossit a chaque inscription, donc sans
//    pagination le meme envoi massif reviendrait tout seul, en silence.
const PAGE_SIZE = 1000;

async function chargerInviteesAvecForm(): Promise<Set<number>> {
  const ids = new Set<number>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('v_125_form_matching')
      .select('invitee_id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Lecture de v_125_form_matching impossible : ${error.message}`);
    }
    for (const m of (data || [])) ids.add((m as any).invitee_id);
    if (!data || data.length < PAGE_SIZE) break;
  }
  if (ids.size === 0) {
    // Il y a toujours des centaines de dossiers rapproches. Zero ne veut pas
    // dire << personne n'a rempli >>, mais << la source est cassee >>.
    throw new Error('v_125_form_matching renvoie 0 ligne — source de verite indisponible');
  }
  return ids;
}

// Traite une liste de candidats : envoie SMS + log
async function traiterCandidats(candidats: any[], type: string, targetDate: string | null, dryRun: boolean, log: any) {
  for (const c of candidats) {
    if (!c.phone) {
      if (!dryRun) {
        await supabase.from('relances_typeform').insert({
          session_calendly_event_uuid: c.calendly_event_uuid, email: c.email, prenom: c.prenom,
          telephone: null, date_formation: c.date_formation, type_relance: type,
          statut: 'skipped', skip_reason: 'Pas de numero de telephone'
        });
      }
      log.relances_skipped++;
      log.details.push({ type, email: c.email, action: 'skipped_no_phone' });
      continue;
    }
    const message = buildMessage(c.prenom, type as any);
    if (dryRun) {
      log.details.push({ type, email: c.email, prenom: c.prenom, phone: c.phone, date_formation: c.date_formation, action: 'would_send', message });
      continue;
    }
    const { data: smsInserted } = await supabase.from('sms_queue').insert({
      telephone: toE164(c.phone) ?? c.phone, prenom: c.prenom, message,
      date_formation: c.date_formation, heure_groupe: `relance_${type}`,
      statut: 'pending', calendly_event_uuid: c.calendly_event_uuid, invitee_uuid: c.invitee_uuid
    }).select('id').single();
    const smsResult = await sendSms(c.phone, message);
    if (smsInserted) {
      await supabase.from('sms_queue').update({
        statut: smsResult.success ? 'sent' : 'failed',
        ringover_message_id: smsResult.messageId ?? null,
        erreur_message: smsResult.error ?? null,
        sent_at: smsResult.success ? new Date().toISOString() : null
      }).eq('id', smsInserted.id);
    }
    await supabase.from('relances_typeform').insert({
      session_calendly_event_uuid: c.calendly_event_uuid, email: c.email, prenom: c.prenom,
      telephone: toE164(c.phone) ?? c.phone, date_formation: c.date_formation, type_relance: type,
      statut: smsResult.success ? 'sent' : 'failed', sms_queue_id: smsInserted?.id ?? null,
      erreur_message: smsResult.error ?? null, sent_at: smsResult.success ? new Date().toISOString() : null
    });
    if (smsResult.success) log.relances_envoyees++; else log.erreurs++;
    log.details.push({ type, email: c.email, prenom: c.prenom, phone: c.phone, success: smsResult.success, message_id: smsResult.messageId, error: smsResult.error });
    await new Promise(r => setTimeout(r, 1100));
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';
  const log: any = {
    dry_run: dryRun, executed_at: new Date().toISOString(),
    candidats_anticipation: 0, candidats_j2: 0, candidats_j1: 0,
    relances_envoyees: 0, relances_skipped: 0, erreurs: 0, details: [] as any[]
  };

  try {
    const now = new Date();
    const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const heure = parisTime.getHours();
    const jour = parisTime.getDay();
    if (!dryRun && (heure < 9 || heure >= 20)) {
      return new Response(JSON.stringify({ skipped: true, reason: `Heure ${heure}h hors plage`, ...log }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (!dryRun && jour === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Dimanche', ...log }), { headers: { 'Content-Type': 'application/json' } });
    }

    const today = now.toISOString().split('T')[0];
    const j2Target = new Date(now.getTime() + 2 * 86400000).toISOString().split('T')[0];
    const j1Target = new Date(now.getTime() + 1 * 86400000).toISOString().split('T')[0];
    // Anticipation : formation dans plus de 4 jours
    const seuilAnticipation = new Date(now.getTime() + 4 * 86400000).toISOString().split('T')[0];
    // Reserve il y a au moins 2 jours
    const reserveAvant = new Date(now.getTime() - 2 * 86400000).toISOString();

    // Matching formulaire intelligent (email + nom). Toute panne ici doit
    // interrompre le run AVANT le moindre envoi : mieux vaut zero relance
    // qu'une relance envoyee a des gens qui ont deja rempli leur dossier.
    let inviteesAvecForm: Set<number>;
    try {
      inviteesAvecForm = await chargerInviteesAvecForm();
    } catch (e: any) {
      const msg = `Relances interrompues (aucun SMS envoye) : ${e.message}`;
      console.error(msg);
      await supabase.from('sync_log_unifie').insert({
        source: 'relance_typeform_f125', status: 'error', error_message: msg,
        nb_fetched: 0, nb_inserted: 0, table_name: 'relances_typeform',
        details: { dry_run: dryRun, garde_fou: 'source_dossiers_indisponible' }
      });
      return new Response(JSON.stringify({ aborted: true, reason: msg, ...log }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
    log.dossiers_rapproches = inviteesAvecForm.size;

    // Helper : recupere les relances deja envoyees pour un type donne
    async function dejaRelance(email: string, dateFormation: string, type: string): Promise<boolean> {
      const { data } = await supabase.from('relances_typeform')
        .select('id').eq('email', email).eq('date_formation', dateFormation).eq('type_relance', type).limit(1);
      return !!(data && data.length > 0);
    }

    // ========== RELANCE ANTICIPATION ==========
    // Sessions 125 dont la formation est dans PLUS de 4 jours
    const { data: sessionsAnticip } = await supabase.from('calendly_events')
      .select('id, calendly_uuid, start_time, status, nb_invitees')
      .ilike('event_type_name', '%125%')
      .gt('start_time', seuilAnticipation + 'T23:59:59');
    const validAnticip = (sessionsAnticip || []).filter((s: any) => !(s.status === 'canceled' && (s.nb_invitees ?? 0) === 0));

    if (validAnticip.length > 0) {
      const idsAnticip = validAnticip.map((s: any) => s.id);
      const uuidByIdA = new Map<number, string>(validAnticip.map((s: any) => [s.id, s.calendly_uuid]));
      const startByIdA = new Map<number, string>(validAnticip.map((s: any) => [s.id, (s.start_time || '').split('T')[0]]));

      const { data: invA } = await supabase.from('calendly_invitees')
        .select('id, calendly_event_id, name, first_name, email, phone, invitee_uuid, calendly_created_at')
        .in('calendly_event_id', idsAnticip)
        .lte('calendly_created_at', reserveAvant); // reserve il y a au moins 2 jours

      const uniqA = new Map<string, any>();
      for (const inv of (invA || [])) {
        const key = (inv.email || '').toLowerCase().trim();
        if (key && !uniqA.has(key)) uniqA.set(key, inv);
      }
      const candidatsA: any[] = [];
      for (const [email, inv] of uniqA) {
        if (inviteesAvecForm.has(inv.id)) continue; // formulaire rempli
        const df = startByIdA.get(inv.calendly_event_id) ?? '';
        if (await dejaRelance(email, df, 'anticipation')) continue;
        candidatsA.push({
          calendly_event_uuid: uuidByIdA.get(inv.calendly_event_id) ?? null,
          email, prenom: extractPrenom(inv.name, inv.first_name),
          phone: inv.phone, invitee_uuid: inv.invitee_uuid, date_formation: df
        });
      }
      log.candidats_anticipation = candidatsA.length;
      log.details.push({ type: 'anticipation', nb_candidats: candidatsA.length });
      await traiterCandidats(candidatsA, 'anticipation', null, dryRun, log);
    }

    // ========== RELANCES J-2 ET J-1 ==========
    for (const [type, targetDate] of [['j-2', j2Target], ['j-1', j1Target]] as const) {
      const { data: sessions } = await supabase.from('calendly_events')
        .select('id, calendly_uuid, start_time, status, nb_invitees')
        .ilike('event_type_name', '%125%')
        .gte('start_time', targetDate + 'T00:00:00')
        .lte('start_time', targetDate + 'T23:59:59');
      const valid = (sessions || []).filter((s: any) => !(s.status === 'canceled' && (s.nb_invitees ?? 0) === 0));
      if (valid.length === 0) { log.details.push({ type, target_date: targetDate, message: 'Aucune session' }); continue; }

      const ids = valid.map((s: any) => s.id);
      const uuidById = new Map<number, string>(valid.map((s: any) => [s.id, s.calendly_uuid]));
      const { data: invitees } = await supabase.from('calendly_invitees')
        .select('id, calendly_event_id, name, first_name, email, phone, invitee_uuid')
        .in('calendly_event_id', ids);

      const uniq = new Map<string, any>();
      for (const inv of (invitees || [])) {
        const key = (inv.email || '').toLowerCase().trim();
        if (key && !uniq.has(key)) uniq.set(key, inv);
      }
      const candidats: any[] = [];
      for (const [email, inv] of uniq) {
        if (inviteesAvecForm.has(inv.id)) continue;
        if (await dejaRelance(email, targetDate, type)) continue;
        candidats.push({
          calendly_event_uuid: uuidById.get(inv.calendly_event_id) ?? null,
          email, prenom: extractPrenom(inv.name, inv.first_name),
          phone: inv.phone, invitee_uuid: inv.invitee_uuid, date_formation: targetDate
        });
      }
      if (type === 'j-2') log.candidats_j2 = candidats.length; else log.candidats_j1 = candidats.length;
      log.details.push({ type, target_date: targetDate, nb_candidats: candidats.length, nb_inscrits: uniq.size });
      await traiterCandidats(candidats, type, targetDate, dryRun, log);
    }

    await supabase.from('sync_log_unifie').insert({
      source: 'relance_typeform_f125',
      status: log.erreurs === 0 ? 'success' : (log.relances_envoyees === 0 ? 'error' : 'partial'),
      nb_fetched: log.candidats_anticipation + log.candidats_j2 + log.candidats_j1,
      nb_inserted: log.relances_envoyees, nb_skipped: log.relances_skipped,
      details: { dry_run: dryRun }, table_name: 'relances_typeform'
    });

    return new Response(JSON.stringify(log, null, 2), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('relance error:', err);
    await supabase.from('sync_log_unifie').insert({ source: 'relance_typeform_f125', status: 'error', error_message: err.message }).catch(() => {});
    return new Response(JSON.stringify({ error: err.message, ...log }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
