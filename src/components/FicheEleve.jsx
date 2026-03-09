import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, ExternalLink, AlertTriangle } from 'lucide-react';
import Avatar from './Avatar';
import { formatDate } from '../utils';

const NIVEAU_COLORS = {
  'Débutant': { bg: 'var(--red-bg)', color: 'var(--red)' },
  'Intermédiaire': { bg: 'var(--orange-bg)', color: 'var(--orange)' },
  'Avancé': { bg: 'rgba(96, 165, 250, 0.15)', color: 'var(--blue)' },
  'Expert': { bg: 'var(--green-bg)', color: 'var(--green)' },
};

function DocBadge({ label, url }) {
  const exists = !!url;
  return (
    <a
      href={exists ? url : undefined}
      target={exists ? '_blank' : undefined}
      rel="noopener noreferrer"
      className={`doc-badge ${exists ? 'doc-badge-ok' : 'doc-badge-missing'}`}
      style={{ pointerEvents: exists ? 'auto' : 'none' }}
    >
      <ExternalLink size={10} />
      {label}
    </a>
  );
}

export default function FicheEleve({ invitee, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

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

  const niveauStyle = NIVEAU_COLORS[invitee.niveau_scooter] || { bg: 'rgba(107,113,148,0.15)', color: 'var(--text-muted)' };

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
                <span className="fiche-niveau-badge" style={{ background: niveauStyle.bg, color: niveauStyle.color }}>
                  {invitee.niveau_scooter || 'Non renseigné'}
                </span>
              </div>
            </div>
            <div className="fiche-eleve-field">
              <div className="label">Déjà conduit</div>
              <div className="value">
                {invitee.deja_conduit === 1
                  ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Oui</span>
                  : invitee.deja_conduit === 0
                    ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>Non</span>
                    : 'Non renseigné'}
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
              <DocBadge label="Permis recto" url={invitee.photo_permis_recto} />
              <DocBadge label="Permis verso" url={invitee.photo_permis_verso} />
              <DocBadge label="Photo ID" url={invitee.photo_identite} />
              <DocBadge label="Signature" url={invitee.photo_signature} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
