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
          <div className="fiche-eleve-alert">
            <AlertTriangle size={14} />
            Formulaire non rempli — Relance nécessaire
          </div>
        )}
      </div>
    );
  }

  const nStyle = getNiveauStyle(invitee);
  const rawDeja = invitee.deja_conduit;
  const dejaCon = (rawDeja === null || rawDeja === undefined) ? null : Number(rawDeja);

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
                {dejaCon === null
                  ? 'Non renseigné'
                  : dejaCon === 1
                    ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Oui</span>
                    : <span style={{ color: 'var(--red)', fontWeight: 600 }}>Non</span>}
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
        </div>
      )}
      {lightbox && <Lightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />}
    </div>
  );
}
