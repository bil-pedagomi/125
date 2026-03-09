import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Users, Euro, FileCheck, Phone, PhoneCall, Mail, AlertTriangle, MessageSquare, Calendar } from 'lucide-react';
import { getMonthKey, getMonthLabel } from '../utils';

const PRICE = 199;

function Dashboard({ data }) {
  const { eleves, sessions, motifs: globalMotifs, kpis, raw } = data;
  const caComparaison = raw?.ca_comparaison || [];

  const currentYear = new Date().getFullYear();
  const [periode, setPeriode] = useState(String(currentYear));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Available years from sessions
  const years = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => {
      const d = new Date(s.start_time);
      if (!isNaN(d)) set.add(d.getFullYear());
    });
    return [...set].sort((a, b) => b - a);
  }, [sessions]);

  // Determine which months are in the selected period
  const periodMonths = useMemo(() => {
    if (periode === 'custom') {
      if (!customFrom || !customTo) return [];
      const from = customFrom.slice(0, 7); // YYYY-MM
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
    // Year filter
    const year = parseInt(periode);
    const result = [];
    for (let m = 1; m <= 12; m++) {
      result.push(`${year}-${String(m).padStart(2, '0')}`);
    }
    return result;
  }, [periode, customFrom, customTo]);

  // Filter sessions by period
  const filteredSessions = useMemo(() => {
    if (periodMonths.length === 0) return sessions;
    const set = new Set(periodMonths);
    return sessions.filter(s => {
      const mk = getMonthKey(s.start_time);
      return mk && set.has(mk);
    });
  }, [sessions, periodMonths]);

  // Filter eleves from filtered sessions
  const filteredEleves = useMemo(() => {
    const ids = new Set();
    filteredSessions.forEach(s => {
      (s.invitees || []).forEach(inv => {
        ids.add(inv.email || inv.name);
      });
    });
    // Get all invitees from filtered sessions
    return filteredSessions.flatMap(s => s.invitees || []);
  }, [filteredSessions]);

  const totalEleves = filteredEleves.length || filteredSessions.reduce((sum, s) => sum + ((s.invitees || []).length || s.nb_invitees || 0), 0);
  const caEstime = totalEleves * PRICE;
  const nbFormRempli = filteredEleves.filter(e => e.form_rempli).length;
  const pctForm = totalEleves > 0 ? Math.round((nbFormRempli / totalEleves) * 100) : 0;
  const nbAppele = filteredEleves.filter(e => e.a_appele).length;
  const tauxAppel = totalEleves > 0 ? Math.round((nbAppele / totalEleves) * 100) : 0;
  const nbEmailRecus = filteredEleves.filter(e => e.nbEmails > 0).length;

  // CA comparison from ca_comparaison data
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
    return { caTotal, caN1Total, variation, matching, yearLabel, yearN1Label };
  }, [caComparaison, periodMonths, periode]);

  // Chart: élèves per month with N-1 comparison
  const chartData = useMemo(() => {
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

  // Aggregate motifs from all invitees' resumes_appels in filtered sessions
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
    // Also use global motifs as fallback
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

  return (
    <div>
      {/* Period filter */}
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
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
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
    </div>
  );
}

export default Dashboard;
