const API_URL = 'https://yuolnqyejxtfpxntflle.supabase.co/functions/v1/dashboard-125?key=pedagomi2026';

export async function fetchDashboardData() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
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

export function consolidateData(raw) {
  const { sessions = [], invitees = [], formulaires = [], appels = [], resumes_appels = [], emails = [], kpis = {} } = raw;

  const formByEmail = {};
  formulaires.forEach(f => {
    const key = normalizeEmail(f.email);
    if (key) formByEmail[key] = f;
  });

  const appelsByEmail = {};
  appels.forEach(a => {
    const key = normalizeEmail(a.email);
    if (!key) return;
    if (!appelsByEmail[key]) appelsByEmail[key] = [];
    appelsByEmail[key].push(a);
  });

  const resumesByPhone = {};
  resumes_appels.forEach(r => {
    const key = normalizePhone(r.telephone || r.phone || r.numero);
    if (!key) return;
    if (!resumesByPhone[key]) resumesByPhone[key] = [];
    resumesByPhone[key].push(r);
  });

  const emailsByEmail = {};
  emails.forEach(e => {
    const key = normalizeEmail(e.from || e.expediteur || e.email);
    if (!key) return;
    if (!emailsByEmail[key]) emailsByEmail[key] = [];
    emailsByEmail[key].push(e);
  });

  const enrichedInvitees = invitees.map(inv => {
    const email = normalizeEmail(inv.email);
    const form = formByEmail[email];
    const invAppels = appelsByEmail[email] || [];
    const phone = normalizePhone(inv.phone || inv.telephone || (form && (form.phone || form.telephone)));
    const invResumes = resumesByPhone[phone] || [];
    const invEmails = emailsByEmail[email] || [];

    return {
      ...inv,
      emailNorm: email,
      phoneNorm: phone,
      formulaire: form || null,
      formulaireRempli: !!form,
      niveauScooter: form?.niveau_scooter || form?.niveau || form?.experience || '—',
      source: form?.source || inv.source || form?.utm_source || '—',
      appels: invAppels,
      nbAppels: invAppels.length,
      resumesAppels: invResumes,
      emails: invEmails,
      nbEmails: invEmails.length,
    };
  });

  const sessionMap = {};
  sessions.forEach(s => {
    const key = s.id || s.uri || s.start_time;
    sessionMap[key] = { ...s, invitees: [] };
  });

  enrichedInvitees.forEach(inv => {
    const sKey = inv.event_id || inv.session_id || inv.uri;
    if (sKey && sessionMap[sKey]) {
      sessionMap[sKey].invitees.push(inv);
    }
  });

  const enrichedSessions = Object.values(sessionMap).sort((a, b) =>
    new Date(a.start_time || a.date) - new Date(b.start_time || b.date)
  );

  const allMotifs = [];
  resumes_appels.forEach(r => {
    if (r.motifs) {
      if (Array.isArray(r.motifs)) {
        r.motifs.forEach(m => allMotifs.push(m));
      } else if (typeof r.motifs === 'string') {
        allMotifs.push(r.motifs);
      }
    }
    if (r.motif) allMotifs.push(r.motif);
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
