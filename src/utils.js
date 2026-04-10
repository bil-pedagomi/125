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

export function getNiveauLabel(inv) {
  return getNiveauStyle(inv).label;
}

export function getNiveauScore(inv) {
  return SCORE_NIVEAU[getNiveauLabel(inv)] ?? 0;
}

export function repartirGroupes(invitees) {
  // 1. Sort by niveau score DESC
  const sorted = [...invitees].sort((a, b) => getNiveauScore(b) - getNiveauScore(a));
  const nbEleves = sorted.length;

  // Helper: assign roles within a group (top 3 qualified → scooter)
  const assignRoles = (membres) => {
    const sortedM = [...membres].sort((a, b) => getNiveauScore(b) - getNiveauScore(a));
    let scooterCount = 0;
    return sortedM.map((inv) => {
      const label = getNiveauLabel(inv);
      const canScooter = scooterCount < MAX_SCOOTERS
        && label !== 'Jamais conduit'
        && label !== 'Formulaire manquant'
        && label !== 'Non renseigné';
      const role = canScooter ? 'scooter' : 'voiture';
      if (canScooter) scooterCount++;
      return { ...inv, role, modifie_manuellement: false, ordre_passage: null, note: '' };
    });
  };

  // 2. Single group case: everyone at 10:00
  if (nbEleves <= MAX_PAR_GROUPE) {
    return [{
      numero: 1,
      heure: HEURES_GROUPES[0],
      membres: assignRoles(sorted),
    }];
  }

  // 3. Multiple groups: fill afternoon groups to MAX first,
  //    leave remainder in morning group to preserve buffer for last-minute bookings
  const nbGroupes = Math.ceil(nbEleves / MAX_PAR_GROUPE);
  const remainder = nbEleves - (nbGroupes - 1) * MAX_PAR_GROUPE;
  // Sizes: [remainder (morning), MAX, MAX, ...]
  const groupSizes = [remainder];
  for (let i = 1; i < nbGroupes; i++) groupSizes.push(MAX_PAR_GROUPE);

  // 4. Round-robin distribution respecting size caps (for level homogeneity)
  const buckets = Array.from({ length: nbGroupes }, () => []);
  let cursor = 0;
  sorted.forEach(inv => {
    let guard = 0;
    while (buckets[cursor].length >= groupSizes[cursor] && guard < nbGroupes) {
      cursor = (cursor + 1) % nbGroupes;
      guard++;
    }
    buckets[cursor].push(inv);
    cursor = (cursor + 1) % nbGroupes;
  });

  // 5. Preference-based swaps: try to match creneau_prefere
  if (nbGroupes >= 2) {
    for (let gi = 0; gi < nbGroupes; gi++) {
      for (let mi = 0; mi < buckets[gi].length; mi++) {
        const inv = buckets[gi][mi];
        const pref = inv.creneau_prefere || '';
        const wantsPM = pref.includes('après-midi') || pref.includes('13h') || pref.includes('15h');
        const wantsAM = pref.includes('matin') || pref.includes('8h') || pref.includes('10h');
        const targetGroup = wantsPM ? 1 : wantsAM ? 0 : -1;
        if (targetGroup === -1 || targetGroup === gi) continue;
        if (targetGroup >= nbGroupes) continue;
        // Find a swap candidate with equivalent score in target group
        const myScore = getNiveauScore(inv);
        const swapIdx = buckets[targetGroup].findIndex((other, oi) => {
          const otherPref = other.creneau_prefere || '';
          const otherWantsPM = otherPref.includes('après-midi') || otherPref.includes('13h') || otherPref.includes('15h');
          const otherWantsAM = otherPref.includes('matin') || otherPref.includes('8h') || otherPref.includes('10h');
          const otherTarget = otherWantsPM ? 1 : otherWantsAM ? 0 : -1;
          // Only swap if the other person prefers our group or is indifferent
          return Math.abs(getNiveauScore(other) - myScore) <= 1
            && (otherTarget === gi || otherTarget === -1);
        });
        if (swapIdx !== -1) {
          const tmp = buckets[targetGroup][swapIdx];
          buckets[targetGroup][swapIdx] = inv;
          buckets[gi][mi] = tmp;
        }
      }
    }
  }

  // 6. Build groups with assigned roles
  return buckets.map((membres, idx) => ({
    numero: idx + 1,
    heure: HEURES_GROUPES[idx] || `${10 + idx * 4}:00`,
    membres: assignRoles(membres),
  }));
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

export async function saveGroupes(eventUuid, dateFormation, groupes) {
  // Build rows for upsert
  const rows = [];
  groupes.forEach(g => {
    g.membres.forEach((m, i) => {
      rows.push({
        calendly_event_uuid: eventUuid,
        date_formation: dateFormation,
        groupe_numero: g.numero,
        heure_debut: g.heure,
        invitee_uuid: m.id || null,
        email: m.email,
        role: m.role,
        ordre_passage: i + 1,
        modifie_manuellement: m.modifie_manuellement || false,
        note: m.note || '',
      });
    });
  });

  // Delete existing rows for this event, then insert
  await fetch(
    `${SUPABASE_URL}/rest/v1/formation_groupes?calendly_event_uuid=eq.${encodeURIComponent(eventUuid)}`,
    { method: 'DELETE', headers: SB_HEADERS }
  );
  const res = await fetch(`${SUPABASE_URL}/rest/v1/formation_groupes`, {
    method: 'POST',
    headers: SB_HEADERS,
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Erreur save groupes: ${res.status}`);
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
