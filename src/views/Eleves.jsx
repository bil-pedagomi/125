import { useState, useMemo } from 'react';
import { Search, X, User, Phone, Mail, FileText, Calendar, MapPin } from 'lucide-react';
import { formatDate, getMonthKey, getMonthLabel, isWeekend } from '../utils';

function Eleves({ data }) {
  const { eleves, sessions } = data;
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const months = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => {
      const mk = getMonthKey(s.start_time || s.date);
      if (mk) set.add(mk);
    });
    return [...set].sort();
  }, [sessions]);

  const getEleveSession = (eleve) => {
    return sessions.find(s =>
      s.invitees?.some(i => i.emailNorm === eleve.emailNorm)
    );
  };

  const filtered = useMemo(() => {
    return eleves.filter(e => {
      if (search) {
        const q = search.toLowerCase();
        const name = (e.name || e.nom || '').toLowerCase();
        const email = (e.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      if (monthFilter !== 'all' || typeFilter !== 'all') {
        const session = getEleveSession(e);
        const dateStr = session?.start_time || session?.date;
        if (monthFilter !== 'all') {
          const mk = getMonthKey(dateStr);
          if (mk !== monthFilter) return false;
        }
        if (typeFilter !== 'all') {
          const we = isWeekend(dateStr);
          if (typeFilter === 'we' && !we) return false;
          if (typeFilter === 'sem' && we) return false;
        }
      }
      return true;
    });
  }, [eleves, search, monthFilter, typeFilter, sessions]);

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
              const dateStr = session?.start_time || session?.date;
              return (
                <tr key={i} onClick={() => setSelected(e)}>
                  <td style={{ fontWeight: 500 }}>{e.name || e.nom || '—'}</td>
                  <td className="mono">{e.email || '—'}</td>
                  <td className="mono">{formatDate(dateStr)}</td>
                  <td>{e.formulaireRempli ? <span className="status-yes">Oui</span> : <span className="status-no">Non</span>}</td>
                  <td>{e.niveauScooter}</td>
                  <td className="mono" style={{ color: e.nbAppels > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{e.nbAppels}</td>
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
              <h2>{selectedEleve.name || selectedEleve.nom || selectedEleve.email}</h2>
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
                  <div className="value">{selectedEleve.phone || selectedEleve.telephone || '—'}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Niveau scooter</div>
                  <div className="value">{selectedEleve.niveauScooter}</div>
                </div>
                <div className="detail-field">
                  <div className="label">Source</div>
                  <div className="value">{selectedEleve.source}</div>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3><Calendar size={14} /> Sessions</h3>
              {selectedSession ? (
                <div className="detail-item">
                  <div className="detail-item-date">{formatDate(selectedSession.start_time || selectedSession.date)}</div>
                  {selectedSession.name || selectedSession.event_type || 'Formation 125'}
                  {' — '}{isWeekend(selectedSession.start_time || selectedSession.date) ? 'Weekend' : 'Semaine'}
                </div>
              ) : (
                <p className="empty-state">Aucune session</p>
              )}
            </div>

            <div className="detail-section">
              <h3><Phone size={14} /> Résumés des appels ({selectedEleve.resumesAppels.length})</h3>
              {selectedEleve.resumesAppels.length > 0 ? (
                selectedEleve.resumesAppels.map((r, i) => (
                  <div key={i} className="detail-item">
                    <div className="detail-item-date">{formatDate(r.date || r.created_at)}</div>
                    {r.resume || r.summary || r.motif || r.motifs?.join(', ') || 'Pas de résumé'}
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
                    <div className="detail-item-date">{formatDate(em.date || em.created_at)}</div>
                    <strong>{em.subject || em.objet || 'Sans objet'}</strong>
                    {em.body_preview || em.preview ? (
                      <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {em.body_preview || em.preview}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="empty-state">Aucun email</p>
              )}
            </div>

            {selectedEleve.formulaire && (
              <div className="detail-section">
                <h3><FileText size={14} /> Formulaire</h3>
                <div className="detail-item">
                  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                    {JSON.stringify(selectedEleve.formulaire, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function isWeekendLocal(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

export default Eleves;
