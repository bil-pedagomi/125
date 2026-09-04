import { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import { fetchSMSHistory, formatHeureSms } from '../utils';

const STATUT_STYLE = {
  sent: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Envoyé', Icon: CheckCircle },
  failed: { color: '#E24B4A', bg: 'rgba(226,75,74,0.12)', label: 'Échec', Icon: XCircle },
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'En attente', Icon: Clock },
};

// Les relances pré-formation portent un heure_groupe en 'relance_j-1' ; les SMS
// de groupe portent une vraie heure ('12h30'). On distingue les deux à l'œil.
const RELANCE_LABEL = {
  'relance_anticipation': 'Relance anticipation',
  'relance_j-2': 'Relance J-2',
  'relance_j-1': 'Relance J-1',
};

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function SmsHistorique({ eventUuid }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!eventUuid) return;
    let cancelled = false;
    setLoading(true);
    setErreur(null);
    fetchSMSHistory(eventUuid)
      .then(data => { if (!cancelled) setRows(data); })
      .catch(e => {
        console.error('Erreur historique SMS:', e);
        // Un historique vide et un historique illisible ne veulent pas dire la
        // même chose : le second doit se voir, sinon on croit qu'aucun SMS
        // n'est parti alors qu'on n'en sait rien (cas du 01/09 au 04/09).
        if (!cancelled) setErreur(e.message || String(e));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventUuid]);

  if (loading) {
    return <div style={{ padding: 12, color: '#64748b', fontSize: 12 }}>Chargement historique SMS...</div>;
  }

  if (erreur) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: '#E24B4A', display: 'flex', alignItems: 'center', gap: 6 }}>
        <XCircle size={14} />
        Historique SMS indisponible — {erreur}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#475569', fontSize: 12 }}>
        <MessageSquare size={16} style={{ marginBottom: 4 }} />
        <div>Aucun SMS envoyé pour cette session</div>
      </div>
    );
  }

  const sent = rows.filter(r => r.statut === 'sent').length;
  const failed = rows.filter(r => r.statut === 'failed').length;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        fontSize: 12, color: '#94a3b8', fontWeight: 600,
      }}>
        <MessageSquare size={14} />
        Historique SMS — {rows.length} envoi{rows.length > 1 ? 's' : ''}
        {sent > 0 && <span style={{ color: '#10b981' }}>({sent} OK)</span>}
        {failed > 0 && <span style={{ color: '#E24B4A' }}>({failed} échec{failed > 1 ? 's' : ''})</span>}
      </div>

      <div style={{
        background: '#12172a', border: '1px solid #1e2640', borderRadius: 8, overflow: 'hidden',
      }}>
        {rows.map((r, i) => {
          const s = STATUT_STYLE[r.statut] || STATUT_STYLE.pending;
          const relance = RELANCE_LABEL[r.heure_groupe];
          return (
            <div
              key={r.id || i}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px',
                borderBottom: i < rows.length - 1 ? '1px solid #1e2640' : 'none',
              }}
            >
              <s.Icon size={12} style={{ color: s.color, flexShrink: 0 }} />

              <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500, minWidth: 90 }}>
                {r.prenom || '—'}
              </span>

              <span style={{ fontSize: 11, color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {relance || (r.heure_groupe ? `Convocation ${formatHeureSms(r.heure_groupe.replace('h', ':'))}` : '')}
              </span>

              {r.groupe_numero && (
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(108,99,255,0.15)', color: '#a5b4fc', fontWeight: 600 }}>
                  G{r.groupe_numero}
                </span>
              )}

              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: s.bg, color: s.color, fontWeight: 600 }}>
                {s.label}
              </span>

              <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
                {formatDate(r.sent_at || r.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
