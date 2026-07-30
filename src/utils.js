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

// Identité stable d'un élève, utilisée partout où il faut savoir si deux objets
// désignent la même personne (appartenance à un groupe, grappes d'amis,
// persistance, rapprochement SMS). invitee_uuid est la clé fiable ; id/email
// servent de repli.
export function inviteeKey(m) {
  return String(m?.invitee_uuid ?? m?.id ?? m?.email ?? '').trim().toLowerCase();
}

// Niveaux qui ne justifient pas un scooter par eux-mêmes : l'algo AUTO ne met
// jamais ces élèves sur un PCX (un humain peut toujours forcer à la main).
export const NIVEAUX_SANS_SCOOTER = ['Jamais conduit', 'Formulaire manquant', 'Non renseigné'];

export function peutPiloterScooter(inv) {
  return !NIVEAUX_SANS_SCOOTER.includes(getNiveauLabel(inv));
}

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

// --- Temps de trajet domicile → auto-école (question Typeform) ---
// Score croissant = vient de plus en plus loin. Critère SOUPLE de répartition :
// plus un élève vient de loin, plus on privilégie le groupe du matin — sinon il
// termine tard ET enchaîne 2 h de route. Les libellés sont ceux du Typeform ;
// l'ordre des règles va du plus lointain au plus proche (le plus spécifique
// d'abord, « autre département » contenant déjà une durée).
const TRAJET_NIVEAUX = [
  { re: /autre d[ée]partement|\+\s*4\s*h|plus de 4\s*h/i, label: 'Autre département (+4h)', short: '+4h', score: 4 },
  { re: /plus de 2\s*h|\+\s*2\s*h|>\s*2\s*h/i, label: 'Plus de 2h', short: '>2h', score: 3 },
  { re: /1\s*h\s*(?:à|a|-|–|et)\s*2\s*h/i, label: '1h à 2h', short: '1–2h', score: 2 },
  { re: /30\s*(?:min)?\s*(?:à|a|-|–|et)\s*1\s*h/i, label: '30 min à 1h', short: '30–60 min', score: 1 },
  { re: /moins de 30|<\s*30/i, label: 'Moins de 30 min', short: '<30 min', score: 0 },
];

// À partir de ce score, on considère que l'élève « vient de loin » et qu'un
// horaire du matin est préférable (≥ 1 h de trajet).
export const TRAJET_LOIN_SCORE_MIN = 2;

// Renvoie toujours un objet : { raw, label, short, score, loin }. score === null
// = information absente (formulaire non rempli / question sans réponse) : on ne
// pénalise jamais l'élève dans ce cas, on ne l'avantage pas non plus.
export function getTrajetInfo(inv) {
  const raw = (inv?.temps_trajet || '').trim();
  if (!raw) return { raw: null, label: null, short: null, score: null, loin: false };
  const hit = TRAJET_NIVEAUX.find(t => t.re.test(raw));
  // Libellé inconnu (réponse Typeform modifiée) : on l'affiche tel quel plutôt
  // que de le masquer, mais il ne pèse pas dans la répartition.
  if (!hit) return { raw, label: raw, short: raw, score: null, loin: false };
  return { raw, label: hit.label, short: hit.short, score: hit.score, loin: hit.score >= TRAJET_LOIN_SCORE_MIN };
}

export function getTrajetScore(inv) {
  const s = getTrajetInfo(inv).score;
  return s == null ? 0 : s; // inconnu = neutre
}

// --- Amis / accompagnants (question Typeform) ---
// Le formulaire demande « venez-vous avec un proche ? » puis son nom complet en
// TEXTE LIBRE : « Rachid LADIB », « Rachid LADIB et Muhammed ALTUNDAG »,
// « Pol edouard pelé » (ordre prénom/nom variable, accents et casse
// aléatoires). On rapproche ces noms des inscrits de la session pour former des
// grappes d'amis, à garder ensemble dans le même groupe si possible.

