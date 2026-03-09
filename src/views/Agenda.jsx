import { useState, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatDateShort, getMonthKey, getMonthLabel, isWeekend } from '../utils';

const PRICE = 199;

function Agenda({ data }) {
  const { sessions } = data;
  const [monthFilter, setMonthFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const months = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => {
      const mk = getMonthKey(s.start_time || s.date);
      if (mk) set.add(mk);
    });
    return [...set].sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      const dateStr = s.start_time || s.date;
      if (monthFilter !== 'all') {
        const mk = getMonthKey(dateStr);
        if (mk !== monthFilter) return false;
      }
      if (typeFilter !== 'all') {
        const we = isWeekend(dateStr);
        if (typeFilter === 'we' && !we) return false;
        if (typeFilter === 'sem' && we) return false;
      }
      return true;
    });
  }, [sessions, monthFilter, typeFilter]);

  return (
    <div>
      <div className="filters-bar">
        <CalendarDays size={16} style={{ color: 'var(--accent)' }} />
        <select className="filter-select" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="all">Tous les mois</option>
          {months.map(m => (
            <option key={m} value={m}>{getMonthLabel(m)}</option>
          ))}
        </select>
        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">Tous les types</option>
          <option value="we">Weekend</option>
          <option value="sem">Semaine</option>
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginLeft: 'auto' }}>
          {filtered.length} session{filtered.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="session-list">
        {filtered.map((s, i) => {
          const dateStr = s.start_time || s.date;
          const we = isWeekend(dateStr);
          const nbEleves = s.invitees?.length || s.nb_invitees || 0;
          const ca = nbEleves * PRICE;
          return (
            <div key={i} className="session-row">
              <span className="session-date">{formatDateShort(dateStr)}</span>
              <span className="session-type">
                <span className={`badge ${we ? 'we' : 'sem'}`}>{we ? 'WE' : 'SEM'}</span>
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                {s.name || s.event_type || s.type || 'Formation 125'}
              </span>
              <span className="session-eleves">{nbEleves} élève{nbEleves > 1 ? 's' : ''}</span>
              <span className="session-ca">{ca.toLocaleString('fr-FR')} €</span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
            Aucune session trouvée
          </p>
        )}
      </div>
    </div>
  );
}

export default Agenda;
