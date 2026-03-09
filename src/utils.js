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

export function getSessionType(session) {
  const name = (session.event_type_name || '').toLowerCase();
  if (name.includes('semaine')) return 'sem';
  return 'we';
}

const PRICE = 199;

export function consolidateData(raw) {
  const { sessions = [], invitees = [], formulaires = [], appels = [], resumes_appels = [], emails = [], kpis = {} } = raw;

  // --- Index formulaires by email (field is "Votre email" or "email_normalise") ---
  const formByEmail = {};
  formulaires.forEach(f => {
    const key = normalizeEmail(f['Votre email'] || f.email_normalise || f.email);
    if (key) formByEmail[key] = f;
  });

  // --- Index appels by email (v_125_appels has: email, tel_norm, a_appele, nb_appels) ---
  const appelsByEmail = {};
  appels.forEach(a => {
    const key = normalizeEmail(a.email);
    if (!key) return;
    if (!appelsByEmail[key]) appelsByEmail[key] = [];
    appelsByEmail[key].push(a);
  });

  // --- Index resumes_appels by normalized phone (field: telephone) ---
  const resumesByPhone = {};
  resumes_appels.forEach(r => {
    const key = normalizePhone(r.telephone);
    if (!key) return;
    if (!resumesByPhone[key]) resumesByPhone[key] = [];
    resumesByPhone[key].push(r);
  });

  // --- Index emails by sender (field: email_expediteur) ---
  const emailsByEmail = {};
  emails.forEach(e => {
    const key = normalizeEmail(e.email_expediteur);
    if (!key) return;
    if (!emailsByEmail[key]) emailsByEmail[key] = [];
    emailsByEmail[key].push(e);
  });

  // --- Enrich invitees with cross-referenced data ---
  const enrichedInvitees = invitees.map(inv => {
    const email = normalizeEmail(inv.email);
    const form = formByEmail[email];
    const appelsForInv = appelsByEmail[email] || [];
    const aAppele = appelsForInv.some(a => a.a_appele);
    const nbAppels = appelsForInv.reduce((sum, a) => sum + (a.nb_appels || 0), 0);
    const phone = normalizePhone(inv.phone || (form && form.tel_norm));
    const invResumes = phone ? (resumesByPhone[phone] || []) : [];
    const invEmails = emailsByEmail[email] || [];

    // Niveau scooter from formulaire or from invitee questions_and_answers
    let niveauScooter = '—';
    if (form) {
      niveauScooter = form['Avez-vous déjà conduit un scooter ?'] ||
        form['Comment évalueriez-vous votre niveau de conduite de scooter ?'] || '—';
    }
    if (niveauScooter === '—' && inv.questions_and_answers) {
      const niveauQ = inv.questions_and_answers.find(q =>
        (q.question || '').toLowerCase().includes('niveau')
      );
      if (niveauQ) niveauScooter = niveauQ.answer;
    }

    // Source from formulaire
    const source = form ? (form['Comment nous avez-vous trouvé ?'] || '—') : '—';

    return {
      ...inv,
      emailNorm: email,
      phoneNorm: phone,
      formulaire: form || null,
      formulaireRempli: !!form,
      niveauScooter,
      source,
      appelsData: appelsForInv,
      aAppele,
      nbAppels,
      resumesAppels: invResumes,
      emails: invEmails,
      nbEmails: invEmails.length,
    };
  });

  // --- Build session map keyed by session id (int) ---
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
