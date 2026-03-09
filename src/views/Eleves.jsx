import { useState, useMemo } from 'react';
import { Search, X, User, Phone, Mail, FileText, Calendar, ExternalLink } from 'lucide-react';
import { formatDate, getMonthKey, getMonthLabel, getSessionType } from '../utils';
import Avatar from '../components/Avatar';

const NIVEAU_BADGE = {
  'Débutant': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  'Intermédiaire': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  'Avancé': { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  'Expert': { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
};

const truncate = (str, max) => {
  if (!str) return null;
  return str.length > max ? str.slice(0, max) + '…' : str;
};

const sectionTitle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 };
const labelStyle = { fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 };
const valueStyle = { fontSize: 13, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', wordBreak: 'break-word' };
const separator = { borderTop: '1px solid #1e293b', margin: '10px 0' };

function DocBtn({ label, url }) {
  const exists = !!url;
  return (
    <button
      onClick={exists ? () => window.open(url, '_blank') : undefined}
      style={{
        padding: '6px 10px', fontSize: 11, borderRadius: 6, fontWeight: 600, border: 'none',
        cursor: exists ? 'pointer' : 'default',
        background: exists ? 'rgba(16,185,129,0.15)' : '#334155',
        color: exists ? '#10b981' : '#64748b',
      }}
    >
      {label}
    </button>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: 8, overflow: 'hidden' }}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{children}</div>
    </div>
  );
}

function EleveExpandedPanel({ eleve }) {
  const niveauStyle = NIVEAU_BADGE[eleve.niveau_scooter] || { bg: 'rgba(107,113,148,0.15)', color: '#64748b' };
  const appels = eleve.resumes_appels || [];

  return (
    <div className="eleve-panel">
      {/* COLONNE 1 — Identité */}
      <div style={{ overflow: 'hidden', minWidth: 0 }}>
        <div style={{ ...sectionTitle, color: '#6C63FF' }}>Identité</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Avatar name={eleve.name} photoUrl={eleve.photo_identite} size={80} />
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eleve.name || '—'}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{eleve.email || '—'}</div>
            {eleve.phone && <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{eleve.phone}</div>}
          </div>
        </div>
        <div style={separator} />
        <FieldRow label="NEPH">
          <span style={!eleve.neph ? { fontStyle: 'italic', color: '#64748b' } : {}}>
            {eleve.neph || 'Non renseigné'}
          </span>
        </FieldRow>
        <FieldRow label="Permis B obtenu le">
          <span style={!eleve.date_obtention_permis_b ? { fontStyle: 'italic', color: '#64748b' } : {}}>
            {eleve.date_obtention_permis_b || 'Non renseigné'}
          </span>
        </FieldRow>
        <div style={separator} />
        <div style={labelStyle}>Documents</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
          <DocBtn label="Permis R" url={eleve.photo_permis_recto} />
          <DocBtn label="Permis V" url={eleve.photo_permis_verso} />
          <DocBtn label="Photo" url={eleve.photo_identite} />
          <DocBtn label="Signature" url={eleve.photo_signature} />
        </div>
      </div>

      {/* COLONNE 2 — Profil conduite */}
      <div style={{ overflow: 'hidden', minWidth: 0 }}>
        <div style={{ ...sectionTitle, color: '#6C63FF' }}>Profil conduite</div>
        <FieldRow label="Niveau scooter">
          <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: niveauStyle.bg, color: niveauStyle.color,
          }}>
            {eleve.niveau_scooter || 'Non renseigné'}
          </span>
        </FieldRow>
        <FieldRow label="Déjà conduit">
          <span style={{ fontWeight: 600, color: eleve.deja_conduit ? '#10b981' : '#ef4444' }}>
            {eleve.deja_conduit ? 'Oui' : 'Non'}
          </span>
        </FieldRow>
        {eleve.occasions_conduite && (
          <FieldRow label="Occasions">{truncate(eleve.occasions_conduite, 100)}</FieldRow>
        )}
        {eleve.derniere_conduite && (
          <FieldRow label="Dernière conduite">{eleve.derniere_conduite}</FieldRow>
        )}
        <FieldRow label="Source">{eleve.source_acquisition || 'Non renseigné'}</FieldRow>
        {eleve.raison_reservation && (
          <FieldRow label="Raison réservation">{truncate(eleve.raison_reservation, 100)}</FieldRow>
        )}
        {eleve.commentaires && (
          <FieldRow label="Commentaires">
            <span style={{ color: '#94a3b8' }}>{eleve.commentaires}</span>
          </FieldRow>
        )}
      </div>

      {/* COLONNE 3 — Historique appels */}
      <div style={{ overflow: 'hidden', minWidth: 0 }}>
        <div style={{ ...sectionTitle, color: '#ef4444' }}>
          Appels Ringover ({appels.length})
        </div>
        {appels.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
            {appels.map((r, i) => (
              <div key={i} style={{
                background: '#1e293b', borderRadius: 8, padding: '10px 12px',
                border: '1px solid #334155', overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
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
                  fontSize: 12, color: '#cbd5e1', marginTop: 4, lineHeight: 1.4,
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
            ))}
          </div>
        ) : (
          <div style={{
            background: 'rgba(16,185,129,0.1)', borderRadius: 8,
            padding: 12, fontSize: 13, color: '#10b981', fontWeight: 500,
          }}>
            Aucun appel — parcours idéal
          </div>
        )}
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
              <div
                className="session-row"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleExpand(key)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, minWidth: 180 }}>
                  <Avatar name={e.name} photoUrl={e.photo_identite} size={32} />
                  {e.name || '—'}
                </span>
                <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: 180 }}>{e.email || '—'}</span>
                <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: 90 }}>{formatDate(session?.start_time)}</span>
                <span style={{ minWidth: 50 }}>
                  {e.form_rempli ? <span className="invitee-badge green">Form OK</span> : <span className="invitee-badge orange">Manquant</span>}
                </span>
                <span style={{ minWidth: 80, fontSize: '0.8rem' }}>{e.niveau_scooter || '—'}</span>
                <span className="mono" style={{ fontSize: '0.8rem', color: e.a_appele ? 'var(--red)' : 'var(--text-muted)', minWidth: 50 }}>
                  {e.nb_appels || 0} appel{(e.nb_appels || 0) > 1 ? 's' : ''}
                </span>
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