// Mots à ignorer dans un nom : liaisons et liens de parenté que les élèves
// ajoutent parfois (« mon frère Adem »).
const NAME_STOP_TOKENS = new Set([
  'de', 'du', 'des', 'le', 'la', 'les', 'et', 'ou', 'avec', 'mon', 'ma', 'mes',
  'ami', 'amie', 'amis', 'amies', 'copain', 'copine', 'frere', 'soeur', 'cousin',
  'cousine', 'conjoint', 'conjointe', 'mari', 'femme', 'fils', 'fille', 'pere',
  'mere', 'oncle', 'tante', 'neveu', 'niece', 'collegue', 'voisin', 'voisine',
]);

// Tokens comparables d'un nom : sans accents, minuscules, ponctuation et
// tirets convertis en séparateurs (« Jean-Chiraze » → jean, chiraze).
export function nameTokens(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(t => t.length > 1 && !NAME_STOP_TOKENS.has(t));
}

// Un champ « accompagnant » peut citer plusieurs personnes.
function splitAccompagnants(raw) {
  return String(raw || '')
    .split(/\s+et\s+|\s*[,&+/;]\s*/i)
    .map(s => s.trim())
    .filter(Boolean);
}

// Rapproche un nom libre de la liste des inscrits. On exige 2 tokens communs
// (prénom + nom) ; avec un seul token on n'accepte que s'il ne désigne qu'une
// personne de la session. En cas d'ambiguïté on ne lie RIEN : un faux
// rapprochement déplacerait un élève sans raison.
function matchRoster(raw, roster) {
  const tokens = nameTokens(raw);
  if (tokens.length === 0) return null;
  const scored = roster.map(r => ({
    r,
    common: (() => {
      const rt = nameTokens(r.name);
      return tokens.filter(t => rt.includes(t)).length;
    })(),
  }));
  const best = scored.reduce((max, s) => Math.max(max, s.common), 0);
  if (best === 0) return null;
  const winners = scored.filter(s => s.common === best);
  if (winners.length > 1) return null; // ex æquo → on ne devine pas
  return winners[0].r;
}

const AMI_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const AMI_COLORS = ['#a855f7', '#14b8a6', '#f59e0b', '#38bdf8', '#f472b6', '#84cc16'];

// Construit les grappes d'amis d'une session (union-find sur les déclarations).
// Une déclaration unilatérale suffit à lier deux élèves : si A dit venir avec B,
// ils sont amis même si B n'a rien déclaré.
// Retour :
//   byKey      : inviteeKey → { id, label, color, membres:[{key,name}] }
//                (uniquement les grappes de 2 élèves ou plus)
//   clusters   : liste des grappes (même contenu, pour les récaps)
//   nonInscrits: inviteeKey → noms déclarés introuvables dans la session
export function buildAmisClusters(invitees) {
  const roster = (invitees || []).filter(inv => inviteeKey(inv));
  const idxByKey = new Map();
  roster.forEach((inv, i) => { if (!idxByKey.has(inviteeKey(inv))) idxByKey.set(inviteeKey(inv), i); });

  const parent = roster.map((_, i) => i);
  const find = (i) => { let r = i; while (parent[r] !== r) r = parent[r]; while (parent[i] !== r) { const n = parent[i]; parent[i] = r; i = n; } return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };

  const nonInscrits = {};
  roster.forEach((inv, i) => {
    if (!inv.accompagnant_nom_complet) return;
    splitAccompagnants(inv.accompagnant_nom_complet).forEach(nom => {
      const others = roster.filter((_, j) => j !== i);
      const found = matchRoster(nom, others);
      if (found) {
        union(i, idxByKey.get(inviteeKey(found)));
      } else {
        const k = inviteeKey(inv);
        if (!nonInscrits[k]) nonInscrits[k] = [];
        nonInscrits[k].push(nom);
      }
    });
  });

  const parRacine = new Map();
  roster.forEach((inv, i) => {
    const r = find(i);
    if (!parRacine.has(r)) parRacine.set(r, []);
    parRacine.get(r).push(inv);
  });

  const clusters = [];
  const byKey = {};
  [...parRacine.values()]
    .filter(membres => membres.length > 1)
    .forEach((membres, n) => {
      const cluster = {
        id: n + 1,
        label: AMI_LABELS[n % AMI_LABELS.length],
        color: AMI_COLORS[n % AMI_COLORS.length],
        membres: membres.map(m => ({ key: inviteeKey(m), name: m.name || m.email })),
      };
      clusters.push(cluster);
      cluster.membres.forEach(m => { byKey[m.key] = cluster; });
    });

  return { byKey, clusters, nonInscrits };
}

