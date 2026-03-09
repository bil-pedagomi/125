import { useState, useMemo } from 'react';
import { Search, X, User, Phone, Mail, FileText, Calendar, ExternalLink } from 'lucide-react';
import { formatDate, getMonthKey, getMonthLabel, getSessionType } from '../utils';
import Avatar from '../components/Avatar';

const NIVEAU_COLORS = {
  'Débutant': { bg: 'var(--red-bg, rgba(248,113,113,0.15))', color: 'var(--red)' },
  'Intermédiaire': { bg: 'var(--orange-bg, rgba(251,191,36,0.15))', color: 'var(--orange)' },
  'Avancé': { bg: 'rgba(96,165,250,0.15)', color: 'var(--blue)' },
  'Expert': { bg: 'var(--green-bg, rgba(52,211,153,0.15))', color: 'var(--green)' },
};

function DocBadge({ label, url }) {
  const exists = !!url;
  return (
    <a
      href={exists ? url : undefined}
      target={exists ? '_blank' : undefined}
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
        textDecoration: 'none', cursor: exists ? 'pointer' : 'default',
        background: exists ? 'var(--green-bg, rgba(52,211,153,0.15))' : 'rgba(107,113,148,0.12)',
        color: exists ? 'var(--green)' : 'var(--text-muted)',
        border: `1px solid ${exists ? 'rgba(52,211,153,0.3)' : 'rgba(107,113,148,0.15)'}`,
      }}
    >
      <ExternalLink size={10} />
      {label}
    </a>
  );
}

function EleveExpandedPanel({ eleve }) {
  const niveauStyle = NIVEAU_COLORS[eleve.niveau_scooter] || { bg: 'rgba(107,113,148,0.15)', color: 'var(--text-muted)' };
  const appels = eleve.resumes_appels || [];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem',
      padding: '1.25rem', background: 'var(--bg-secondary)', borderRadius: 10,
      border: '1px solid var(--border)', marginTop: 2,
    }}>
      {/* COLONNE 1 — Identité & Documents */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Identité & Documents
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Avatar name={eleve.name} photoUrl={eleve.photo_identite} size={80} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{eleve.name || '—'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{eleve.email || '—'}</div>
            {eleve.phone && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{eleve.phone}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>NEPH</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{eleve.neph || 'Non renseigné'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Permis B obtenu le</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{eleve.date_obtention_permis_b || 'Non renseigné'}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Documents</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <DocBadge label="Permis recto" url={eleve.photo_permis_recto} />
            <DocBadge label="Permis verso" url={eleve.photo_permis_verso} />
            <DocBadge label="Photo ID" url={eleve.photo_identite} />
            <DocBadge label="Signature" url={eleve.photo_signature} />
          </div>
        </div>
      </div>

      {/* COLONNE 2 — Profil conduite */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Profil conduite
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Niveau scooter</div>
            <span style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
              background: niveauStyle.bg, color: niveauStyle.color, marginTop: 2,
            }}>
              {eleve.niveau_scooter || 'Non renseigné'}
            </span>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Déjà conduit</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: eleve.deja_conduit ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
              {eleve.deja_conduit ? 'Oui' : 'Non'}
            </div>
          </div>
          {eleve.occasions_conduite && (
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Occasions</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: 2 }}>{eleve.occasions_conduite}</div>
            </div>
          )}
          {eleve.derniere_conduite && (
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Dernière conduite</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: 2 }}>{eleve.derniere_conduite}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Source</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: 2 }}>{eleve.source_acquisition || 'Non renseigné'}</div>
          </div>
          {eleve.raison_reservation && (
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Raison réservation</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: 2 }}>{eleve.raison_reservation}</div>
            </div>
          )}
        </div>
        {eleve.commentaires && (
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Commentaires</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{eleve.commentaires}</div>
          </div>
        )}
      </div>

      {/* COLONNE 3 — Historique contact */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Historique contact
        </div>
        {appels.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 300, overflowY: 'auto' }}>
            {appels.map((r, i) => (
              <div key={i} style={{
                background: 'var(--bg-primary)', borderRadius: 8, padding: '0.6rem 0.75rem',
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {formatDate(r.date_appel)}
                  </span>
                  {r.duree_secondes && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {Math.round(r.duree_secondes / 60)} min
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {r.type_appel || 'Appel'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                  {r.resume || 'Pas de résumé'}
                </div>
                {r.motifs && Array.isArray(r.motifs) && r.motifs.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {r.motifs.map((m, j) => (
                      <span key={j} style={{
                        background: 'rgba(108,99,255,0.15)', color: 'var(--accent-light)',
                        padding: '2px 8px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 500,
                      }}>{m}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: 'var(--green-bg, rgba(52,211,153,0.1))', borderRadius: 8,
            padding: '0.75rem', fontSize: '0.8rem', color: 'var(--green)', fontWeight: 500,
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
