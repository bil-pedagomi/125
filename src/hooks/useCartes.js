import { useState, useCallback, useRef } from 'react';
import { setCarteFaite } from '../utils';

// État partagé « carte 125 faite » pour les inscriptions d'une session.
// Keyé par invitee_uuid. Un seul useCartes par session (monté dans le panneau
// de détail) alimente à la fois la vue Liste, la vue Groupes et le compteur
// d'entête — les trois restent ainsi cohérents.
//
// toggle(invitee) :
//   1. bascule immédiatement l'état local (mise à jour optimiste)
//   2. POST vers carte-125-set
//   3. en cas d'erreur → revert + message d'erreur discret (auto-effacé)
// Le bouton en vol est marqué « pending » pour bloquer les double-clics.
export default function useCartes(invitees) {
  const [faites, setFaites] = useState(() => {
    const m = {};
    (invitees || []).forEach(inv => {
      if (inv && inv.invitee_uuid != null) m[inv.invitee_uuid] = !!inv.carte_faite;
    });
    return m;
  });
  const [pending, setPending] = useState({});
  const [error, setError] = useState(null);

  // Verrou synchrone anti double-clic (setPending est asynchrone).
  const inFlight = useRef({});
  const errorTimer = useRef(null);

  const flashError = useCallback((msg) => {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 4000);
  }, []);

  const toggle = useCallback((invitee) => {
    const uuid = invitee?.invitee_uuid;
    if (uuid == null || inFlight.current[uuid]) return;

    const next = !faites[uuid];
    inFlight.current[uuid] = true;
    setPending(p => ({ ...p, [uuid]: true }));
    setFaites(f => ({ ...f, [uuid]: next })); // optimiste
    setError(null);

    setCarteFaite(invitee, next)
      .catch(e => {
        setFaites(f => ({ ...f, [uuid]: !next })); // revert
        flashError(e?.message || 'Erreur enregistrement carte');
      })
      .finally(() => {
        inFlight.current[uuid] = false;
        setPending(p => {
          const n = { ...p };
          delete n[uuid];
          return n;
        });
      });
  }, [faites, flashError]);

  return { faites, pending, error, toggle };
}