// Un groupe est « du matin » si son heure de début est avant midi. On se base
// sur l'heure RÉELLE (éditable) et jamais sur le numéro du groupe : avec 3
// groupes, les groupes 2 et 3 sont tous les deux l'après-midi.
export function isGroupeMatin(g) {
  const h = parseInt(String(g?.heure || '').slice(0, 2), 10);
  return Number.isFinite(h) ? h < 12 : false;
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
//
// CRITÈRES, du plus fort au plus souple (aucun n'est une obligation dure) :
//   1. Créneau demandé dans le formulaire      — on ne contredit jamais un
//                                                « je veux l'après-midi »
//   2. Temps de trajet : loin → plutôt le matin (finir tôt quand on a 2 h de
//                                                route au retour)
//   3. Amis déclarés   : ensemble dans le même groupe
//   4. Niveaux         : équilibrés entre groupes, et assez de pilotes par
//                        groupe pour ne pas laisser un PCX au garage
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
      let role;
      if (peutPiloterScooter(inv) && scooterCount < maxScooters) {
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
  const amis = buildAmisClusters(invitees);

  // PHASE 1 — Priorité « matin » de chaque élève. La préférence explicite pèse
  // dix fois plus que le trajet : le trajet n'est qu'un arbitrage entre élèves
  // à préférence égale. Et il est neutralisé pour qui a demandé l'après-midi —
  // venir de loin ne doit jamais retourner une demande explicite. Le niveau ne
  // sert que de départage à égalité parfaite.
  const scoreMatin = (inv) => {
    const pref = getPrefScore(inv.creneau_prefere);
    const trajet = pref === 0 ? 0 : getTrajetScore(inv);
    return pref * 10 + trajet * 2 + getNiveauScore(inv) * 0.1;
  };

  // PHASE 2 — Unités indivisibles : une grappe d'amis se déplace en bloc. Sauf
  // si ses membres ont des créneaux opposés (l'un veut le matin, l'autre
  // l'après-midi) : la demande explicite passe alors devant l'amitié. Une
  // grappe plus grande qu'un groupe ne peut évidemment pas rester entière.
  const parKey = new Map(invitees.map(inv => [inviteeKey(inv), inv]));
  const dejaPlace = new Set();
  const unites = [];
  invitees.forEach(inv => {
    const key = inviteeKey(inv);
    if (dejaPlace.has(key)) return;
    const cluster = amis.byKey[key];
    let membres = [inv];
    if (cluster) {
      const grappe = cluster.membres.map(x => parKey.get(x.key)).filter(Boolean);
      const prefs = grappe.map(m => getPrefScore(m.creneau_prefere));
      const conflit = prefs.some(p => p === 0) && prefs.some(p => p >= 2);
      if (!conflit && grappe.length <= maxParGroupe) membres = grappe;
    }
    membres.forEach(m => dejaPlace.add(inviteeKey(m)));
    unites.push({
      membres,
      // Moyenne : une paire mi-matin / mi-indifférente ne double pas la file
      // devant un élève seul qui a explicitement demandé le matin.
      score: membres.reduce((s, m) => s + scoreMatin(m), 0) / membres.length,
    });
  });

  // PHASE 3 — Remplissage chronologique. Le groupe du matin garde le reliquat
  // (et donc le buffer historique), les suivants sont remplis à capacité. On
  // place les unités entières par priorité « matin » décroissante ; une grappe
  // qui ne rentre dans aucun groupe est éclatée en dernier recours.
  const capacites = [nbEleves - (nbGroupes - 1) * maxParGroupe];
  for (let i = 1; i < nbGroupes; i++) capacites.push(maxParGroupe);
  const buckets = capacites.map(() => []);
  const placer = (membres) => {
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].length + membres.length <= capacites[i]) {
        buckets[i].push(...membres);
        return true;
      }
    }
    return false;
  };
  unites
    .sort((a, b) => (b.score - a.score) || (b.membres.length - a.membres.length))
    .forEach(u => {
      if (placer(u.membres)) return;
      u.membres.forEach(m => {
        // La somme des capacités vaut l'effectif : un élève seul trouve
        // toujours une place. Le dernier groupe reste un filet de sécurité.
        if (!placer([m])) buckets[buckets.length - 1].push(m);
      });
    });

  // PHASE 4 — Amélioration locale. Le remplissage glouton ci-dessus est bon mais
  // pas optimal : une grappe de 3 amis qui ne rentre plus dans le groupe du
  // matin s'y fait doubler par des élèves moins prioritaires. On note donc la
  // répartition entière, puis on essaie tous les échanges entre deux groupes en
  // gardant le meilleur, jusqu'à ne plus rien améliorer.
  //
  // Les poids traduisent l'ordre de priorité, et l'écart est volontairement
  // large : aucune combinaison de critères souples ne peut « acheter » un
  // créneau demandé. Les effectifs des groupes ne changent jamais (on échange,
  // on ne déplace pas), donc le dimensionnement matin/après-midi est préservé.
  const POIDS = {
    creneau: 500, // créneau explicitement demandé dans le formulaire
    ami: 60,      // par ami retrouvé dans le même groupe
    trajet: 10,   // par palier de trajet, dégressif du matin vers le soir
    scooter: 20,  // par scooter que le groupe ne peut pas armer, faute de pilote
    niveau: 6,    // écart de niveau moyen entre le groupe le plus fort et le plus faible
  };
  const heures = buckets.map((_, i) => heureForGroupe(i, heuresDefaut));
  const matinParGroupe = heures.map(heure => isGroupeMatin({ heure }));
  const moyenneNiveau = (b) => (b.length ? b.reduce((s, x) => s + getNiveauScore(x), 0) / b.length : 0);
  const nbPilotes = (b) => b.filter(peutPiloterScooter).length;
  const dernier = Math.max(1, buckets.length - 1);

  const noter = (bks) => {
    let score = 0;
    bks.forEach((membres, i) => {
      const parCluster = new Map();
      membres.forEach(m => {
        const pref = getPrefScore(m.creneau_prefere);
        if (pref !== 1) {
          score += ((pref >= 2) === matinParGroupe[i] ? 1 : -1) * POIDS.creneau;
        }
        // Trajet : d'autant mieux récompensé que le groupe est tôt. Neutralisé
        // pour qui a demandé l'après-midi — on ne le contredit pas « pour son
        // bien ».
        if (pref !== 0) {
          score += POIDS.trajet * getTrajetScore(m) * ((dernier - i) / dernier);
        }
        const c = amis.byKey[inviteeKey(m)];
        if (c) parCluster.set(c, (parCluster.get(c) || 0) + 1);
      });
      // Amis réunis : un bonus par ami présent en plus du premier.
      parCluster.forEach(n => { score += POIDS.ami * (n - 1); });
      // Scooters non armables faute de pilotes dans ce groupe.
      score -= POIDS.scooter * Math.max(0, Math.min(maxScooters, membres.length) - nbPilotes(membres));
    });
    // Équilibre des niveaux : pénalise l'écart entre groupes (évite le groupe
    // 100 % débutants face au groupe 100 % confirmés).
    const moyennes = bks.filter(b => b.length).map(moyenneNiveau);
    if (moyennes.length > 1) {
      score -= POIDS.niveau * (Math.max(...moyennes) - Math.min(...moyennes));
    }
    return score;
  };

  const echanger = (a, i, b, j) => {
    const tmp = buckets[a][i];
    buckets[a][i] = buckets[b][j];
    buckets[b][j] = tmp;
  };

  let scoreCourant = noter(buckets);
  // Effectifs réels ≤ 18 élèves sur ≤ 4 groupes : le balayage complet coûte
  // quelques centaines d'évaluations, négligeable. La borne évite juste une
  // boucle infinie si deux échanges s'annulaient à score égal.
  for (let iter = 0; iter < 50; iter++) {
    let meilleur = null;
    for (let a = 0; a < buckets.length; a++) {
      for (let b = a + 1; b < buckets.length; b++) {
        for (let i = 0; i < buckets[a].length; i++) {
          for (let j = 0; j < buckets[b].length; j++) {
            echanger(a, i, b, j);
            const s = noter(buckets);
            echanger(a, i, b, j); // retour arrière
            if (s > scoreCourant + 1e-9 && (!meilleur || s > meilleur.s)) meilleur = { a, i, b, j, s };
          }
        }
      }
    }
    if (!meilleur) break;
    echanger(meilleur.a, meilleur.i, meilleur.b, meilleur.j);
    scoreCourant = meilleur.s;
  }

  return buckets.map((membres, idx) => ({
    numero: idx + 1,
    heure: heures[idx],
    capacite: maxParGroupe,
    membres: assignRoles(membres),
  }));
}

