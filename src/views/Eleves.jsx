import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { formatDate, getMonthKey, getMonthLabel, getSessionType } from '../utils';
import Avatar from '../components/Avatar';

const NIVEAU_BADGE = {
  'Débutant': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  'Intermédiaire': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  'Avancé': { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  'Expert': { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
};

const ELEVES_CSS = `
.eleve-row {
  display: grid;
  grid-template-columns: 40px 180px 1fr 100px 80px 200px 80px;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}
.eleve-row:hover { background: rgba(108,99,255,0.06); }
.eleve-row .er-photo { flex-shrink: 0; }
.eleve-row .er-name { font-weight: 500; font-size: 13px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.eleve-row .er-email { font-size: 11px; color: #64748b; font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.eleve-row .er-date { font-size: 12px; color: #94a3b8; font-family: var(--font-mono); }
.eleve-row .er-form { }
.eleve-row .er-niveau { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.eleve-row .er-appels { font-size: 12px; font-family: var(--font-mono); }
.eleve-row .er-mobile-l1 { display: none; }
.eleve-row .er-mobile-l2 { display: none; }

.eleve-detail-grid {
  display: grid;
  grid-template-columns: 250px 1fr 300px;
  gap: 24px;
}

@media (max-width: 1023px) and (min-width: 768px) {
  .eleve-row {
    grid-template-columns: 40px 1fr 1fr 80px 80px;
  }
  .eleve-row .er-niveau { display: none; }
  .eleve-row .er-date { display: none; }
}

@media (max-width: 767px) {
  .eleve-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 16px;
  }
  .eleve-row .er-photo,
  .eleve-row .er-name,
  .eleve-row .er-email,
  .eleve-row .er-date,
  .eleve-row .er-form,
  .eleve-row .er-niveau,
  .eleve-row .er-appels { display: none; }
  .eleve-row .er-mobile-l1 {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  .eleve-row .er-mobile-l2 {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-left: 40px;
  }
  .eleve-detail-grid {
    grid-template-columns: 1fr;
  }
}
`;

function EleveExpandedPanel({ eleve }) {
  const niveauStyle = NIVEAU_BADGE[eleve.niveau_scooter] || { bg: 'rgba(107,113,148,0.15)', color: '#64748b' };
  const appels = eleve.resumes_appels || [];

  const profilRows = [
    { label: 'Niveau', value: eleve.niveau_scooter, badge: true },
    { label: 'Déjà conduit', value: eleve.deja_conduit ? 'Oui' : 'Non', color: eleve.deja_conduit ? '#10b981' : '#ef4444' },
    eleve.occasions_conduite && { label: 'Occasions', value: eleve.occasions_conduite },
    eleve.derniere_conduite && { label: 'Dernière conduite', value: eleve.derniere_conduite },
    { label: 'Source', value: eleve.source_acquisition || '—' },
    eleve.raison_reservation && { label: 'Raison', value: eleve.raison_reservation },
    eleve.commentaires && { label: 'Commentaires', value: eleve.commentaires },
  ].filter(Boolean);

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderTop: 'none',
      borderRadius: '0 0 12px 12px',
      padding: 24,
      marginTop: -4,
      maxHeight: 500,
      overflowY: 'auto',
    }}>
      <div className="eleve-detail-grid">
        {/* COLONNE 1 — Identité */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Avatar name={eleve.name} photoUrl={eleve.photo_identite} size={80} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', textAlign: 'center' }}>{eleve.name || '—'}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'center' }}>{eleve.email || '—'}</div>
          {eleve.phone && <div style={{ fontSize: 13, color: '#94a3b8' }}>{eleve.phone}</div>}

          <div style={{ height: 1, background: '#1e293b', width: '100%', margin: '8px 0' }} />

          <div style={{ width: '100%' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>NEPH</div>
            <div style={{ fontSize: 13, color: '#e2e8f0' }}>{eleve.neph || <span style={{ color: '#64748b', fontStyle: 'italic' }}>Non renseigné</span>}</div>
          </div>
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Permis B obtenu le</div>
            <div style={{ fontSize: 13, color: '#e2e8f0' }}>{eleve.date_obtention_permis_b || <span style={{ color: '#64748b', fontStyle: 'italic' }}>Non renseigné</span>}</div>
          </div>

          <div style={{ height: 1, background: '#1e293b', width: '100%', margin: '8px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%' }}>
            {[
              { label: 'Permis R', url: eleve.photo_permis_recto },
              { label: 'Permis V', url: eleve.photo_permis_verso },
              { label: 'Photo', url: eleve.photo_identite },
              { label: 'Signature', url: eleve.photo_signature },
            ].map(doc => (
              <button
                key={doc.label}
                onClick={doc.url ? () => window.open(doc.url, '_blank') : undefined}
                style={{
                  fontSize: 10, padding: '5px 8px', borderRadius: 6, border: 'none', fontWeight: 600,
                  cursor: doc.url ? 'pointer' : 'default',
                  background: doc.url ? 'rgba(16,185,129,0.15)' : '#334155',
                  color: doc.url ? '#10b981' : '#64748b',
                }}
              >
                {doc.label}
              </button>
            ))}
          </div>
        </div>

        {/* COLONNE 2 — Profil conduite */}
        <div style={{ overflow: 'hidden', minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#8b5cf6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 12 }}>
            Profil conduite
          </div>
          {profilRows.map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1e293b' }}>
              <span style={{ fontSize: 12, color: '#64748b', minWidth: 120, flexShrink: 0 }}>{row.label}</span>
              {row.badge ? (
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 6,
                  background: niveauStyle.bg, color: niveauStyle.color,
                }}>
                  {eleve.niveau_scooter || 'Non renseigné'}
                </span>
              ) : (
                <span style={{
                  fontSize: 12, color: row.color || '#e2e8f0', textAlign: 'right',
                  maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontWeight: row.color ? 600 : 400,
                }}>
                  {row.value}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* COLONNE 3 — Historique appels */}
        <div style={{ overflow: 'hidden', minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#ef4444', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 12 }}>
            Appels Ringover ({appels.length})
          </div>
          {appels.length === 0 ? (
            <div style={{ fontSize: 13, color: '#10b981', padding: '8px 0' }}>
              Aucun appel
            </div>
          ) : (
            appels.map((r, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                    {formatDate(r.date_appel)}
                  </span>
                  {r.duree_secondes != null && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                    }}>
                      {Math.round(r.duree_secondes / 60)} min
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 11, color: '#94a3b8', lineHeight: 1.4,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                }}>
                  {r.resume || 'Pas de résumé'}
                </div>
                {r.motifs && Array.isArray(r.motifs) && r.motifs.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {r.motifs.map((m, j) => (
                      <span key={j} style={{
                        background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      }}>{m}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Eleves({ data }) {
  const { eleves, sessions } = data;
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
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

  const sessionByEventId = useMemo(() => {
    const map = {};
    sessions.forEach(s => { map[s.id] = s; });
    return map;
  }, [sessions]);

  const getEleveSession = (eleve) => {
    return sessionByEventId[eleve.calendly_event_id] || null;
  };

  const filtered = useMemo(() => {
    return eleves.filter(e => {
      if (search) {
        const q = search.toLowerCase();
        const name = (e.name || '').toLowerCase();
        const email = (e.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      if (monthFilter !== 'all' || typeFilter !== 'all') {
        const session = getEleveSession(e);
        if (monthFilter !== 'all') {
          const mk = getMonthKey(session?.start_time);
          if (mk !== monthFilter) return false;
        }
        if (typeFilter !== 'all') {
          if (!session) return false;
          const type = getSessionType(session);
          if (type !== typeFilter) return false;
        }
      }
      return true;
    });
  }, [eleves, search, monthFilter, typeFilter, sessionByEventId]);

  const toggleExpand = (eleveEmail) => {
    setExpandedId(expandedId === eleveEmail ? null : eleveEmail);
  };

  return (
    <div>
      <style>{ELEVES_CSS}</style>
      <div className="filters-bar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="filter-input"
            placeholder="Rechercher un élève…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
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
          {filtered.length} élève{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="session-list">
        {filtered.map((e, i) => {
          const session = getEleveSession(e);
          const key = e.email || i;
          const isExpanded = expandedId === key;
          return (
            <div key={key}>
              <div className="eleve-row" onClick={() => toggleExpand(key)}>
                {/* Desktop cells */}
                <span className="er-photo"><Avatar name={e.name} photoUrl={e.photo_identite} size={32} /></span>
                <span className="er-name">{e.name || '—'}</span>
                <span className="er-email">{e.email || '—'}</span>
                <span className="er-date">{formatDate(session?.start_time)}</span>
                <span className="er-form">
                  {e.form_rempli
                    ? <span className="invitee-badge green">Form OK</span>
                    : <span className="invitee-badge orange">Manquant</span>}
                </span>
                <span className="er-niveau">{e.niveau_scooter || '—'}</span>
                <span className="er-appels" style={{ color: e.a_appele ? '#ef4444' : '#64748b' }}>
                  {e.nb_appels || 0} appel{(e.nb_appels || 0) > 1 ? 's' : ''}
                </span>
                {/* Mobile layout */}
                <div className="er-mobile-l1">
                  <Avatar name={e.name} photoUrl={e.photo_identite} size={32} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name || '—'}</span>
                  {e.form_rempli
                    ? <span className="invitee-badge green">Form OK</span>
                    : <span className="invitee-badge orange">Manquant</span>}
                </div>
                <div className="er-mobile-l2">
                  <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{e.email || '—'}</span>
                  <span style={{ fontSize: 11, color: e.a_appele ? '#ef4444' : '#64748b', flexShrink: 0 }}>
                    {e.nb_appels || 0} appel{(e.nb_appels || 0) > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              {isExpanded && <EleveExpandedPanel eleve={e} />}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
            Aucun élève trouvé
          </p>
        )}
      </div>
    </div>
  );
}

export default Eleves;
