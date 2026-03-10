import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Users, Euro, FileCheck, Phone, PhoneCall, Mail, AlertTriangle, MessageSquare, Calendar } from 'lucide-react';
import { getMonthKey, getMonthLabel } from '../utils';

const PRICE = 199;

const SOURCE_COLORS = {
  'Recherche Google': '#8b5cf6',
  'IA': '#3b82f6',
  'Bouche à oreille': '#10b981',
};
const SOURCE_FALLBACK_COLORS = ['#f59e0b', '#ef4444', '#ec4899', '#64748b', '#06b6d4', '#84cc16', '#d946ef'];

const NIVEAU_COLORS = {
  'Avancé': '#3b82f6',
  'Intermédiaire': '#f59e0b',
  'Expert': '#10b981',
  'Débutant': '#ef4444',
};

const CONDUIT_COLORS = { 'Oui': '#10b981', 'Non': '#ef4444' };

const OCCASION_COLORS = {
  'Domicile-travail': '#3b82f6',
  'Loisir': '#8b5cf6',
  'Voyages': '#f59e0b',
  'Pro (livraisons)': '#64748b',
};

function countField(items, field) {
  const counts = {};
  items.forEach(item => {
    const val = item[field];
    if (val != null && val !== '') {
      if (Array.isArray(val)) {
        val.forEach(v => {
          const k = String(v).trim();
          if (k) counts[k] = (counts[k] || 0) + 1;
        });
      } else {
        const k = String(val).trim();
        if (k) counts[k] = (counts[k] || 0) + 1;
      }
    }
  });
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function DonutChart({ title, data, colorMap, totalLabel }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const topPct = total > 0 ? Math.round((data[0]?.value / total) * 100) : 0;

  return (
    <div className="card" style={{ flex: '1 1 0', minWidth: 240 }}>
      <div className="stat-card-title">{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ResponsiveContainer width="55%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={colorMap[entry.name] || '#64748b'} />
              ))}
            </Pie>
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
              fill="#e8eaed" fontSize={20} fontWeight={700}>
              {topPct}%
            </text>
            <Tooltip
              contentStyle={{ background: '#1e2235', border: '1px solid #2a2f45', borderRadius: 8, fontSize: 12 }}
              formatter={(value) => [`${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {data.map(d => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: colorMap[d.name] || '#64748b', flexShrink: 0,
              }} />
              <span style={{ color: '#cbd5e1', flex: 1 }}>{d.name}</span>
              <span style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {d.value}
              </span>
            </div>
          ))}
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
            {totalLabel || `${total} réponses`}
          </div>
        </div>
      </div>
    </div>
  );
}

function HBarChart({ title, data, color = '#8b5cf6' }) {
  return (
    <div className="card" style={{ flex: '1 1 0', minWidth: 300 }}>
      <div className="stat-card-title">{title}</div>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36 + 40)}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#9aa0b8', fontSize: 11 }} allowDecimals={false} />
            <YAxis
              type="category" dataKey="name" width={160}
              tick={{ fill: '#cbd5e1', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ background: '#1e2235', border: '1px solid #2a2f45', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} name="Réponses" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="empty-state">Aucune donnée</p>
      )}
    </div>
  );
}

function Stats({ data }) {
  const formulaires = data.raw?.formulaires || [];
  const sessions = data.sessions || [];
  const { eleves, motifs: globalMotifs, kpis, raw } = data;
  const caComparaison = raw?.ca_comparaison || [];

  // ─── Vue d'ensemble (ex-Dashboard) ───
  const currentYear = new Date().getFullYear();
  const [periode, setPeriode] = useState(String(currentYear));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const years = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => {
      const d = new Date(s.start_time);
      if (!isNaN(d)) set.add(d.getFullYear());
    });
    return [...set].sort((a, b) => b - a);
  }, [sessions]);

  const periodMonths = useMemo(() => {
    if (periode === 'custom') {
      if (!customFrom || !customTo) return [];
      const from = customFrom.slice(0, 7);
      const to = customTo.slice(0, 7);
      const result = [];
      const [fy, fm] = from.split('-').map(Number);
      const [ty, tm] = to.split('-').map(Number);
      let y = fy, m = fm;
      while (y < ty || (y === ty && m <= tm)) {
        result.push(`${y}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) { m = 1; y++; }
      }
      return result;
    }
    const year = parseInt(periode);
    const result = [];
    for (let m = 1; m <= 12; m++) {
      result.push(`${year}-${String(m).padStart(2, '0')}`);
    }
    return result;
  }, [periode, customFrom, customTo]);

  const filteredSessions = useMemo(() => {
    if (periodMonths.length === 0) return sessions;
    const set = new Set(periodMonths);
    return sessions.filter(s => {
      const mk = getMonthKey(s.start_time);
      return mk && set.has(mk);
    });
  }, [sessions, periodMonths]);

  const filteredEleves = useMemo(() => {
    return filteredSessions.flatMap(s => s.invitees || []);
  }, [filteredSessions]);

  const totalEleves = filteredEleves.length || filteredSessions.reduce((sum, s) => sum + ((s.invitees || []).length || s.nb_invitees || 0), 0);
  const caEstime = totalEleves * PRICE;
  const nbFormRempli = filteredEleves.filter(e => e.form_rempli).length;
  const pctForm = totalEleves > 0 ? Math.round((nbFormRempli / totalEleves) * 100) : 0;
  const nbAppele = filteredEleves.filter(e => e.a_appele).length;
  const tauxAppel = totalEleves > 0 ? Math.round((nbAppele / totalEleves) * 100) : 0;
  const nbEmailRecus = filteredEleves.filter(e => e.nbEmails > 0).length;

  const caCompData = useMemo(() => {
    if (periodMonths.length === 0) return null;
    const set = new Set(periodMonths);
    const matching = caComparaison.filter(c => set.has(c.mois));
    if (matching.length === 0) return null;
    const caTotal = matching.reduce((s, c) => s + (c.ca || 0), 0);
    const caN1Total = matching.reduce((s, c) => s + (c.ca_n1 || 0), 0);
    const variation = caN1Total > 0 ? Math.round(((caTotal - caN1Total) / caN1Total) * 100) : null;
    const yearLabel = periode === 'custom' ? 'N' : periode;
    const yearN1Label = periode === 'custom' ? 'N-1' : String(parseInt(periode) - 1);
    return { caTotal, caN1Total, variation, yearLabel, yearN1Label };
  }, [caComparaison, periodMonths, periode]);

  const elevesParMoisData = useMemo(() => {
    const months = {};
    sessions.forEach(s => {
      const mk = getMonthKey(s.start_time);
      if (mk) {
        const nbEleves = s.invitees?.length || s.nb_invitees || 0;
        months[mk] = (months[mk] || 0) + nbEleves;
      }
    });

    if (periode === 'custom' || periodMonths.length === 0) {
      return Object.entries(months)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, count]) => ({ month: getMonthLabel(key), eleves: count }));
    }

    const year = parseInt(periode);
    const yearN1 = year - 1;
    const result = [];
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    for (let m = 1; m <= 12; m++) {
      const mk = `${year}-${String(m).padStart(2, '0')}`;
      const mkN1 = `${yearN1}-${String(m).padStart(2, '0')}`;
      const val = months[mk] || 0;
      const valN1 = months[mkN1] || 0;
      if (val > 0 || valN1 > 0) {
        result.push({
          month: monthNames[m - 1],
          [String(year)]: val,
          [String(yearN1)]: valN1,
        });
      }
    }
    return result;
  }, [sessions, periode, periodMonths]);

  const aggregatedMotifs = useMemo(() => {
    const counts = {};
    filteredSessions.forEach(s => {
      (s.invitees || []).forEach(inv => {
        (inv.resumes_appels || []).forEach(r => {
          if (r.motifs && Array.isArray(r.motifs)) {
            r.motifs.forEach(m => {
              const key = (m || '').trim();
              if (key) counts[key] = (counts[key] || 0) + 1;
            });
          }
        });
      });
    });
    if (Object.keys(counts).length === 0 && globalMotifs.length > 0) {
      return globalMotifs;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([motif, count]) => ({ motif, count }));
  }, [filteredSessions, globalMotifs]);

  const formNonRemplis = filteredEleves.filter(e => !e.form_rempli && e.status !== 'canceled');
  const ontAppele = filteredEleves.filter(e => e.a_appele);

  const yearStr = periode !== 'custom' ? periode : '';
  const yearN1Str = periode !== 'custom' ? String(parseInt(periode) - 1) : '';

  // ─── Typeform Stats ───
  const allFormData = useMemo(() => {
    if (formulaires.length > 0) return formulaires;
    return data.eleves?.filter(e => e.form_rempli) || [];
  }, [formulaires, data.eleves]);

  const niveauData = useMemo(() => {
    const counts = { 'Débutant': 0, 'Intermédiaire': 0, 'Avancé': 0, 'Expert': 0 };
    allFormData.forEach(f => {
      if (!f.niveau_scooter) return;
      const n = f.niveau_scooter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (n.includes('debut')) counts['Débutant']++;
      else if (n.includes('interm')) counts['Intermédiaire']++;
      else if (n.includes('avan')) counts['Avancé']++;
      else if (n.includes('expert')) counts['Expert']++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [allFormData]);

  const conduiteData = useMemo(() => {
    const counts = { 'Oui': 0, 'Non': 0 };
    allFormData.forEach(f => {
      const v = f.deja_conduit;
      if (v === true || v === 'true' || v === 'Oui') counts['Oui']++;
      else if (v === false || v === 'false' || v === 'Non') counts['Non']++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [allFormData]);

  const occasionsData = useMemo(() => countField(allFormData, 'occasions_conduite'), [allFormData]);

  const normalizedOccasions = useMemo(() => {
    const mapping = {};
    occasionsData.forEach(d => {
      const lower = d.name.toLowerCase();
      let cat;
      if (lower.includes('domicile') || lower.includes('travail') || lower.includes('trajet')) cat = 'Domicile-travail';
      else if (lower.includes('loisir') || lower.includes('balade') || lower.includes('plaisir')) cat = 'Loisir';
      else if (lower.includes('voyage') || lower.includes('trip')) cat = 'Voyages';
      else if (lower.includes('pro') || lower.includes('livraison') || lower.includes('professionnel')) cat = 'Pro (livraisons)';
      else cat = d.name;
      mapping[cat] = (mapping[cat] || 0) + d.value;
    });
    return Object.entries(mapping)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [occasionsData]);

  const sourceData = useMemo(() => countField(allFormData, 'source_acquisition'), [allFormData]);
  const raisonData = useMemo(() => countField(allFormData, 'raison_reservation'), [allFormData]);

  const normalizeNiveau = (v) => {
    if (!v) return null;
    const n = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (n.includes('debut')) return 'Débutant';
    if (n.includes('interm')) return 'Intermédiaire';
    if (n.includes('avan')) return 'Avancé';
    if (n.includes('expert')) return 'Expert';
    return null;
  };

  const emailToSessionDate = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      if (!s.start_time) return;
      (s.invitees || []).forEach(inv => {
        const email = inv.email?.toLowerCase()?.trim();
        if (email) map[email] = s.start_time;
      });
    });
    return map;
  }, [sessions]);

  const resolveDate = (record) => {
    return record.created_at || record.date_formation || record.submitted_at
      || record.date_rdv || record.date || null;
  };

  const evolutionData = useMemo(() => {
    const monthMap = {};
    const initMonth = (mk) => {
      if (!monthMap[mk]) monthMap[mk] = { 'Débutant': 0, 'Intermédiaire': 0, 'Avancé': 0, 'Expert': 0 };
    };

    sessions.forEach(s => {
      const mk = getMonthKey(s.start_time);
      if (!mk) return;
      (s.invitees || []).forEach(inv => {
        if (!inv.niveau_scooter) return;
        const niveau = normalizeNiveau(inv.niveau_scooter);
        if (!niveau) return;
        initMonth(mk);
        monthMap[mk][niveau]++;
      });
    });

    if (Object.keys(monthMap).length === 0) {
      const forms = data.raw?.formulaires || [];
      forms.forEach(f => {
        if (!f.niveau_scooter) return;
        let dateField = resolveDate(f);
        if (!dateField) {
          const email = (f.email || f.email_address || '').toLowerCase().trim();
          dateField = emailToSessionDate[email];
        }
        if (!dateField) return;
        const mk = getMonthKey(dateField);
        if (!mk) return;
        const niveau = normalizeNiveau(f.niveau_scooter);
        if (!niveau) return;
        initMonth(mk);
        monthMap[mk][niveau]++;
      });
    }

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, counts]) => ({ month: getMonthLabel(key), ...counts }));
  }, [sessions, data.raw?.formulaires]);

  const { sourceEvolutionData, sourceKeys, sourceColorMap } = useMemo(() => {
    const monthMap = {};
    const sourceTotals = {};

    const processRecord = (record, dateStr) => {
      const src = record.source_acquisition;
      if (!src || !dateStr) return;
      const srcName = String(src).trim();
      if (!srcName) return;
      const mk = getMonthKey(dateStr);
      if (!mk) return;
      if (!monthMap[mk]) monthMap[mk] = {};
      monthMap[mk][srcName] = (monthMap[mk][srcName] || 0) + 1;
      sourceTotals[srcName] = (sourceTotals[srcName] || 0) + 1;
    };

    sessions.forEach(s => {
      if (!s.start_time) return;
      (s.invitees || []).forEach(inv => processRecord(inv, s.start_time));
    });

    if (Object.keys(monthMap).length === 0) {
      const forms = data.raw?.formulaires || [];
      forms.forEach(f => {
        let dateField = resolveDate(f);
        if (!dateField) {
          const email = (f.email || f.email_address || '').toLowerCase().trim();
          dateField = emailToSessionDate[email];
        }
        processRecord(f, dateField);
      });
    }

    const keys = Object.entries(sourceTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const colorMap = {};
    let fallbackIdx = 0;
    keys.forEach(name => {
      if (SOURCE_COLORS[name]) {
        colorMap[name] = SOURCE_COLORS[name];
      } else {
        colorMap[name] = SOURCE_FALLBACK_COLORS[fallbackIdx % SOURCE_FALLBACK_COLORS.length];
        fallbackIdx++;
      }
    });

    const chartData = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mk, counts]) => {
        const row = { month: getMonthLabel(mk) };
        keys.forEach(k => { row[k] = counts[k] || 0; });
        return row;
      });

    return { sourceEvolutionData: chartData, sourceKeys: keys, sourceColorMap: colorMap };
  }, [sessions, data.raw?.formulaires, emailToSessionDate]);

  const occasionColorMap = useMemo(() => {
    const baseColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#64748b', '#10b981', '#ef4444', '#ec4899'];
    const map = { ...OCCASION_COLORS };
    normalizedOccasions.forEach((d, i) => {
      if (!map[d.name]) map[d.name] = baseColors[i % baseColors.length];
    });
    return map;
  }, [normalizedOccasions]);

  return (
    <div>
      {/* ═══ VUE D'ENSEMBLE ═══ */}
      <div className="filters-bar" style={{ marginBottom: '1rem' }}>
        <Calendar size={16} style={{ color: 'var(--accent)' }} />
        <select
          className="filter-select"
          value={periode}
          onChange={e => setPeriode(e.target.value)}
        >
          {years.map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
          <option value="custom">Personnalisé</option>
        </select>
        {periode === 'custom' && (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>du</span>
            <input
              type="date"
              className="filter-select"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>au</span>
            <input
              type="date"
              className="filter-select"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            />
          </>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginLeft: 'auto' }}>
          {filteredSessions.length} session{filteredSessions.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card accent">
          <span className="kpi-label"><Users size={12} style={{ display: 'inline', marginRight: 4 }} />Total élèves</span>
          <span className="kpi-value">{totalEleves}</span>
        </div>
        <div className="kpi-card green">
          <span className="kpi-label"><Euro size={12} style={{ display: 'inline', marginRight: 4 }} />CA estimé</span>
          <span className="kpi-value">{caEstime.toLocaleString('fr-FR')} €</span>
          <span className="kpi-sub">@{PRICE}€/élève</span>
          {caCompData && (
            <div style={{ marginTop: 6 }}>
              {caCompData.variation !== null ? (
                <>
                  <span style={{
                    color: caCompData.variation >= 0 ? '#10b981' : '#ef4444',
                    fontSize: 14,
                    fontWeight: 600,
                  }}>
                    {caCompData.variation >= 0 ? '↑' : '↓'} {caCompData.variation >= 0 ? '+' : ''}{caCompData.variation}% vs {caCompData.yearN1Label}
                  </span>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                    {caCompData.yearLabel} : {caCompData.caTotal.toLocaleString('fr-FR')}€
                    {' · '}
                    {caCompData.yearN1Label} : {caCompData.caN1Total.toLocaleString('fr-FR')}€
                  </div>
                </>
              ) : (
                <span style={{ color: '#64748b', fontSize: 11 }}>Pas de données N-1</span>
              )}
            </div>
          )}
        </div>
        <div className="kpi-card blue">
          <span className="kpi-label"><FileCheck size={12} style={{ display: 'inline', marginRight: 4 }} />Formulaire rempli</span>
          <span className="kpi-value">{pctForm}%</span>
          <span className="kpi-sub">{nbFormRempli}/{totalEleves}</span>
        </div>
        <div className="kpi-card orange">
          <span className="kpi-label"><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />Taux d'appel</span>
          <span className="kpi-value">{tauxAppel}%</span>
          <span className="kpi-sub">Objectif : 0%</span>
        </div>
        <div className="kpi-card red">
          <span className="kpi-label"><PhoneCall size={12} style={{ display: 'inline', marginRight: 4 }} />Ont appelé</span>
          <span className="kpi-value">{nbAppele}</span>
        </div>
        <div className="kpi-card blue">
          <span className="kpi-label"><Mail size={12} style={{ display: 'inline', marginRight: 4 }} />Emails reçus</span>
          <span className="kpi-value">{nbEmailRecus}</span>
          <span className="kpi-sub">Objectif : 0</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title"><Users size={16} /> Élèves par mois</div>
          {elevesParMoisData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={elevesParMoisData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
                <XAxis dataKey="month" tick={{ fill: '#9aa0b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9aa0b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e2235', border: '1px solid #2a2f45', borderRadius: 8, fontSize: 13 }}
                  labelStyle={{ color: '#e8eaed' }}
                />
                {periode !== 'custom' ? (
                  <>
                    <Bar dataKey={yearStr} fill="#6c63ff" radius={[4, 4, 0, 0]} name={yearStr} />
                    <Bar dataKey={yearN1Str} fill="#6c63ff" opacity={0.3} radius={[4, 4, 0, 0]} name={yearN1Str} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: '#9aa0b8' }}
                      formatter={(value) => <span style={{ color: '#9aa0b8' }}>{value}</span>}
                    />
                  </>
                ) : (
                  <Bar dataKey="eleves" fill="#6c63ff" radius={[4, 4, 0, 0]} name="Élèves" />
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-state">Aucune donnée</p>
          )}
        </div>

        <div className="card">
          <div className="card-title"><MessageSquare size={16} /> Motifs d'appels</div>
          {aggregatedMotifs.length > 0 ? (
            <ul className="motif-list">
              {aggregatedMotifs.map((m, i) => (
                <li key={i} className="motif-item">
                  <span className="motif-count">{m.count}</span>
                  <span className="motif-text">{m.motif}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Aucun motif d'appel enregistré</p>
          )}
        </div>
      </div>

      <div className="actions-section">
        <div className="card">
          <div className="card-title"><AlertTriangle size={16} /> Actions requises</div>
          <div className="action-list">
            {formNonRemplis.map((e, i) => (
              <div key={`form-${i}`} className="action-item warning">
                <div className="action-icon orange"><FileCheck size={16} /></div>
                <div>
                  <div className="action-name">{e.name || e.email}</div>
                  <div className="action-detail">Formulaire non rempli</div>
                </div>
              </div>
            ))}
            {ontAppele.map((e, i) => (
              <div key={`call-${i}`} className="action-item danger">
                <div className="action-icon red"><PhoneCall size={16} /></div>
                <div>
                  <div className="action-name">{e.name || e.email}</div>
                  <div className="action-detail">{e.nb_appels} appel{e.nb_appels > 1 ? 's' : ''} Ringover</div>
                </div>
              </div>
            ))}
            {formNonRemplis.length === 0 && ontAppele.length === 0 && (
              <p className="empty-state">Aucune action requise</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ STATISTIQUES TYPEFORM ═══ */}
      <div style={{ color: 'var(--text-muted)', fontSize: 12, margin: '24px 0 12px' }}>
        {allFormData.length} formulaires analysés
      </div>

      {/* Row 1: 3 donuts */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <DonutChart
          title="Niveau scooter"
          data={niveauData}
          colorMap={NIVEAU_COLORS}
        />
        <DonutChart
          title="Déjà conduit un scooter"
          data={conduiteData}
          colorMap={CONDUIT_COLORS}
        />
        <DonutChart
          title="Occasions de conduite"
          data={normalizedOccasions}
          colorMap={occasionColorMap}
        />
      </div>

      {/* Row 2: Horizontal bars */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <HBarChart title="Source d'acquisition" data={sourceData} color="#8b5cf6" />
        <HBarChart title="Raison de réservation" data={raisonData} color="#6c63ff" />
      </div>

      {/* Row 3: Line chart evolution */}
      <div className="card">
        <div className="stat-card-title">Évolution du niveau des élèves par mois</div>
        {evolutionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evolutionData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
              <XAxis dataKey="month" tick={{ fill: '#9aa0b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9aa0b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1e2235', border: '1px solid #2a2f45', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e8eaed' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Débutant" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Intermédiaire" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Avancé" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Expert" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="empty-state">Aucune donnée d'évolution</p>
        )}
      </div>

      {/* Row 4: Line chart source acquisition evolution */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="stat-card-title">Évolution des sources d'acquisition par mois</div>
        {sourceEvolutionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={sourceEvolutionData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
              <XAxis dataKey="month" tick={{ fill: '#9aa0b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9aa0b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1e2235', border: '1px solid #2a2f45', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e8eaed' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {sourceKeys.map(key => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={sourceColorMap[key]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="empty-state">Aucune donnée d'évolution</p>
        )}
      </div>
    </div>
  );
}

export default Stats;
