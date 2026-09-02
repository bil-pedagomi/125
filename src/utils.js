const API_URL = 'https://yuolnqyejxtfpxntflle.supabase.co/functions/v1/dashboard-125?key=eb498a94-3602-46a4-bce7-df288002402d';
const SUPABASE_URL = 'https://yuolnqyejxtfpxntflle.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1b2xucXllanh0ZnB4bnRmbGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTIzNzcsImV4cCI6MjA4Nzc2ODM3N30.cktsC7ly3ImeIY_2mVmxo0phSTz3obIG3UHgl_iDa7U';

const FILE_PROXY_KEY = 'eb498a94-3602-46a4-bce7-df288002402d';

// Wrap a raw Typeform file URL with the Supabase file-proxy so the browser
// displays it inline (PDFs render instead of downloading). Use ONLY for the
// "view" action — the "download" buttons keep the direct Typeform URL.
export function getProxyUrl(typeformUrl) {
  if (!typeformUrl) return typeformUrl;
  return `${SUPABASE_URL}/functions/v1/file-proxy?key=${FILE_PROXY_KEY}&url=${encodeURIComponent(typeformUrl)}`;
}

export async function fetchDashboardData() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
  return res.json();
}

export async function fetchTrafficConversion(year) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_traffic_conversion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_year: year }),
  });
  if (!res.ok) throw new Error(`Erreur trafic API: ${res.status} — ${await res.text()}`);
  return res.json();
}

export async function fetchPage125Stats(dateStart, dateEnd) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_page125_stats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_date_start: dateStart, p_date_end: dateEnd }),
  });
  if (!res.ok) throw new Error(`Erreur API stats 125: ${res.status} — ${await res.text()}`);
  return res.json();
}

export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('33')) return digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) return digits.slice(1);
  if (digits.length === 9) return digits;
  return digits;
}

export function toE164(phone) {
  const digits = normalizePhone(phone);
  if (digits.length === 9) return `+33${digits}`;
  return null;
}

export function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

export function formatName(name) {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.trim();
  const prenom = parts[0];
  const nom = parts.slice(1).map(p => p.toUpperCase()).join(' ');
  return `${prenom} ${nom}`;
}

