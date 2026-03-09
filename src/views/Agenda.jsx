import { useState, useMemo } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, FileCheck, PhoneCall, Users, Euro } from 'lucide-react';
import { formatDateShort, formatDate, getMonthKey, getMonthLabel, getSessionType } from '../utils';
import FicheEleve from '../components/FicheEleve';

const PRICE = 199;

function Agenda({ data }) {
  const { sessions } = data;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const months = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => {
      const mk = getMonthKey(s.start_time);
      if (mk) set.add(mk);
    });
    return [...set].sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (monthFilter !== 'all') {
        const mk = getMonthKey(s.start_time);
        if (mk !== monthFilter) return false;
      }
      if (typeFilter !== 'all') {
        const type = getSessionType(s);
        if (type !== typeFilter) return false;
      }
      return true;
    });
  }, [sessions, monthFilter, typeFilter]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

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
        {filtered.map((s) => {
          const type = getSessionType(s);
          const invitees = s.invitees || [];
          const nbEleves = invitees.length || s.nb_invitees || 0;
          const ca = nbEleves * PRICE;
          const isExpanded = expandedId === s.id;

          // Fallback: if no invitees in array but session has invitee_name/invitee_email
          const fallbackInvitees = invitees.length === 0 && s.invitee_name
            ? [{ name: s.invitee_name, email: s.invitee_email, _fallback: true }]
            : [];
          const displayInvitees = invitees.length > 0 ? invitees : fallbackInvitees;

          const nbFormRempli = invitees.filter(i => i.form_rempli).length;
          const tauxForm = nbEleves > 0 ? Math.round((nbFormRempli / nbEleves) * 100) : 0;

          return (
            <div key={s.id}>
              <div
                className="session-row"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleExpand(s.id)}
              >
                <span className="session-date">{formatDateShort(s.start_time)}</span>
                <span className="session-type">
                  <span className={`badge ${type}`}>{type === 'we' ? 'WE' : 'SEM'}</span>
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  {s.event_type_name || 'Formation 125'}
                </span>
                <span className="session-eleves">{nbEleves} élève{nbEleves > 1 ? 's' : ''}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="session-ca">{ca.toLocaleString('fr-FR')} €</span>
                  {isExpanded
                    ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
                    : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                  }
                </span>
              </div>

              {isExpanded && (
                <div className="session-detail-panel">
                  <div className="session-detail-summary">
                    <div className="session-detail-stat">
                      <Users size={14} />
                      <span>{nbEleves} élève{nbEleves > 1 ? 's' : ''}</span>
                    </div>
                    <div className="session-detail-stat">
                      <Euro size={14} />
                      <span>{ca.toLocaleString('fr-FR')} €</span>
                    </div>
                    <div className="session-detail-stat">
                      <FileCheck size={14} />
                      <span>Formulaires : {tauxForm}% ({nbFormRempli}/{nbEleves})</span>
                    </div>
                  </div>

                  {displayInvitees.length > 0 ? (
                    <div className="session-detail-list">
                      {displayInvitees.map((inv, i) => {
                        const isFallback = inv._fallback;
                        return (
                          <div key={i} className="session-detail-invitee-wrapper">
                            <div className="session-detail-invitee">
                              <div className="invitee-info">
                                <span className="invitee-name">{inv.name || '—'}</span>
                                <span className="invitee-email">{inv.email || '—'}</span>
                                {inv.phone && <span className="invitee-phone">{inv.phone}</span>}
                                {inv.payment_amount && (
                                  <span className="invitee-payment">
                                    {inv.payment_amount} {inv.payment_currency || '€'}
                                  </span>
                                )}
                              </div>
                              <div className="invitee-badges">
                                {isFallback ? (
                                  <span className="invitee-badge grey">Données partielles</span>
                                ) : (
                                  <>
                                    {inv.form_rempli
                                      ? <span className="invitee-badge green">Formulaire OK</span>
                                      : <span className="invitee-badge orange">Formulaire manquant</span>
                                    }
                                    {inv.a_appele
                                      ? <span className="invitee-badge red">{inv.nb_appels} appel{inv.nb_appels > 1 ? 's' : ''}</span>
                                      : <span className="invitee-badge green">0 appel</span>
                                    }
                                    {inv.status === 'canceled' && (
                                      <span className="invitee-badge red">Annulé</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            {!isFallback && <FicheEleve invitee={inv} />}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="empty-state" style={{ padding: '0.75rem 0' }}>
                      Aucun élève inscrit (backfill en cours)
                    </p>
                  )}
                </div>
              )}
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
