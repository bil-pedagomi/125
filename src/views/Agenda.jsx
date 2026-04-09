import { useState, useMemo } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileCheck, PhoneCall, Users, Euro } from 'lucide-react';
import { formatDateShort, formatDate, getMonthKey, getMonthLabel, getSessionType, getNiveauStyle } from '../utils';
import FicheEleve from '../components/FicheEleve';
import Avatar from '../components/Avatar';
import PhoneLink from '../components/PhoneLink';
import useIsMobile from '../hooks/useIsMobile';

const PRICE = 199;
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildMonthGrid(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0);

  // Monday-based day of week (0=Mon, 6=Sun)
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days = [];

  // Days from previous month to fill first week
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(y, m - 1, -i);
    days.push({ date: d, inMonth: false });
  }

  // Days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(y, m - 1, i), inMonth: true });
  }

  // Days from next month to fill last week
  while (days.length % 7 !== 0) {
    const next = days.length - startDow - lastDay.getDate() + 1;
    days.push({ date: new Date(y, m, next), inMonth: false });
  }

  return days;
}

function Agenda({ data }) {
  const { sessions, raw } = data;
  const caComparaison = raw?.ca_comparaison || [];
  const isMobile = useIsMobile();
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

  const goMonth = (direction) => {
    const idx = months.indexOf(monthFilter);
    if (direction === -1 && idx > 0) setMonthFilter(months[idx - 1]);
    else if (direction === 1 && idx < months.length - 1) setMonthFilter(months[idx + 1]);
    setExpandedId(null);
  };

  const canGoPrev = months.indexOf(monthFilter) > 0;
  const canGoNext = months.indexOf(monthFilter) < months.length - 1 && months.indexOf(monthFilter) !== -1;

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (monthFilter !== 'all') {
        const mk = getMonthKey(s.start_time);
        if (mk !== monthFilter) return false;
      }
      if (typeFilter !== 'all') {
        if (getSessionType(s) !== typeFilter) return false;
      }
      return true;
    });
  }, [sessions, monthFilter, typeFilter]);

  const sessionsByDate = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      if (typeFilter !== 'all' && getSessionType(s) !== typeFilter) return;
      const d = new Date(s.start_time);
      const key = toDateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessions, typeFilter]);

  const monthGrid = useMemo(() => {
    if (monthFilter === 'all') return [];
    return buildMonthGrid(monthFilter);
  }, [monthFilter]);

  const todayKey = toDateKey(now);

  const kpis = useMemo(() => {
    const allInvitees = filtered.flatMap(s => s.invitees || []);
    const totalEleves = filtered.reduce((sum, s) => sum + ((s.invitees || []).length || s.nb_invitees || 0), 0);
    const ca = totalEleves * PRICE;
    const nbAppele = allInvitees.filter(i => i.a_appele).length;
    const pctAppele = totalEleves > 0 ? Math.round((nbAppele / totalEleves) * 100) : 0;
    const nbFormRempli = allInvitees.filter(i => i.form_rempli).length;
    const pctForm = totalEleves > 0 ? Math.round((nbFormRempli / totalEleves) * 100) : 0;
    const withForm = allInvitees.filter(i => i.form_rempli);
    const nbDejaConduit = withForm.filter(i => i.deja_conduit).length;
    const pctDejaConduit = withForm.length > 0 ? Math.round((nbDejaConduit / withForm.length) * 100) : 0;
    const niveaux = { 'Débutant': 0, 'Intermédiaire': 0, 'Avancé': 0, 'Expert': 0 };
    withForm.forEach(i => {
      const n = i.niveau_scooter;
      if (n && niveaux.hasOwnProperty(n)) niveaux[n]++;
    });
    const totalNiveaux = Object.values(niveaux).reduce((a, b) => a + b, 0);
    return { totalEleves, ca, pctAppele, pctForm, nbFormRempli, pctDejaConduit, niveaux, totalNiveaux };
  }, [filtered]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const pctColor = (val, thresholds) => {
    if (thresholds.greenIf(val)) return 'var(--green)';
    if (thresholds.orangeIf(val)) return 'var(--orange)';
    return 'var(--red)';
  };

  const NIVEAU_COLORS = { 'Débutant': '#F87171', 'Intermédiaire': '#FBBF24', 'Avancé': '#60A5FA', 'Expert': '#34D399' };

  const expandedSession = expandedId ? sessions.find(s => s.id === expandedId) : null;

  const renderSessionDetail = (s) => {
    const invitees = s.invitees || [];
    const nbEleves = invitees.length || s.nb_invitees || 0;
    const ca = nbEleves * PRICE;
    const fallbackInvitees = invitees.length === 0 && s.invitee_name
      ? [{ name: s.invitee_name, email: s.invitee_email, _fallback: true }]
      : [];
    const displayInvitees = invitees.length > 0 ? invitees : fallbackInvitees;
    const nbFormRempli = invitees.filter(i => i.form_rempli).length;
    const tauxForm = nbEleves > 0 ? Math.round((nbFormRempli / nbEleves) * 100) : 0;

    return (
      <div className="session-detail-panel" style={{ marginTop: 8, borderRadius: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--accent-light)', fontWeight: 600, marginBottom: 8 }}>
          {formatDateShort(s.start_time)} — {s.event_type_name || 'Formation 125'}
        </div>
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
              const nStyle = isFallback ? null : getNiveauStyle(inv);
              return (
                <div key={i} className="session-detail-invitee-wrapper" style={nStyle ? {
                  borderLeft: `3px solid ${nStyle.borderColor}`,
                  borderRadius: '0 8px 8px 0',
                  background: nStyle.bgColor,
                } : undefined}>
                  <div className="session-detail-invitee">
                    <Avatar name={inv.name} photoUrl={inv.photo_identite} size={40} />
                    <div className="invitee-info">
                      <span className="invitee-name">{inv.name || '—'}</span>
                      <span className="invitee-email">{inv.email || '—'}</span>
                      {inv.phone && <PhoneLink phone={inv.phone} />}
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
                          {nStyle && (
                            <span style={{
                              fontSize: '11px', padding: '3px 9px', borderRadius: '12px',
                              fontWeight: 500, background: nStyle.badgeBg, color: nStyle.badgeColor,
                              whiteSpace: 'nowrap',
                            }}>
                              {nStyle.label}
                            </span>
                          )}
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
    );
  };

  const renderMobileSession = (s) => {
    const type = getSessionType(s);
    const invitees = s.invitees || [];
    const nbEleves = invitees.length || s.nb_invitees || 0;
    const ca = nbEleves * PRICE;
    const isExpanded = expandedId === s.id;

    return (
      <div key={s.id}>
        <div className="session-row-mobile" style={{ display: 'flex' }} onClick={() => toggleExpand(s.id)}>
          <div className="srm-line1">
            <span className="session-date">{formatDateShort(s.start_time)}</span>
            <span className={`badge ${type}`}>{type === 'we' ? 'WE' : 'SEM'}</span>
            <span style={{ marginLeft: 'auto' }}>
              {isExpanded
                ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
                : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              }
            </span>
          </div>
          <div className="srm-line2">
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.event_type_name || 'Formation 125'}
            </span>
            <span className="session-eleves" style={{ fontSize: '0.75rem' }}>{nbEleves} él.</span>
            <span className="session-ca" style={{ fontSize: '0.75rem' }}>{ca.toLocaleString('fr-FR')} €</span>
          </div>
        </div>
        {isExpanded && renderSessionDetail(s)}
      </div>
    );
  };

  return (
    <div>
      {/* Filters bar */}
      <div className="filters-bar">
        <CalendarDays size={16} style={{ color: 'var(--accent)' }} />
        <button className="month-nav-btn" onClick={() => goMonth(-1)} disabled={!canGoPrev} aria-label="Mois précédent">
          <ChevronLeft size={16} />
        </button>
        <select className="filter-select" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setExpandedId(null); }}>
          <option value="all">Tous les mois</option>
          {months.map(m => (
            <option key={m} value={m}>{getMonthLabel(m)}</option>
          ))}
        </select>
        <button className="month-nav-btn" onClick={() => goMonth(1)} disabled={!canGoNext} aria-label="Mois suivant">
          <ChevronRight size={16} />
        </button>
        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">Tous les types</option>
          <option value="we">Weekend</option>
          <option value="sem">Semaine</option>
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginLeft: 'auto' }}>
          {filtered.length} session{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
        <div className="kpi-card green">
          <span className="kpi-label"><Euro size={12} style={{ display: 'inline', marginRight: 4 }} />CA du mois</span>
          <span className="kpi-value" style={{ color: 'var(--green)' }}>{kpis.ca.toLocaleString('fr-FR')} €</span>
          <span className="kpi-sub">@{PRICE}€/élève</span>
          {(() => {
            const comp = caComparaison.find(c => c.mois === monthFilter);
            if (!comp) return <span style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>Pas de données N-1</span>;
            const pct = comp.variation_pct;
            if (pct == null) return <span style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>Pas de données N-1</span>;
            const positive = pct >= 0;
            const arrow = positive ? '↑' : '↓';
            const color = positive ? '#10b981' : '#ef4444';
            const [, mm] = monthFilter.split('-');
            const monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
            const monthLabel = monthNames[parseInt(mm) - 1];
            const yearN1 = parseInt(monthFilter.split('-')[0]) - 1;
            return (
              <div style={{ marginTop: 4 }}>
                <span style={{ color, fontSize: 14, fontWeight: 600 }}>
                  {arrow} {positive ? '+' : ''}{pct}% vs {monthLabel} {yearN1}
                </span>
                {comp.ca_n1 != null && (
                  <div style={{ color: '#64748b', fontSize: 11 }}>
                    ({comp.ca_n1.toLocaleString('fr-FR')}€ en {yearN1})
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        <div className="kpi-card accent">
          <span className="kpi-label"><Users size={12} style={{ display: 'inline', marginRight: 4 }} />Élèves</span>
          <span className="kpi-value">{kpis.totalEleves}</span>
          <span className="kpi-sub">{filtered.length} session{filtered.length > 1 ? 's' : ''}</span>
        </div>
        <div className="kpi-card" style={{ borderLeft: `3px solid ${pctColor(kpis.pctAppele, { greenIf: v => v < 30, orangeIf: v => v <= 50 })}` }}>
          <span className="kpi-label"><PhoneCall size={12} style={{ display: 'inline', marginRight: 4 }} />Ont téléphoné</span>
          <span className="kpi-value" style={{ color: pctColor(kpis.pctAppele, { greenIf: v => v < 30, orangeIf: v => v <= 50 }) }}>{kpis.pctAppele}%</span>
          <span className="kpi-sub">objectif : 0%</span>
        </div>
        <div className="kpi-card" style={{ borderLeft: `3px solid ${pctColor(kpis.pctForm, { greenIf: v => v > 80, orangeIf: v => v >= 50 })}` }}>
          <span className="kpi-label"><FileCheck size={12} style={{ display: 'inline', marginRight: 4 }} />Formulaire rempli</span>
          <span className="kpi-value" style={{ color: pctColor(kpis.pctForm, { greenIf: v => v > 80, orangeIf: v => v >= 50 }) }}>{kpis.pctForm}%</span>
          <span className="kpi-sub">{kpis.nbFormRempli}/{kpis.totalEleves}</span>
        </div>
        <div className="kpi-card blue">
          <span className="kpi-label">Déjà conduit</span>
          <span className="kpi-value">{kpis.pctDejaConduit}%</span>
          <span className="kpi-sub">parmi formulaires remplis</span>
        </div>
        <div className="kpi-card" style={{ borderLeft: '3px solid var(--text-muted)' }}>
          <span className="kpi-label">Répartition niveaux</span>
          {kpis.totalNiveaux > 0 ? (
            <>
              <div style={{
                display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden',
                marginTop: 6, marginBottom: 4
              }}>
                {Object.entries(kpis.niveaux).map(([niveau, count]) => {
                  if (count === 0) return null;
                  return (
                    <div key={niveau} style={{
                      width: `${(count / kpis.totalNiveaux) * 100}%`,
                      background: NIVEAU_COLORS[niveau],
                      transition: 'width 0.3s',
                    }} />
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                {Object.entries(kpis.niveaux).map(([niveau, count]) => (
                  count > 0 && (
                    <span key={niveau} style={{ fontSize: '0.65rem', color: NIVEAU_COLORS[niveau], fontWeight: 500 }}>
                      {niveau} {Math.round((count / kpis.totalNiveaux) * 100)}%
                    </span>
                  )
                ))}
              </div>
            </>
          ) : (
            <span className="kpi-sub">Aucune donnée</span>
          )}
        </div>
      </div>

      {/* DESKTOP: Month calendar view */}
      {!isMobile && monthFilter !== 'all' && (
        <>
          <div className="cal-grid">
            {/* Header row */}
            {DAY_NAMES.map(d => (
              <div key={d} className="cal-header">{d}</div>
            ))}
            {/* Day cells */}
            {monthGrid.map(({ date, inMonth }, idx) => {
              const key = toDateKey(date);
              const daySessions = sessionsByDate[key] || [];
              const isToday = key === todayKey;
              const dow = idx % 7;
              const isWeekend = dow >= 5;

              return (
                <div
                  key={idx}
                  className={`cal-cell${isToday ? ' cal-cell-today' : ''}${!inMonth ? ' cal-cell-outside' : ''}${isWeekend ? ' cal-cell-weekend' : ''}`}
                >
                  <span className={`cal-day-num${isToday ? ' today' : ''}`}>
                    {date.getDate()}
                  </span>
                  {daySessions.map(s => {
                    const type = getSessionType(s);
                    const invitees = s.invitees || [];
                    const nbEleves = invitees.length || s.nb_invitees || 0;
                    const ca = nbEleves * PRICE;
                    const isActive = expandedId === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`cal-session${isActive ? ' active' : ''}`}
                        onClick={() => toggleExpand(s.id)}
                      >
                        <span className={`badge ${type}`} style={{ fontSize: '0.55rem', padding: '1px 5px' }}>
                          {type === 'we' ? 'WE' : 'SEM'}
                        </span>
                        <span className="cal-session-text">
                          {nbEleves} él. · {ca.toLocaleString('fr-FR')}€
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {expandedSession && renderSessionDetail(expandedSession)}
        </>
      )}

      {/* Desktop fallback when "all months" selected — show list */}
      {!isMobile && monthFilter === 'all' && (
        <div className="session-list">
          {filtered.map(s => {
            const type = getSessionType(s);
            const invitees = s.invitees || [];
            const nbEleves = invitees.length || s.nb_invitees || 0;
            const ca = nbEleves * PRICE;
            const isExpanded = expandedId === s.id;
            return (
              <div key={s.id}>
                <div className="session-row" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(s.id)}>
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
                {isExpanded && renderSessionDetail(s)}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
              Aucune session trouvée
            </p>
          )}
        </div>
      )}

      {/* MOBILE: List view */}
      {isMobile && (
        <div className="session-list">
          {filtered.map(s => renderMobileSession(s))}
          {filtered.length === 0 && (
            <p className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
              Aucune session trouvée
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default Agenda;
