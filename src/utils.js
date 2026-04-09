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
  const dejaCon = eleve?.deja_conduit;
  const niveau = eleve?.niveau_scooter;
  const formRempli = eleve?.form_rempli;

  if (!formRempli && dejaCon == null) {
    return { borderColor: '#475569', bgColor: 'transparent', badgeColor: '#475569', badgeBg: 'rgba(71,85,105,0.1)', label: 'Formulaire manquant' };
  }
  if (dejaCon === 0 || dejaCon === '0') {
    return { borderColor: '#E24B4A', bgColor: 'rgba(226,75,74,0.06)', badgeColor: '#E24B4A', badgeBg: 'rgba(226,75,74,0.15)', label: 'Jamais conduit' };
  }
  if (niveau?.startsWith('Débutant')) {
    return { borderColor: '#D85A30', bgColor: 'rgba(216,90,48,0.06)', badgeColor: '#D85A30', badgeBg: 'rgba(216,90,48,0.15)', label: 'Débutant' };
  }
  if (niveau?.startsWith('Intermédiaire')) {
    return { borderColor: '#378ADD', bgColor: 'rgba(55,138,221,0.06)', badgeColor: '#378ADD', badgeBg: 'rgba(55,138,221,0.15)', label: 'Intermédiaire' };
  }
  if (niveau?.startsWith('Avancé')) {
    return { borderColor: '#97C459', bgColor: 'rgba(151,196,89,0.06)', badgeColor: '#97C459', badgeBg: 'rgba(151,196,89,0.15)', label: 'Avancé' };
  }
  if (niveau?.startsWith('Expert')) {
    return { borderColor: '#3B6D11', bgColor: 'rgba(59,109,17,0.08)', badgeColor: '#7fc95a', badgeBg: 'rgba(59,109,17,0.2)', label: 'Expert' };
  }
  return { borderColor: '#475569', bgColor: 'transparent', badgeColor: '#475569', badgeBg: 'rgba(71,85,105,0.1)', label: 'Non renseigné' };
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
