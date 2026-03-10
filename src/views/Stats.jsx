import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getMonthKey, getMonthLabel } from '../utils';

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

  // Also collect form data from invitees (enriched)
  const allFormData = useMemo(() => {
    // Use formulaires directly if available, else fall back to invitees with form_rempli
    if (formulaires.length > 0) return formulaires;
    return data.eleves?.filter(e => e.form_rempli) || [];
  }, [formulaires, data.eleves]);

  const niveauData = useMemo(() => countField(allFormData, 'niveau_scooter'), [allFormData]);

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

  // Normalize occasion names to standard categories
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

  // Evolution: niveau per month from sessions
  const evolutionData = useMemo(() => {
    const monthMap = {};
    sessions.forEach(s => {
      const mk = getMonthKey(s.start_time);
      if (!mk) return;
      (s.invitees || []).forEach(inv => {
        if (!inv.form_rempli || !inv.niveau_scooter) return;
        if (!monthMap[mk]) monthMap[mk] = { 'Débutant': 0, 'Intermédiaire': 0, 'Avancé': 0, 'Expert': 0 };
        const n = inv.niveau_scooter;
        if (monthMap[mk].hasOwnProperty(n)) monthMap[mk][n]++;
      });
    });
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, counts]) => ({ month: getMonthLabel(key), ...counts }));
  }, [sessions]);

  // Build dynamic occasion color map
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
      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
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
    </div>
  );
}

export default Stats;