// Format a group's REAL start time ("10:00", "14:30") for SMS text → "10h", "14h30".
// Shared source of truth: used both to build SMS messages AND to compare the
// hour actually sent (sms_queue.heure_groupe) against a group's current hour.
export function formatHeureSms(h) {
  if (!h) return '?';
  const [hh, mm] = String(h).split(':');
  return (mm && mm !== '00') ? `${parseInt(hh, 10)}h${mm}` : `${parseInt(hh, 10)}h`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthLabel(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export function isWeekend(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function getSessionType(session) {
  const name = (session.event_type_name || '').toLowerCase();
  if (name.includes('semaine')) return 'sem';
  return 'we';
}

// Classement semaine / week-end pour le DÉCOMPTE DE PAIE (groupes Adam).
// DOIT rester identique au SQL de référence (source de vérité du décompte) :
//   case when event_type_name = 'Formation 125 semaine' then 'semaine' else 'week_end' end
// Volontairement plus strict que getSessionType (comparaison exacte, pas includes)
// pour ne jamais diverger du calcul serveur.
export function getGroupeType125(session) {
  return session.event_type_name === 'Formation 125 semaine' ? 'semaine' : 'week_end';
}

export function getNiveauStyle(eleve) {
  const niveau = eleve?.niveau_scooter;
  const formRempli = eleve?.form_rempli;

  // Pas de formulaire du tout
  if (!formRempli) {
    return { borderColor: '#475569', bgColor: 'transparent', badgeColor: '#475569', badgeBg: 'rgba(71,85,105,0.1)', label: 'Formulaire manquant' };
  }
  // Formulaire rempli mais niveau null → jamais conduit (logique Typeform)
  if (!niveau) {
    return { borderColor: '#E24B4A', bgColor: 'rgba(226,75,74,0.06)', badgeColor: '#E24B4A', badgeBg: 'rgba(226,75,74,0.15)', label: 'Jamais conduit' };
  }
  // Niveau renseigné → lire la valeur
  if (niveau.startsWith('Débutant')) {
    return { borderColor: '#D85A30', bgColor: 'rgba(216,90,48,0.06)', badgeColor: '#D85A30', badgeBg: 'rgba(216,90,48,0.15)', label: 'Débutant' };
  }
  if (niveau.startsWith('Intermédiaire')) {
    return { borderColor: '#378ADD', bgColor: 'rgba(55,138,221,0.06)', badgeColor: '#378ADD', badgeBg: 'rgba(55,138,221,0.15)', label: 'Intermédiaire' };
  }
  if (niveau.startsWith('Avancé')) {
    return { borderColor: '#97C459', bgColor: 'rgba(151,196,89,0.06)', badgeColor: '#97C459', badgeBg: 'rgba(151,196,89,0.15)', label: 'Avancé' };
  }
  if (niveau.startsWith('Expert')) {
    return { borderColor: '#3B6D11', bgColor: 'rgba(59,109,17,0.08)', badgeColor: '#7fc95a', badgeBg: 'rgba(59,109,17,0.2)', label: 'Expert' };
  }
  return { borderColor: '#475569', bgColor: 'transparent', badgeColor: '#475569', badgeBg: 'rgba(71,85,105,0.1)', label: 'Non renseigné' };
}

// --- Groupes Formation 125 ---

const SCORE_NIVEAU = {
  'Expert': 5, 'Avancé': 4, 'Intermédiaire': 3,
  'Débutant': 2, 'Jamais conduit': 1, 'Formulaire manquant': 0, 'Non renseigné': 0,
};

// Fallbacks only — the real defaults are read from f125_config and injected
// into repartirGroupes(). These constants apply solely when the config is
// unreachable, which keeps repartirGroupes pure and the app resilient.
const DEFAULT_HEURES = ['10:00', '14:00'];
export const MAX_PAR_GROUPE = 6;
export const MAX_SCOOTERS = 3;
export const MAX_VOITURE = 3;

// Default start time for group `idx` (0-based). Uses the configured/fallback
// list, then derives "last known hour + 1h per extra group" — never the old
// `10 + idx*4` formula that produced 22:00 / 02:00 beyond 3 groups. Clamped
// to 23:00 so an absurd number of groups can never wrap past midnight.
export function heureForGroupe(idx, heuresDefaut) {
  const list = (heuresDefaut && heuresDefaut.length) ? heuresDefaut : DEFAULT_HEURES;
  if (idx < list.length) return list[idx];
  const last = list[list.length - 1] || '10:00';
  const [h, m] = last.split(':').map(Number);
  const nh = Math.min(23, (h || 0) + (idx - (list.length - 1)));
  return `${String(nh).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

export function getNiveauLabel(inv) {
  return getNiveauStyle(inv).label;
}

export function getNiveauScore(inv) {
  return SCORE_NIVEAU[getNiveauLabel(inv)] ?? 0;
}

export function getPrefScore(val) {
  if (!val) return 1; // indifferent
  const s = val.toLowerCase();
  // Après-midi first (highest specificity)
  if (s.includes('après-midi') || s.includes('13h') || s.includes('14h') || s.includes('15h')) return 0;
  // Tôt matin: early morning slot
  if (s.includes('8h') || s.includes('tôt')) return 3;
  // Matin: late morning slot (includes "Fin de matinée")
  if (s.includes('matin') || s.includes('10h') || s.includes('11h') || s.includes('12h')) return 2;
  return 1;
}

// Propose a DEFAULT split. Pure function: defaults come from f125_config and
// are injected via `opts` (the component fetches the config and passes it in).
// opts = { maxParGroupe, maxScooters, heuresDefaut }. Constants are fallbacks
// only. The result is a *proposal* — heure, capacite and group count are all
// editable afterwards in the UI and persisted independently.
export function repartirGroupes(invitees, opts = {}) {
  const maxParGroupe = opts.maxParGroupe ?? MAX_PAR_GROUPE;
  const maxScooters = opts.maxScooters ?? MAX_SCOOTERS;
  const heuresDefaut = opts.heuresDefaut;
  const nbEleves = invitees.length;

  // Helper: assign roles within a group.
  // Business rule: up to `maxScooters` physical PCX scooters; the strongest
  // riders get them, everyone else drives a car. (No hard car cap — car is the
  // fallback role; the soft capacity limit is enforced/surfaced per group.)
  const assignRoles = (membres) => {
    const sortedM = [...membres].sort((a, b) => getNiveauScore(b) - getNiveauScore(a));
    let scooterCount = 0;
    return sortedM.map((inv) => {
      const label = getNiveauLabel(inv);
      const peutScooter = label !== 'Jamais conduit'
        && label !== 'Formulaire manquant'
        && label !== 'Non renseigné';
      let role;
      if (peutScooter && scooterCount < maxScooters) {
        role = 'scooter';
        scooterCount++;
      } else {
        role = 'voiture';
      }
      return { ...inv, role, modifie_manuellement: false, ordre_passage: null, note: '' };
    });
  };

  // Single group case: everyone at the first default hour
  if (nbEleves <= maxParGroupe) {
    return [{
      numero: 1,
      heure: heureForGroupe(0, heuresDefaut),
      capacite: maxParGroupe,
      membres: assignRoles(invitees),
    }];
  }

  // Default number of groups = what it takes to seat everyone at capacity.
  const nbGroupes = Math.ceil(nbEleves / maxParGroupe);

  // PHASE 1 — Sort by preference DESC (tôt matin > matin > indifferent > aprem),
  //           then by niveau DESC as tiebreaker
  const sorted = [...invitees].sort((a, b) => {
    const prefDiff = getPrefScore(b.creneau_prefere) - getPrefScore(a.creneau_prefere);
    if (prefDiff !== 0) return prefDiff;
    return getNiveauScore(b) - getNiveauScore(a);
  });

  // PHASE 2 — Slice into groups: morning gets the first `tailleMatin` students
  //           (those with strongest morning preference), rest fills afternoon
  //           groups to capacity. Morning group size = remainder to preserve buffer.
  const tailleMatin = nbEleves - (nbGroupes - 1) * maxParGroupe;
  const buckets = [sorted.slice(0, tailleMatin)];
  for (let i = 1; i < nbGroupes; i++) {
    const start = tailleMatin + (i - 1) * maxParGroupe;
    buckets.push(sorted.slice(start, start + maxParGroupe));
  }

  // PHASE 3 — Light level homogenization (2-group case only): if niveau
  //           imbalance > 2 points, swap indifferents between groups to
  //           rebalance without breaking any clear preference.
  if (nbGroupes === 2 && buckets[0].length > 0 && buckets[1].length > 0) {
    const avg = (b) => b.reduce((s, x) => s + getNiveauScore(x), 0) / b.length;
    for (let iter = 0; iter < 5; iter++) {
      const diff = avg(buckets[0]) - avg(buckets[1]);
      if (Math.abs(diff) <= 2) break;
      const high = diff > 0 ? 0 : 1;
      const low = 1 - high;
      // Pick the highest-score indifferent in the overweighted group
      const highIdx = buckets[high]
        .map((m, i) => ({ m, i, score: getNiveauScore(m) }))
        .filter(x => getPrefScore(x.m.creneau_prefere) === 1)
        .sort((a, b) => b.score - a.score)[0]?.i ?? -1;
      // Pick the lowest-score indifferent in the underweighted group
      const lowIdx = buckets[low]
        .map((m, i) => ({ m, i, score: getNiveauScore(m) }))
        .filter(x => getPrefScore(x.m.creneau_prefere) === 1)
        .sort((a, b) => a.score - b.score)[0]?.i ?? -1;
      if (highIdx === -1 || lowIdx === -1) break;
      if (getNiveauScore(buckets[high][highIdx]) <= getNiveauScore(buckets[low][lowIdx])) break;
      const tmp = buckets[high][highIdx];
      buckets[high][highIdx] = buckets[low][lowIdx];
      buckets[low][lowIdx] = tmp;
    }
  }

  return buckets.map((membres, idx) => ({
    numero: idx + 1,
    heure: heureForGroupe(idx, heuresDefaut),
    capacite: maxParGroupe,
    membres: assignRoles(membres),
  }));
}

// Compute satisfaction score: how many students got their preferred slot.
// - Students with no form filled are excluded from the total.
// - Indifferent students are counted in total but not in respected/nonRespected.
// - Clear preference (matin or aprem) counts as respected iff assigned group matches.
export function computeSatisfaction(groupes) {
  let respected = 0;
  let total = 0;
  const nonRespectedList = [];
  groupes.forEach((g, gIdx) => {
    g.membres.forEach(m => {
      if (!m.form_rempli) return;
      total++;
      const pref = getPrefScore(m.creneau_prefere);
      if (pref === 1) return; // indifferent: neutral, not counted in respected
      const wantsMorning = pref >= 2;
      const inMorning = gIdx === 0;
      if (wantsMorning === inMorning) {
        respected++;
      } else {
        nonRespectedList.push({
          name: m.name || m.email,
          wants: wantsMorning ? 'matin' : 'après-midi',
          assignedGroup: gIdx + 1,
        });
      }
    });
  });
  return { respected, total, nonRespected: nonRespectedList.length, nonRespectedList };
}

const SB_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Prefer': 'return=representation',
};

export async function fetchGroupes(eventUuid) {
  const url = `${SUPABASE_URL}/rest/v1/formation_groupes?calendly_event_uuid=eq.${encodeURIComponent(eventUuid)}&order=groupe_numero,ordre_passage`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`Erreur fetch groupes: ${res.status}`);
  return res.json();
}

// Group metadata (heure / capacité / empty groups). Source of truth for a
// group's start time and capacity, independent of its members.
export async function fetchGroupesMeta(eventUuid) {
  const url = `${SUPABASE_URL}/rest/v1/formation_groupes_meta?calendly_event_uuid=eq.${encodeURIComponent(eventUuid)}&order=numero`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`Erreur fetch groupes meta: ${res.status}`);
  return res.json();
}

// DELETE helper for PostgREST. Path must always carry an event filter so we
// never wipe a whole table. 404 is treated as success (nothing to delete).
async function sbDelete(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: SB_HEADERS,
  });
  if (!res.ok && res.status !== 404) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Erreur delete (${path}): ${res.status} — ${errText}`);
  }
}

// Fetch the f125_config key/value table and return it as a flat object.
// Never hardcode values that live in this table — always read from here.
export async function fetchConfig() {
  const url = `${SUPABASE_URL}/rest/v1/f125_config?select=cle,valeur`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`Erreur fetch config: ${res.status}`);
  const rows = await res.json();
  const config = {};
  rows.forEach(r => { config[r.cle] = r.valeur; });
  return config;
}

