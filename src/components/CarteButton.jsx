import { Check, Loader2 } from 'lucide-react';

// Bouton on/off compact « Carte 125 faite ».
//   ON  → « Carte faite » + coche, style vert (cohérent avec le badge « OK »).
//   OFF → « À faire », style neutre-gris (cohérent avec « Manquant »).
// Désactivé pendant la requête en vol (pending) pour éviter les double-clics.
// stopPropagation : la ligne parente (vue Liste) est cliquable pour ouvrir la
// fiche — le clic sur le bouton ne doit pas la déclencher.
export default function CarteButton({ faite, pending, onToggle }) {
  return (
    <button
      type="button"
      className={`carte-btn ${faite ? 'faite' : 'todo'}`}
      disabled={pending}
      aria-pressed={faite}
      title={faite
        ? 'Carte 125 faite — cliquer pour marquer « à faire »'
        : 'Carte 125 à faire — cliquer pour marquer « faite »'}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      {pending
        ? <Loader2 size={12} className="carte-btn-spin" />
        : faite
          ? <Check size={12} />
          : null}
      <span>{faite ? 'Carte faite' : 'À faire'}</span>
    </button>
  );
}
