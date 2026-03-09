import { useState, useMemo } from 'react';
import { Search, X, User, Phone, Mail, FileText, Calendar } from 'lucide-react';
import { formatDate, getMonthKey, getMonthLabel, getSessionType } from '../utils';
import FicheEleve from '../components/FicheEleve';
import Avatar from '../components/Avatar';

function Eleves({ data }) {
  const { eleves, sessions } = data;
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const months = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => {
      const mk = getMonthKey(s.start_time);
      if (mk) set.add(mk);
    });
    return [...set].sort();
  }, [sessions]);

  // Build a map: invitee calendly_event_id -> session
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

  const selectedEleve = selected;
  const selectedSession = selectedEleve ? getEleveSession(selectedEleve) : null;

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

      <div className="table-container">
        <table className="eleves-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Date formation</th>
              <th>Formulaire</th>
              <th>Niveau scooter</th>
              <th>Appels</th>
              <th>Emails</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => {
              const session = getEleveSession(e);
              return (
                <tr key={i} onClick={() => setSelected(e)}>
                  <td style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Avatar name={e.name} photoUrl={e.photo_identite} size={32} />
                    {e.name || '—'}
                  </td>
                  <td className="mono">{e.email || '—'}</td>
                  <td className="mono">{formatDate(session?.start_time)}</td>
                  <td>{e.form_rempli ? <span className="status-yes">Oui</span> : <span className="status-no">Non</span>}</td>
                  <td>{e.niveau_scooter || '—'}</td>
                  <td className="mono" style={{ color: e.a_appele ? 'var(--red)' : 'var(--text-muted)' }}>{e.nb_appels || 0}</td>
                  <td className="mono" style={{ color: e.nbEmails > 0 ? 'var(--orange)' : 'var(--text-muted)' }}>{e.nbEmails}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
            Aucun élève trouvé
          </p>
        )}
      </div>

      {selectedEleve && (
        <div className="detail-overlay" onClick={() => setSelected(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <Avatar name={selectedEleve.name} photoUrl={selectedEleve.photo_identite} size={80} />
              <h2>{selectedEleve.name || selectedEleve.email}</h2>
              <button className="detail-close" onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="detail-section">
              <h3><User size={14} /> Informations</h3>
              <div className="detail-grid">
                <div className="detail-field">
                  <div className="label">Email</div>
                  <div className="value">{selectedEleve.email || '—'}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Téléphone</div>
                  <div className="value">{selectedEleve.phone || '—'}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Niveau scooter</div>
                  <div className="value">{selectedEleve.niveau_scooter || '—'}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Source</div>
                  <div className="value">{selectedEleve.source_acquisition || '—'}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Statut</div>
                  <div className="value">{selectedEleve.status || '—'}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Paiement</div>
                  <div className="value">{selectedEleve.payment_amount ? `${selectedEleve.payment_amount} €` : '—'}</div>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3><Calendar size={14} /> Session</h3>
              {selectedSession ? (
                <div className="detail-item">
                  <div className="detail-item-date">{formatDate(selectedSession.start_time)}</div>
                  {selectedSession.event_type_name || 'Formation 125'}
                  {' — '}{getSessionType(selectedSession) === 'we' ? 'Weekend' : 'Semaine'}
                </div>
              ) : (
                <p className="empty-state">Aucune session</p>
              )}
            </div>

            <div className="detail-section">
              <h3><Phone size={14} /> Résumés des appels ({(selectedEleve.resumes_appels || []).length})</h3>
              {(selectedEleve.resumes_appels || []).length > 0 ? (
                (selectedEleve.resumes_appels || []).map((r, i) => (
                  <div key={i} className="detail-item">
                    <div className="detail-item-date">{formatDate(r.date_appel)}</div>
                    <div><strong>{r.type_appel || 'Appel'}</strong> — {r.duree_secondes ? `${Math.round(r.duree_secondes / 60)} min` : ''}</div>
                    <div style={{ marginTop: 4 }}>{r.resume || 'Pas de résumé'}</div>
                    {r.motifs && Array.isArray(r.motifs) && r.motifs.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {r.motifs.map((m, j) => (
                          <span key={j} style={{
                            background: 'rgba(108, 99, 255, 0.15)',
                            color: 'var(--accent-light)',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: '0.7rem',
                            fontWeight: 500
                          }}>{m}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="empty-state">Aucun appel</p>
              )}
            </div>

            <div className="detail-section">
              <h3><Mail size={14} /> Emails ({selectedEleve.emails.length})</h3>
              {selectedEleve.emails.length > 0 ? (
                selectedEleve.emails.map((em, i) => (
                  <div key={i} className="detail-item">
                    <div className="detail-item-date">{formatDate(em.date_reception)}</div>
                    <strong>{em.sujet || 'Sans objet'}</strong>
                    {em.body_extrait && (
                      <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {em.body_extrait}
                      </div>
                    )}
                    {em.categorie && (
                      <div style={{ marginTop: 4, fontSize: '0.7rem', color: 'var(--accent-light)' }}>
                        {em.categorie}{em.sous_categorie ? ` → ${em.sous_categorie}` : ''}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="empty-state">Aucun email</p>
              )}
            </div>

            <div className="detail-section">
              <FicheEleve invitee={selectedEleve} defaultOpen={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Eleves;
