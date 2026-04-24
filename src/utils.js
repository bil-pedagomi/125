const API_URL = 'https://yuolnqyejxtfpxntflle.supabase.co/functions/v1/dashboard-125?key=eb498a94-3602-46a4-bce7-df288002402d';
const SUPABASE_URL = 'https://yuolnqyejxtfpxntflle.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1b2xucXllanh0ZnB4bnRmbGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTIzNzcsImV4cCI6MjA4Nzc2ODM3N30.cktsC7ly3ImeIY_2mVmxo0phSTz3obIG3UHgl_iDa7U';

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
  if (!res.ok) throw new Error(`Erreur trafic API: ${res.status}`);
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
  if (!res.ok) throw new Error(`Erreur API stats 125: ${res.status}`);
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

const HEURES_GROUPES = ['10:00', '14:00', '18:00'];
export const MAX_PAR_GROUPE = 6;
const MAX_SCOOTERS = 3;
export const MAX_VOITURE = 3;

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

export function repartirGroupes(invitees) {
  const nbEleves = invitees.length;

  // Helper: assign roles within a group.
  // Business rule: max 3 scooters + max 3 voitures = 6 per group.
  // Top 3 qualified → scooter; next 3 → voiture. Overflow falls back to
  // voiture (a validation alert will flag the group as invalid).
  const assignRoles = (membres) => {
    const sortedM = [...membres].sort((a, b) => getNiveauScore(b) - getNiveauScore(a));
    let scooterCount = 0;
    let voitureCount = 0;
    return sortedM.map((inv) => {
      const label = getNiveauLabel(inv);
      const peutScooter = label !== 'Jamais conduit'
        && label !== 'Formulaire manquant'
        && label !== 'Non renseigné';
      let role;
      if (peutScooter && scooterCount < MAX_SCOOTERS) {
        role = 'scooter';
        scooterCount++;
      } else if (voitureCount < MAX_VOITURE) {
        role = 'voiture';
        voitureCount++;
      } else {
        // Overflow — keep assigning to voiture so the record stays valid;
        // getValidationErrors() will surface the breach.
        role = 'voiture';
        voitureCount++;
      }
      return { ...inv, role, modifie_manuellement: false, ordre_passage: null, note: '' };
    });
  };

  // Single group case: everyone at 10:00
  if (nbEleves <= MAX_PAR_GROUPE) {
    return [{
      numero: 1,
      heure: HEURES_GROUPES[0],
      membres: assignRoles(invitees),
    }];
  }

  const nbGroupes = Math.ceil(nbEleves / MAX_PAR_GROUPE);

  // PHASE 1 — Sort by preference DESC (tôt matin > matin > indifferent > aprem),
  //           then by niveau DESC as tiebreaker
  const sorted = [...invitees].sort((a, b) => {
    const prefDiff = getPrefScore(b.creneau_prefere) - getPrefScore(a.creneau_prefere);
    if (prefDiff !== 0) return prefDiff;
    return getNiveauScore(b) - getNiveauScore(a);
  });

  // PHASE 2 — Slice into groups: morning gets the first `tailleMatin` students
  //           (those with strongest morning preference), rest fills afternoon
  //           groups to MAX. Morning group size = remainder to preserve buffer.
  const tailleMatin = nbEleves - (nbGroupes - 1) * MAX_PAR_GROUPE;
  const buckets = [sorted.slice(0, tailleMatin)];
  for (let i = 1; i < nbGroupes; i++) {
    const start = tailleMatin + (i - 1) * MAX_PAR_GROUPE;
    buckets.push(sorted.slice(start, start + MAX_PAR_GROUPE));
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
    heure: HEURES_GROUPES[idx] || `${10 + idx * 4}:00`,
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

// Generate the SMS message for one student. All dynamic values (heure,
// adresse, telephone) come from the config object — nothing is hardcoded.
// dateFormation must be a Date object (e.g. new Date(session.start_time)).
export function genererMessageSMS(prenom, dateFormation, numeroGroupe, config) {
  const heure = config?.[`heure_groupe_${numeroGroupe}`] || '';
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

export async function saveGroupes(eventUuid, dateFormation, groupes) {
  // Build rows for upsert. invitee_uuid is NOT NULL in the schema, so
  // coerce to string and fall back to email if id is missing.
  const rows = [];
  groupes.forEach(g => {
    g.membres.forEach((m, i) => {
      const uuid = m.invitee_uuid ?? m.id;
      rows.push({
        calendly_event_uuid: String(eventUuid),
        date_formation: dateFormation,
        groupe_numero: g.numero,
        heure_debut: g.heure,
        invitee_uuid: uuid != null ? String(uuid) : String(m.email),
        email: m.email,
        role: m.role,
        ordre_passage: i + 1,
        modifie_manuellement: m.modifie_manuellement || false,
        note: m.note || '',
        preference_creneau: m.creneau_prefere ?? null,
      });
    });
  });

  // Single atomic UPSERT on the (calendly_event_uuid, invitee_uuid) unique
  // constraint. Updates the row in place if it exists, inserts otherwise.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/formation_groupes?on_conflict=calendly_event_uuid,invitee_uuid`,
    {
      method: 'POST',
      headers: {
        ...SB_HEADERS,
        'Prefer': 'resolution=merge-duplicates, return=representation',
      },
      body: JSON.stringify(rows),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Erreur save groupes: ${res.status} — ${errText}`);
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