// Generate the SMS message for one student. The hour is the group's REAL
// (possibly edited) start time, passed in by the caller — never re-derived
// from f125_config by group number. Address/phone still come from config.
// dateFormation must be a Date object (e.g. new Date(session.start_time)).
export function genererMessageSMS(prenom, dateFormation, heure, config) {
  const dateFormatee = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateFormation);
  const adresse = config?.adresse_formation || '';
  const tel = config?.telephone_contact || '';
  return `Bonjour ${prenom}, vos groupes pour votre formation 125cc Pedagomi ont été constitués. Vous faites partie du groupe de ${heure}. Rendez-vous le ${dateFormatee} à ${heure} au ${adresse}. En cas de problème appelez le ${tel}.`;
}

export function genererMessageFromTemplate(template, variables) {
  return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? `{${key}}`);
}

export async function sendSMSViaEdgeFunction({ calendly_event_uuid, groupe_numero, date_formation, heure_groupe, destinataires }) {
  const url = `${SUPABASE_URL}/functions/v1/send-sms-ringover`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ calendly_event_uuid, groupe_numero, date_formation, heure_groupe, destinataires }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Erreur envoi SMS: ${res.status} — ${errText}`);
  }
  return res.json();
}

export async function fetchSMSHistory(eventUuid) {
  const url = `${SUPABASE_URL}/rest/v1/sms_queue?calendly_event_uuid=eq.${encodeURIComponent(eventUuid)}&order=created_at.desc`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`Erreur fetch SMS history: ${res.status}`);
  return res.json();
}

export async function saveSmsTemplate(groupeNum, template) {
  const cle = `sms_template_groupe_${groupeNum}`;
  const url = `${SUPABASE_URL}/rest/v1/f125_config?cle=eq.${encodeURIComponent(cle)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify({ valeur: template }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Erreur save template: ${res.status} — ${errText}`);
  }
  return res.json();
}

// Persist the CURRENT in-memory snapshot (routine save — no recomputation).
// Keeps the DB exactly in sync with the UI state on every mutation:
//  1. upsert member rows (heure mirrors the group's real heure)
//  2. delete member rows that left every group (removed / regenerated away)
//  3. upsert group metadata (heure / capacité, incl. empty groups)
//  4. delete metadata of groups that no longer exist
// Not wrapped in a transaction (mono-user, <=18 students → negligible risk);
// each step has its own error handling.
export async function saveGroupes(eventUuid, dateFormation, groupes) {
  const event = String(eventUuid);

  // --- 1. Member rows ---
  // invitee_uuid is NOT NULL: coerce to string, fall back to email if id missing.
  const rows = [];
  const inviteeUuids = [];
  groupes.forEach(g => {
    g.membres.forEach((m, i) => {
      const raw = m.invitee_uuid ?? m.id;
      const uuid = raw != null ? String(raw) : String(m.email);
      inviteeUuids.push(uuid);
      rows.push({
        calendly_event_uuid: event,
        date_formation: dateFormation,
        groupe_numero: g.numero,
        heure_debut: g.heure,
        invitee_uuid: uuid,
        email: m.email,
        role: m.role,
        ordre_passage: i + 1,
        modifie_manuellement: m.modifie_manuellement || false,
        note: m.note || '',
        preference_creneau: m.creneau_prefere ?? null,
      });
    });
  });

  if (rows.length > 0) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/formation_groupes?on_conflict=calendly_event_uuid,invitee_uuid`,
      {
        method: 'POST',
        headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates, return=representation' },
        body: JSON.stringify(rows),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Erreur save groupes: ${res.status} — ${errText}`);
    }
  }

  // --- 2. Drop members no longer present in any group ---
  const memberFilter = inviteeUuids.length > 0
    ? `&invitee_uuid=not.in.(${inviteeUuids.map(u => `"${encodeURIComponent(u)}"`).join(',')})`
    : '';
  await sbDelete(`formation_groupes?calendly_event_uuid=eq.${encodeURIComponent(event)}${memberFilter}`);

  // --- 3. Group metadata (heure / capacité / empty groups) ---
  const metaRows = groupes.map(g => ({
    calendly_event_uuid: event,
    numero: g.numero,
    heure: g.heure,
    capacite: g.capacite ?? MAX_PAR_GROUPE,
    date_formation: dateFormation,
    updated_at: new Date().toISOString(),
  }));
  if (metaRows.length > 0) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/formation_groupes_meta?on_conflict=calendly_event_uuid,numero`,
      {
        method: 'POST',
        headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates, return=representation' },
        body: JSON.stringify(metaRows),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Erreur save groupes meta: ${res.status} — ${errText}`);
    }
  }

  // --- 4. Drop metadata of groups that no longer exist ---
  const numeros = groupes.map(g => g.numero);
  const metaFilter = numeros.length > 0 ? `&numero=not.in.(${numeros.join(',')})` : '';
  await sbDelete(`formation_groupes_meta?calendly_event_uuid=eq.${encodeURIComponent(event)}${metaFilter}`);

  return { ok: true };
}

// --- Attribution formateur (« fait par ») + override nb de groupes ---
// Table public.f125_session_meta (clé = calendly_uuid, accessible via la clé
// anon). Adam assure toutes les formations 125 par défaut ; une session passée
// sur Bilel ne compte pas dans la paie d'Adam. nb_groupes surcharge le nombre
// de groupes du créneau (défaut = 1 si null). Backend déjà en place — on ne
// fait que lire/écrire cette table.

// Toutes les lignes d'attribution, à fusionner par calendly_uuid côté client.
export async function fetchSessionsMeta() {
  const url = `${SUPABASE_URL}/rest/v1/f125_session_meta?select=calendly_uuid,fait_par,nb_groupes,note`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`Erreur fetch attribution sessions: ${res.status}`);
  return res.json();
}

// Upsert partiel keyé sur calendly_uuid. On n'envoie que les colonnes à
// modifier : PostgREST (merge-duplicates) ne met à jour que celles présentes,
// donc changer fait_par ne touche pas nb_groupes/note, et inversement.
export async function upsertSessionMeta(meta) {
  const url = `${SUPABASE_URL}/rest/v1/f125_session_meta?on_conflict=calendly_uuid`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates, return=representation' },
    body: JSON.stringify({ ...meta, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Erreur upsert attribution session: ${res.status} — ${errText}`);
  }
  return res.json();
}

export function consolidateData(raw) {
  const { sessions = [], invitees = [], formulaires = [], resumes_appels = [], kpis = {} } = raw;

  // --- Invitees arrive pre-enriched from API with: form_rempli, niveau_scooter, source_acquisition, a_appele, nb_appels, resumes_appels ---
  const enrichedInvitees = invitees.map(inv => ({
    ...inv,
    emailNorm: normalizeEmail(inv.email),
    phoneNorm: normalizePhone(inv.phone),
  }));

  // --- Build session map keyed by session id ---
  const sessionMap = {};
  sessions.forEach(s => {
    sessionMap[s.id] = { ...s, invitees: [] };
  });

  // --- Link invitees to sessions via calendly_event_id ---
  enrichedInvitees.forEach(inv => {
    const sKey = inv.calendly_event_id;
    if (sKey && sessionMap[sKey]) {
      sessionMap[sKey].invitees.push(inv);
    }
  });

  const enrichedSessions = Object.values(sessionMap).sort((a, b) =>
    new Date(a.start_time) - new Date(b.start_time)
  );

  // --- Motifs from resumes_appels ---
  const allMotifs = [];
  resumes_appels.forEach(r => {
    if (r.motifs) {
      if (Array.isArray(r.motifs)) {
        r.motifs.forEach(m => allMotifs.push(m));
      } else if (typeof r.motifs === 'string') {
        allMotifs.push(r.motifs);
      }
    }
  });

  const motifCounts = {};
  allMotifs.forEach(m => {
    const key = m.trim();
    if (key) motifCounts[key] = (motifCounts[key] || 0) + 1;
  });
  const motifsSorted = Object.entries(motifCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([motif, count]) => ({ motif, count }));

  return {
    sessions: enrichedSessions,
    eleves: enrichedInvitees,
    motifs: motifsSorted,
    kpis,
    raw,
  };
}
