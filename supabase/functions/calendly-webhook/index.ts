// calendly-webhook v1 — synchro TEMPS REEL des invités Calendly.
//
// Au lieu d'attendre le cron (toutes les ~30 min), Calendly appelle cette
// fonction dès qu'une réservation est créée ou annulée (events invitee.created
// / invitee.canceled). On fait le MÊME upsert que `calendly-sync-invitees`
// pour un seul invité → la base est à jour en < 1 s.
//
// Les triggers Postgres font le reste automatiquement :
//   - trg_update_nb_invitees  → recompte calendly_events.nb_invitees (actifs)
//   - trg_match_invitee_eleve → matche l'invité à un élève
//
// Le cron reste en place comme filet de sécurité (webhook raté / rejeu).
//
// Modes :
//   POST  (depuis Calendly)                 → traite l'event
//   GET   ?action=register&key=SYNC_SECRET  → crée l'abonnement webhook Calendly
//   GET   ?action=status&key=SYNC_SECRET    → liste les abonnements
//   GET   ?action=delete&key=SYNC_SECRET    → supprime l'abonnement enregistré

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_ID = Deno.env.get('CALENDLY_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('CALENDLY_CLIENT_SECRET')!;
const SYNC_SECRET = Deno.env.get('SYNC_SECRET') || 'pedagomi2026';
const CALENDLY_ORG = 'https://api.calendly.com/organizations/DDFDR76N5WCFPFX7';
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/calendly-webhook?key=${SYNC_SECRET}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── OAuth (identique aux autres fonctions calendly) ──────────────────────────

async function getValidToken(): Promise<string> {
  const { data: t, error } = await supabase
    .from('calendly_oauth_tokens')
    .select('access_token,refresh_token,expires_at')
    .eq('id', 1)
    .single();
  if (error || !t) throw new Error('Aucun token OAuth Calendly.');
  if ((new Date(t.expires_at).getTime() - Date.now()) / 60000 < 10) {
    const res = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: t.refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    if (!res.ok) throw new Error(`OAuth refresh failed: ${await res.text()}`);
    const n = await res.json();
    await supabase.from('calendly_oauth_tokens').update({
      access_token: n.access_token,
      refresh_token: n.refresh_token,
      expires_at: new Date(Date.now() + n.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    return n.access_token;
  }
  return t.access_token;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPhone(qas: any[]): string | null {
  if (!Array.isArray(qas)) return null;
  for (const qa of qas) {
    const q = (qa.question || '').toLowerCase();
    if (q.includes('téléphone') || q.includes('telephone') || q.includes('phone') || q.includes('tel')) {
      return qa.answer?.trim() || null;
    }
  }
  return null;
}

function uuidFromEventUri(uri: string): string {
  // .../scheduled_events/<EVENT_UUID>/invitees/<INVITEE_UUID>
  const m = uri.match(/scheduled_events\/([^/]+)/);
  return m ? m[1] : '';
}

// Résout l'id interne (serial) de calendly_events depuis l'UUID Calendly.
// Si l'événement n'existe pas encore (1ère réservation d'un event tout neuf),
// on l'insère à partir du scheduled_event présent dans le payload.
async function resolveEventId(scheduledEvent: any, eventUuid: string): Promise<number | null> {
  const { data: existing } = await supabase
    .from('calendly_events')
    .select('id')
    .eq('calendly_uuid', eventUuid)
    .maybeSingle();
  if (existing?.id) return existing.id;

  if (!scheduledEvent?.uri) return null;
  const loc = scheduledEvent.location || {};
  const row = {
    calendly_uuid: eventUuid,
    calendly_uri: scheduledEvent.uri,
    event_type_name: scheduledEvent.name || null,
    event_type_uri: scheduledEvent.event_type || null,
    status: scheduledEvent.status || 'active',
    start_time: scheduledEvent.start_time || null,
    end_time: scheduledEvent.end_time || null,
    location: loc.join_url || loc.location || null,
    calendly_created_at: scheduledEvent.created_at || null,
    calendly_updated_at: scheduledEvent.updated_at || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('calendly_events').upsert(row, { onConflict: 'calendly_uuid' });
  if (error) { console.error('upsert event error', error.message); return null; }
  const { data: created } = await supabase
    .from('calendly_events')
    .select('id')
    .eq('calendly_uuid', eventUuid)
    .maybeSingle();
  return created?.id ?? null;
}

// Upsert d'un invité — MÊME structure d'enregistrement que calendly-sync-invitees.
async function upsertInvitee(inv: any): Promise<void> {
  const inviteeUuid = (inv.uri || '').split('/').pop() || '';
  if (!inviteeUuid) throw new Error('invitee uri manquante');

  const eventUuid = uuidFromEventUri(inv.uri || '');
  const eventId = await resolveEventId(inv.scheduled_event, eventUuid);

  const qas = inv.questions_and_answers || [];
  const tracking = inv.tracking || {};
  const record = {
    calendly_event_id: eventId,
    calendly_event_uuid: eventUuid,
    invitee_uuid: inviteeUuid,
    invitee_uri: inv.uri || null,
    name: inv.name || null,
    first_name: inv.first_name || null,
    last_name: inv.last_name || null,
    email: inv.email || null,
    phone: extractPhone(qas),
    timezone: inv.timezone || null,
    status: inv.status || 'active',
    cancel_reason: inv.cancellation?.reason || null,
    rescheduled: inv.rescheduled === true,
    new_invitee_uri: inv.new_invitee || null,
    old_invitee_uri: inv.old_invitee || null,
    no_show: inv.no_show?.created_at ? true : false,
    payment_amount: inv.payment?.amount ? parseFloat(inv.payment.amount) : null,
    payment_currency: inv.payment?.currency || null,
    questions_and_answers: qas.length > 0 ? qas : null,
    utm_source: tracking.utm_source || null,
    utm_campaign: tracking.utm_campaign || null,
    utm_medium: tracking.utm_medium || null,
    utm_term: tracking.utm_term || null,
    utm_content: tracking.utm_content || null,
    calendly_created_at: inv.created_at || null,
    synced_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('calendly_invitees').upsert(record, { onConflict: 'invitee_uuid' });
  if (error) throw new Error(error.message);
}

// ─── Gestion de l'abonnement webhook (register/status/delete) ─────────────────

async function registerSubscription(): Promise<any> {
  const token = await getValidToken();
  const res = await fetch('https://api.calendly.com/webhook_subscriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: CALLBACK_URL,
      events: ['invitee.created', 'invitee.canceled'],
      organization: CALENDLY_ORG,
      scope: 'organization',
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    // 409 = déjà abonné à cette URL : on considère ça comme OK.
    if (res.status === 409) return { ok: true, already_exists: true, detail: body };
    throw new Error(`Calendly ${res.status}: ${JSON.stringify(body)}`);
  }
  const uri = body.resource?.uri || null;
  await supabase.from('calendly_webhook_config').upsert({
    id: 1,
    subscription_uri: uri,
    callback_url: CALLBACK_URL,
    events: ['invitee.created', 'invitee.canceled'],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  return { ok: true, subscription_uri: uri };
}

async function listSubscriptions(): Promise<any> {
  const token = await getValidToken();
  const res = await fetch(
    `https://api.calendly.com/webhook_subscriptions?organization=${encodeURIComponent(CALENDLY_ORG)}&scope=organization&count=100`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  );
  return res.json();
}

async function deleteSubscription(): Promise<any> {
  const token = await getValidToken();
  const { data: cfg } = await supabase.from('calendly_webhook_config').select('subscription_uri').eq('id', 1).maybeSingle();
  if (!cfg?.subscription_uri) return { ok: false, error: 'aucun abonnement enregistré' };
  const res = await fetch(cfg.subscription_uri, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
  if (res.ok) await supabase.from('calendly_webhook_config').update({ subscription_uri: null, updated_at: new Date().toISOString() }).eq('id', 1);
  return { ok: res.ok, status: res.status };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const keyOk = url.searchParams.get('key') === SYNC_SECRET;

  // --- GET : administration de l'abonnement (protégé par ?key=) ---
  if (req.method === 'GET') {
    if (!keyOk) return new Response('Unauthorized', { status: 401 });
    const action = url.searchParams.get('action') || 'status';
    try {
      let result: any;
      if (action === 'register') result = await registerSubscription();
      else if (action === 'delete') result = await deleteSubscription();
      else result = await listSubscriptions();
      return new Response(JSON.stringify(result, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // --- POST : callback Calendly ---
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  // Auth par secret partagé dans l'URL (Calendly rappelle l'URL exacte enregistrée).
  if (!keyOk) return new Response('Unauthorized', { status: 401 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const eventType = payload?.event;
  const invitee = payload?.payload;

  // On ne traite que les events invités. Tout le reste : 200 pour éviter les rejeux.
  if (eventType !== 'invitee.created' && eventType !== 'invitee.canceled') {
    return new Response(JSON.stringify({ ok: true, ignored: eventType || 'unknown' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (!invitee?.uri) {
    return new Response(JSON.stringify({ ok: true, ignored: 'no invitee uri' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    await upsertInvitee(invitee);
    return new Response(JSON.stringify({ ok: true, event: eventType, invitee: invitee.email || null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    // 500 → Calendly rejouera l'event (backoff), et le cron reste un filet de sécurité.
    console.error('webhook upsert error', e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
