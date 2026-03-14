import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Eye, Target, Euro, Users, TrendingUp, Clock, ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown } from 'lucide-react';
import { fetchPage125Stats } from '../utils';

const PRESETS = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'yesterday', label: 'Hier' },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'month', label: 'Ce mois' },
  { id: 'prev_month', label: 'Mois préc.' },
  { id: 'custom', label: 'Personnalisé' },
];

function getPresetRange(id) {
  const now = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  const today = fmt(now);

  switch (id) {
    case 'today':
      return [today, today];
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return [fmt(y), fmt(y)];
    }
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return [fmt(d), today];
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return [fmt(d), today];
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return [fmt(first), today];
    }
    case 'prev_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return [fmt(first), fmt(last)];
    }
    default:
      return [null, null];
  }
}

function getPrevRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const days = Math.round((e - s) / 86400000) + 1;
  const prevEnd = new Date(s);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  const fmt = d => d.toISOString().slice(0, 10);
  return [fmt(prevStart), fmt(prevEnd)];
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m${s > 0 ? ` ${s}s` : ''}`;
}

function formatDateLabel(dateStr, totalDays) {
  const d = new Date(dateStr + 'T00:00:00');
  if (totalDays <= 7) {
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  }
  if (totalDays <= 60) {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function Delta({ current, previous, suffix = '', invert = false }) {
  if (previous == null || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span style={{ color: '#64748b', fontSize: 12 }}>= 0%</span>;
  const positive = invert ? pct < 0 : pct > 0;
  const Icon = pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span style={{ color: positive ? '#10b981' : '#ef4444', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Icon size={12} />
      {pct > 0 ? '+' : ''}{pct}%{suffix}
    </span>
  );
}

function aggregateByWeek(daily) {
  const weeks = {};
  daily.forEach(d => {
    const date = new Date(d.date + 'T00:00:00');
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = { date: key, visitors: 0, pageviews: 0, inscriptions: 0, ca: 0, bounce_sum: 0, duration_sum: 0, visits: 0 };
    const w = weeks[key];
    w.visitors += d.visitors || 0;
    w.pageviews += d.pageviews || 0;
    w.inscriptions += d.inscriptions || 0;
    w.ca += d.ca || 0;
    w.visits += d.visits || 0;
    w.bounce_sum += (d.bounce_rate || 0) * (d.visits || 0);
    w.duration_sum += (d.visit_duration || 0) * (d.visits || 0);
  });
  return Object.values(weeks).sort((a, b) => a.date.localeCompare(b.date)).map(w => ({
    ...w,
    bounce_rate: w.visits > 0 ? Math.round(w.bounce_sum / w.visits * 10) / 10 : 0,
    visit_duration: w.visits > 0 ? Math.round(w.duration_sum / w.visits) : 0,
    taux_conversion: w.visitors > 0 ? Math.round(w.inscriptions / w.visitors * 10000) / 100 : 0,
  }));
}

function aggregateByMonth(daily) {
  const months = {};
  daily.forEach(d => {
    const key = d.date.slice(0, 7);
    if (!months[key]) months[key] = { date: key + '-01', visitors: 0, pageviews: 0, inscriptions: 0, ca: 0, bounce_sum: 0, duration_sum: 0, visits: 0 };
    const m = months[key];
    m.visitors += d.visitors || 0;
    m.pageviews += d.pageviews || 0;
    m.inscriptions += d.inscriptions || 0;
    m.ca += d.ca || 0;
    m.visits += d.visits || 0;
    m.bounce_sum += (d.bounce_rate || 0) * (d.visits || 0);
    m.duration_sum += (d.visit_duration || 0) * (d.visits || 0);
  });
  return Object.values(months).sort((a, b) => a.date.localeCompare(b.date)).map(m => ({
    ...m,
    bounce_rate: m.visits > 0 ? Math.round(m.bounce_sum / m.visits * 10) / 10 : 0,
    visit_duration: m.visits > 0 ? Math.round(m.duration_sum / m.visits) : 0,
    taux_conversion: m.visitors > 0 ? Math.round(m.inscriptions / m.visitors * 10000) / 100 : 0,
  }));
}

function Conversions() {
  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [compare, setCompare] = useState(false);
  const [data, setData] = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const [dateStart, dateEnd] = useMemo(() => {
    if (preset === 'custom') return [customFrom || null, customTo || null];
    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!dateStart || !dateEnd) return;
    setLoading(true);
    try {
      const result = await fetchPage125Stats(dateStart, dateEnd);
      setData(result);
      if (compare) {
        const [ps, pe] = getPrevRange(dateStart, dateEnd);
        const prevResult = await fetchPage125Stats(ps, pe);
        setPrevData(prevResult);
      } else {
        setPrevData(null);
      }
    } catch (e) {
      console.error(e);
      setData(null);
      setPrevData(null);
    } finally {
      setLoading(false);
    }
  }, [dateStart, dateEnd, compare]);

  useEffect(() => { load(); }, [load]);

  const totalDays = useMemo(() => {
    if (!dateStart || !dateEnd) return 0;
    return Math.round((new Date(dateEnd) - new Date(dateStart)) / 86400000) + 1;
  }, [dateStart, dateEnd]);

  // Merge daily + inscriptions_hors_plausible for complete data
  const allDaily = useMemo(() => {
    if (!data) return [];
    const map = {};
    (data.daily || []).forEach(d => { map[d.date] = { ...d }; });
    // Add inscriptions for dates that have no plausible data but do have bookings
    (data.inscriptions_hors_plausible || []).forEach(d => {
      if (!map[d.date]) {
        map[d.date] = { date: d.date, visitors: 0, pageviews: 0, bounce_rate: 0, visit_duration: 0, visits: 0, inscriptions: d.inscriptions, ca: d.ca, taux_conversion: 0 };
      }
    });
    // Only add zero-rows for dates that have plausible visitors nearby (no artificial padding)
    // Days with 0 visitors AND 0 inscriptions are omitted (no artificial rows)
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, dateStart, dateEnd]);

  const chartData = useMemo(() => {
    let rows = allDaily;
    if (totalDays > 180) rows = aggregateByMonth(rows);
    else if (totalDays > 60) rows = aggregateByWeek(rows);

    return rows.map(d => ({
      ...d,
      label: formatDateLabel(d.date, totalDays),
      taux_conversion: d.visitors > 0 ? Math.round(d.inscriptions / d.visitors * 10000) / 100 : 0,
    }));
  }, [allDaily, totalDays]);

  const totals = data?.totals || {};
  const totalsInsc = data?.totals_inscriptions || {};
  const totalVisitors = totals.visitors || 0;
  const totalInscriptions = totalsInsc.inscriptions || 0;
  const totalCA = totalsInsc.ca || 0;
  const tauxConversion = totalVisitors > 0 ? Math.round(totalInscriptions / totalVisitors * 10000) / 100 : 0;
  const convColor = tauxConversion >= 10 ? '#10b981' : tauxConversion >= 5 ? '#f59e0b' : '#ef4444';

  const prevTotals = prevData?.totals || {};
  const prevTotalsInsc = prevData?.totals_inscriptions || {};

  // Table sorting
  const tableData = useMemo(() => {
    let rows = allDaily;
    if (totalDays > 180) rows = aggregateByMonth(rows);
    else if (totalDays > 60) rows = aggregateByWeek(rows);

    const sorted = [...rows].sort((a, b) => {
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  }, [allDaily, totalDays, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div>
      {/* Period selector */}
      <div className="filters-bar" style={{ marginBottom: '1rem' }}>
        <div className="conv-presets">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className={`conv-preset-btn ${preset === p.id ? 'active' : ''}`}
              onClick={() => setPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>du</span>
            <input type="date" className="filter-select" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>au</span>
            <input type="date" className="filter-select" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }} />
          </>
        )}
        <label className="conv-compare-toggle" style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
          <span>Comparer N-1</span>
        </label>
      </div>

      {loading ? (
        <div className="loading" style={{ minHeight: '40vh' }}>
          <div className="spinner" />
          <span>Chargement...</span>
        </div>
      ) : !data ? (
        <p className="empty-state">Aucune donnee disponible pour cette periode.</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            <div className="kpi-card blue">
              <span className="kpi-label"><Eye size={12} style={{ display: 'inline', marginRight: 4 }} />Visiteurs uniques</span>
              <span className="kpi-value">{totalVisitors.toLocaleString('fr-FR')}</span>
              {compare && <Delta current={totalVisitors} previous={prevTotals.visitors} />}
            </div>
            <div className="kpi-card accent">
              <span className="kpi-label"><TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} />Pages vues</span>
              <span className="kpi-value">{(totals.pageviews || 0).toLocaleString('fr-FR')}</span>
              {compare && <Delta current={totals.pageviews} previous={prevTotals.pageviews} />}
            </div>
            <div className="kpi-card green">
              <span className="kpi-label"><Users size={12} style={{ display: 'inline', marginRight: 4 }} />Inscriptions 125</span>
              <span className="kpi-value">{totalInscriptions}</span>
              {compare && <Delta current={totalInscriptions} previous={prevTotalsInsc.inscriptions} />}
            </div>
            <div className="kpi-card green">
              <span className="kpi-label"><Euro size={12} style={{ display: 'inline', marginRight: 4 }} />CA 125</span>
              <span className="kpi-value">{totalCA.toLocaleString('fr-FR')} &euro;</span>
              {compare && <Delta current={totalCA} previous={prevTotalsInsc.ca} />}
            </div>
            <div className="kpi-card" style={{ borderLeft: `3px solid ${convColor}` }}>
              <span className="kpi-label"><Target size={12} style={{ display: 'inline', marginRight: 4 }} />Taux de conversion</span>
              <span className="kpi-value" style={{ color: convColor }}>{tauxConversion}%</span>
              <span className="kpi-sub">{totalInscriptions} / {totalVisitors}</span>
              {compare && prevTotals.visitors > 0 && (
                <Delta
                  current={tauxConversion}
                  previous={prevTotals.visitors > 0 ? Math.round((prevTotalsInsc.inscriptions || 0) / prevTotals.visitors * 10000) / 100 : 0}
                />
              )}
            </div>
            <div className="kpi-card orange">
              <span className="kpi-label"><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />Bounce / Duree</span>
              <span className="kpi-value" style={{ fontSize: '1.25rem' }}>{totals.bounce_rate_avg || 0}%</span>
              <span className="kpi-sub">{formatDuration(totals.visit_duration_avg)}</span>
              {compare && <Delta current={totals.bounce_rate_avg} previous={prevTotals.bounce_rate_avg} invert />}
            </div>
          </div>

          {/* Main chart */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">
              <TrendingUp size={16} />
              Visiteurs & Conversion
              {totalDays > 180 ? ' (par mois)' : totalDays > 60 ? ' (par semaine)' : ' (par jour)'}
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
                  <XAxis dataKey="label" tick={{ fill: '#9aa0b8', fontSize: 11 }} interval={totalDays > 30 ? 'preserveStartEnd' : 0} angle={totalDays > 14 ? -45 : 0} textAnchor={totalDays > 14 ? 'end' : 'middle'} height={totalDays > 14 ? 60 : 30} />
                  <YAxis yAxisId="left" tick={{ fill: '#9aa0b8', fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9aa0b8', fontSize: 11 }} unit="%" domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{ background: '#1e2235', border: '1px solid #2a2f45', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#e8eaed' }}
                    formatter={(value, name) => {
                      if (name === 'Conversion') return [`${value}%`, name];
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="visitors" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Visiteurs" opacity={0.85} />
                  <Bar yAxisId="left" dataKey="inscriptions" fill="#10b981" radius={[3, 3, 0, 0]} name="Inscriptions" />
                  <Line yAxisId="right" type="monotone" dataKey="taux_conversion" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2, fill: '#f59e0b' }} name="Conversion" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="empty-state">Aucune donnee</p>
            )}
          </div>

          {/* Detail table */}
          <div className="card">
            <div className="card-title"><Eye size={16} /> Detail {totalDays > 180 ? 'mensuel' : totalDays > 60 ? 'hebdomadaire' : 'journalier'}</div>
            <div className="table-container">
              <table className="eleves-table conv-table">
                <thead>
                  <tr>
                    {[
                      { key: 'date', label: 'Date' },
                      { key: 'visitors', label: 'Visiteurs' },
                      { key: 'pageviews', label: 'Pages vues' },
                      { key: 'inscriptions', label: 'Inscriptions' },
                      { key: 'ca', label: 'CA' },
                      { key: 'taux_conversion', label: 'Conv. %' },
                      { key: 'bounce_rate', label: 'Bounce %' },
                      { key: 'visit_duration', label: 'Duree moy.' },
                    ].map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {col.label} <SortIcon col={col.key} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map(row => {
                    const conv = row.visitors > 0 ? Math.round(row.inscriptions / row.visitors * 10000) / 100 : 0;
                    return (
                      <tr key={row.date}>
                        <td className="mono">{new Date(row.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="mono">{row.visitors}</td>
                        <td className="mono">{row.pageviews}</td>
                        <td className="mono" style={{ color: row.inscriptions > 0 ? '#10b981' : undefined, fontWeight: row.inscriptions > 0 ? 600 : undefined }}>
                          {row.inscriptions}
                        </td>
                        <td className="mono" style={{ color: row.ca > 0 ? '#10b981' : undefined }}>
                          {row.ca > 0 ? `${row.ca.toLocaleString('fr-FR')} \u20AC` : '0'}
                        </td>
                        <td className="mono" style={{ color: conv >= 10 ? '#10b981' : conv >= 5 ? '#f59e0b' : conv > 0 ? '#ef4444' : undefined }}>
                          {conv}%
                        </td>
                        <td className="mono">{row.bounce_rate}%</td>
                        <td className="mono">{formatDuration(row.visit_duration)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Conversions;