// Compute satisfaction score: how many students got their preferred slot.
// - Students with no form filled are excluded from the total.
// - Indifferent students are excluded too : ils ne peuvent être ni satisfaits ni
//   déçus, les compter dans le total ferait afficher « 1/12 » sur une session
//   où le seul élève ayant une préférence l'a obtenue.
// - Clear preference (matin or aprem) counts as respected iff assigned group matches.
// Le rapport couvre aussi les deux critères souples : les longs trajets placés
// l'après-midi et les grappes d'amis séparées. `amis` (buildAmisClusters) peut
// être fourni par l'appelant pour éviter de recalculer les grappes.
export function computeSatisfaction(groupes, amis) {
  let respected = 0;
  let total = 0;
  const nonRespectedList = [];
  // Matin = heure réelle avant midi (jamais « groupe n° 1 ») : avec 3 groupes,
  // 14 h et 18 h sont tous les deux des après-midi.
  const estMatin = groupes.map(isGroupeMatin);
  groupes.forEach((g, gIdx) => {
    g.membres.forEach(m => {
      if (!m.form_rempli) return;
      const pref = getPrefScore(m.creneau_prefere);
      if (pref === 1) return; // indifférent : ni satisfait ni déçu
      total++;
      const wantsMorning = pref >= 2;
      if (wantsMorning === estMatin[gIdx]) {
        respected++;
      } else {
        nonRespectedList.push({
          name: m.name || m.email,
          wants: wantsMorning ? 'matin' : 'après-midi',
          assignedGroup: g.numero,
        });
      }
    });
  });

  // Trajets longs : le matin est préférable (finir tôt quand la route est
  // longue). On ne signale pas ceux qui ont eux-mêmes demandé l'après-midi.
  const trajet = { loinTotal: 0, loinMatin: 0, aprem: [] };
  groupes.forEach((g, gIdx) => {
    g.membres.forEach(m => {
      const t = getTrajetInfo(m);
      if (!t.loin) return;
      trajet.loinTotal++;
      if (estMatin[gIdx]) {
        trajet.loinMatin++;
      } else if (getPrefScore(m.creneau_prefere) !== 0) {
        trajet.aprem.push({ name: formatName(m.name) || m.email, trajet: t.label, groupe: g.numero });
      }
    });
  });

  // Amis : chaque grappe déclarée est-elle réunie dans un seul groupe ?
  const clusters = amis || buildAmisClusters(groupes.flatMap(g => g.membres));
  const groupeParKey = new Map();
  groupes.forEach(g => g.membres.forEach(m => groupeParKey.set(inviteeKey(m), g.numero)));
  const amisRecap = { total: 0, reunis: 0, separes: [] };
  clusters.clusters.forEach(c => {
    const numeros = [...new Set(c.membres.map(m => groupeParKey.get(m.key)).filter(n => n != null))];
    if (numeros.length === 0) return; // grappe hors de cette session
    amisRecap.total++;
    if (numeros.length === 1) {
      amisRecap.reunis++;
    } else {
      amisRecap.separes.push({
        label: c.label,
        names: c.membres.map(m => formatName(m.name)),
        groupes: numeros.sort((a, b) => a - b),
      });
    }
  });

  return {
    respected, total,
    nonRespected: nonRespectedList.length, nonRespectedList,
    trajet, amis: amisRecap,
  };
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
