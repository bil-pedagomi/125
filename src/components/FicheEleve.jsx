import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Download, Eye, AlertTriangle } from 'lucide-react';
import Avatar from './Avatar';
import Lightbox from './Lightbox';
import { formatDate, getNiveauStyle } from '../utils';

function DocBadge({ label, url, onView }) {
  const exists = !!url;
  if (!exists) {
    return (
      <span className="doc-badge doc-badge-missing">
        {label}
      </span>
    );
  }
  return (
    <span className="doc-badge doc-badge-ok" style={{ gap: 0, paddingRight: 0 }}>
      <span style={{ marginRight: 4 }}>{label}</span>
      <a
        href={url}
        download
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="Télécharger"
        style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 5px', color: 'inherit', borderLeft: '1px solid rgba(255,255,255,0.15)', marginLeft: 2 }}
      >
        <Download size={10} />
      </a>
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onView(); }}
        title="Visualiser"
        style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 5px', color: 'inherit', background: 'none', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}
      >
        <Eye size={10} />
      </button>
    </span>
  );
}

const RELANCE_BADGE = {
  anticipation: { emoji: '\u{1F4C5}', label: 'Anticipation', bg: 'rgba(55,138,221,0.15)', color: '#378ADD' },
  'j-2':        { emoji: '⏰',    label: 'J-2',          bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  'j-1':        { emoji: '\u{1F514}', label: 'J-1',          bg: 'rgba(226,75,74,0.15)',  color: '#E24B4A' },
};

function RelancesSMS({ relances, nbRelances }) {
  const count = nbRelances ?? relances?.length ?? 0;
  const sorted = (relances || []).slice().sort((a, b) => new Date(b.date_envoi) - new Date(a.date_envoi));

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
        color: '#f59e0b', marginBottom: 6,
      }}>
        Relances SMS
      </div>
      {count === 0 ? (
        <div style={{ fontSize: 12, color: '#64748b' }}>Aucune relance envoyée</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sorted.map((r, i) => {
            const badge = RELANCE_BADGE[r.type] || RELANCE_BADGE.anticipation;
            const isSent = r.statut === 'sent';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 8, fontWeight: 600, fontSize: 11,
                  background: badge.bg, color: badge.color, whiteSpace: 'nowrap',
                }}>
                  {badge.emoji} {badge.label}
                </span>
                <span style={{ color: '#94a3b8' }}>
                  Envoyé le {formatDate(r.date_envoi)}
                </span>
                <span style={{ color: isSent ? '#10b981' : '#E24B4A', fontWeight: 700, fontSize: 13 }}>
                  {isSent ? '✓' : '✗'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FicheEleve({ invitee, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [lightbox, setLightbox] = useState(null);

  if (!invitee) return null;

  if (!invitee.form_rempli) {
    return (
      <div className="fiche-eleve-wrapper">
        <div className="fiche-eleve-header" onClick={() => setOpen(!open)}>
          <span className="fiche-eleve-title">
            <FileText size={13} />
            Fiche élève
          </span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
        {open && (
          <>
            <div className="fiche-eleve-alert">
              <AlertTriangle size={14} />
              Formulaire non rempli — Relance nécessaire
            </div>
            <div style={{ padding: '0 12px 12px' }}>
              <RelancesSMS relances={invitee.relances} nbRelances={invitee.nb_relances} />
            </div>
          </>
        )}
      </div>
    );
  }

  const nStyle = getNiveauStyle(invitee);
  const isJamais = nStyle.label === 'Jamais conduit';

  return (
    <div className="fiche-eleve-wrapper">
      <div className="fiche-eleve-header" onClick={() => setOpen(!open)}>
        <span className="fiche-eleve-title">
          <FileText size={13} />
          Fiche élève
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {open && (
        <div className="fiche-eleve-body">
          {invitee.photo_identite && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <Avatar name={invitee.name} photoUrl={invitee.photo_identite} size={80} />
            </div>
          )}
          <div className="fiche-eleve-grid">
            <div className="fiche-eleve-field">
              <div className="label">NEPH</div>
              <div className="value">{invitee.neph || 'Non renseigné'}</div>
            </div>
            <div className="fiche-eleve-field">
              <div className="label">Permis B obtenu le</div>
              <div className="value">{invitee.date_obtention_permis_b ? formatDate(invitee.date_obtention_permis_b) : 'Non renseigné'}</div>
            </div>
            <div className="fiche-eleve-field">
              <div className="label">Niveau scooter</div>
              <div className="value">
                <span className="fiche-niveau-badge" style={{ background: nStyle.badgeBg, color: nStyle.badgeColor }}>
                  {nStyle.label}
                </span>
              </div>
            </div>
            <div className="fiche-eleve-field">
              <div className="label">Déjà conduit</div>
              <div className="value">
                {isJamais
                  ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>Non</span>
                  : nStyle.label === 'Formulaire manquant'
                    ? 'Non renseigné'
                    : <span style={{ color: 'var(--green)', fontWeight: 600 }}>Oui</span>}
              </div>
            </div>
            <div className="fiche-eleve-field">
              <div className="label">Source</div>
              <div className="value">{invitee.source_acquisition || 'Non renseigné'}</div>
            </div>
            <div className="fiche-eleve-field">
              <div className="label">Raison réservation</div>
              <div className="value">{invitee.raison_reservation || 'Non renseigné'}</div>
            </div>
            {invitee.reserve_samedi === 'Oui' && (
              <>
                <div className="fiche-eleve-field">
                  <div className="label">Accompagnement</div>
                  <div className="value">
                    {invitee.avec_un_proche === 'Oui'
                      ? <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, fontWeight: 500, background: 'rgba(108,99,255,0.15)', color: '#a5b4fc' }}>Vient avec un proche</span>
                      : invitee.avec_un_proche === 'Non'
                        ? <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, fontWeight: 500, background: 'rgba(71,85,105,0.1)', color: '#64748b' }}>Vient seul·e</span>
                        : 'Non renseigné'}
                  </div>
                </div>
                {invitee.avec_un_proche === 'Oui' && (
                  <div className="fiche-eleve-field">
                    <div className="label">Accompagnant</div>
                    <div className="value">{invitee.accompagnant_nom_complet || <span style={{ color: '#64748b' }}>—</span>}</div>
                  </div>
                )}
              </>
            )}
            {invitee.occasions_conduite && (
              <div className="fiche-eleve-field">
                <div className="label">Occasions de conduite</div>
                <div className="value">{invitee.occasions_conduite}</div>
              </div>
            )}
            {invitee.derniere_conduite && (
              <div className="fiche-eleve-field">
                <div className="label">Dernière conduite</div>
                <div className="value">{formatDate(invitee.derniere_conduite)}</div>
              </div>
            )}
            {invitee.creneau_prefere && (
              <div className="fiche-eleve-field">
                <div className="label">Créneau préféré</div>
                <div className="value">{invitee.creneau_prefere}</div>
              </div>
            )}
            {invitee.temps_trajet && (
              <div className="fiche-eleve-field">
                <div className="label">Temps de trajet</div>
                <div className="value">{invitee.temps_trajet}</div>
              </div>
            )}
          </div>

          {invitee.commentaires && (
            <div className="fiche-eleve-commentaires">
              <div className="label">Commentaires</div>
              <div className="value">{invitee.commentaires}</div>
            </div>
          )}

          <div className="fiche-eleve-docs">
            <div className="label" style={{ marginBottom: 6 }}>Documents</div>
            <div className="fiche-docs-row">
              <DocBadge label="Permis recto" url={invitee.photo_permis_recto} onView={() => setLightbox({ url: invitee.photo_permis_recto, label: 'Permis recto' })} />
              <DocBadge label="Permis verso" url={invitee.photo_permis_verso} onView={() => setLightbox({ url: invitee.photo_permis_verso, label: 'Permis verso' })} />
              <DocBadge label="Photo ID" url={invitee.photo_identite} onView={() => setLightbox({ url: invitee.photo_identite, label: 'Photo ID' })} />
              <DocBadge label="Signature" url={invitee.photo_signature} onView={() => setLightbox({ url: invitee.photo_signature, label: 'Signature' })} />
            </div>
          </div>

          <RelancesSMS relances={invitee.relances} nbRelances={invitee.nb_relances} />
        </div>
      )}
      {lightbox && <Lightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />}
    </div>
  );
}
