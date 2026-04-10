import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, AlertTriangle, Pencil, MessageSquare, X, Copy } from 'lucide-react';
import Avatar from './Avatar';
import { getNiveauStyle, getNiveauLabel, getNiveauScore, repartirGroupes, fetchGroupes, saveGroupes, MAX_PAR_GROUPE, MAX_VOITURE, computeSatisfaction, fetchConfig, genererMessageSMS } from '../utils';
import useIsMobile from '../hooks/useIsMobile';

const CRENEAU_DOT = {
  matin: { color: '#378ADD', title: 'Préfère le matin' },
  aprem: { color: '#E24B4A', title: 'Préfère l\'après-midi' },
  indif: { color: '#475569', title: 'Pas de préférence' },
};

function getCreneauType(pref) {
  if (!pref) return 'indif';
  if (pref.includes('après-midi') || pref.includes('13h') || pref.includes('15h')) return 'aprem';
  if (pref.includes('matin') || pref.includes('8h') || pref.includes('10h') || pref.includes('12h')) return 'matin';
  return 'indif';
}

function getValidationErrors(groupes) {
  const errors = [];
  groupes.forEach(g => {
    if (g.membres.length > MAX_PAR_GROUPE) {
      errors.push({ type: 'error', groupe: g.numero, msg: `Groupe ${g.numero} dépasse ${MAX_PAR_GROUPE} élèves (${g.membres.length})` });
    }
    const scooterCount = g.membres.filter(m => m.role === 'scooter').length;
    const voitureCount = g.membres.filter(m => m.role === 'voiture').length;
    if (scooterCount > 3) {
      errors.push({ type: 'warn', groupe: g.numero, msg: `Groupe ${g.numero} : ${scooterCount} scooters (max 3)` });
    }
    if (voitureCount > MAX_VOITURE) {
      errors.push({ type: 'warn', groupe: g.numero, msg: `Groupe ${g.numero} : ${voitureCount} élèves en voiture (max ${MAX_VOITURE})` });
    }
    g.membres.forEach(m => {
      const label = getNiveauLabel(m);
      if (m.role === 'scooter' && (label === 'Jamais conduit' || label === 'Formulaire manquant')) {
        errors.push({ type: 'error', groupe: g.numero, msg: `${m.name || m.email} ne peut pas être en scooter (${label})` });
      }
    });
  });
  return errors;
}

const CSS = `
.groupes-container { display: flex; gap: 16px; flex-wrap: wrap; }
.groupe-col { flex: 1; min-width: 280px; background: #12172a; border-radius: 10px; border: 1px solid #1e2640; overflow: hidden; }
.groupe-header { padding: 14px 16px; background: #1a1f30; border-bottom: 1px solid #1e2640; }
.groupe-header-title { font-size: 15px; font-weight: 700; color: #e2e8f0; display: flex; align-items: center; gap: 8px; }
.groupe-header-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
.groupe-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; padding: 8px 16px 4px; color: #64748b; }
.groupe-membre { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid #1e2640; transition: background 0.12s; }
.groupe-membre:hover { background: #1e2640; }
.groupe-membre-info { flex: 1; min-width: 0; }
.groupe-membre-name { font-size: 13px; font-weight: 600; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
.groupe-membre-niveau { font-size: 11px; }
.groupe-membre-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.groupe-membre:hover .groupe-membre-actions { opacity: 1; }
.groupe-btn-sm { font-size: 10px; padding: 3px 8px; border-radius: 5px; border: none; cursor: pointer; font-weight: 600; white-space: nowrap; }
.groupes-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.groupes-toolbar button { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: none; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.15s, opacity 0.15s; }
.groupes-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
.groupes-alert { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; margin-bottom: 8px; }
.groupes-alert.error { background: rgba(226,75,74,0.12); color: #E24B4A; }
.groupes-alert.warn { background: rgba(245,158,11,0.12); color: #f59e0b; }
.groupes-alert.success { background: rgba(16,185,129,0.12); color: #10b981; }
.creneau-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
@media (max-width: 768px) {
  .groupes-container { flex-direction: column; }
  .groupe-membre-actions { opacity: 1; }
}
`;

function formatTimeAgo(ts, now) {
  const sec = Math.floor((now - ts) / 1000);
  if (sec < 10) return "à l'instant";
  if (sec < 60) return `il y a ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return `il y a ${h} h`;
}

export default function GroupesPanel({ session }) {
  const invitees = session.invitees || [];
  const eventUuid = session.id;
  const dateFormation = session.start_time ? session.start_time.split('T')[0] : null;
  const isMobile = useIsMobile();

  const [groupes, setGroupes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [config, setConfig] = useState(null);
  const [showSMS, setShowSMS] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(null);

  // Tick every 30s so the "il y a X" label stays fresh
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  // Load f125_config (adresse, téléphone, horaires…)
  useEffect(() => {
    let cancelled = false;
    fetchConfig()
      .then(c => { if (!cancelled) setConfig(c); })
      .catch(e => console.error('Erreur chargement config:', e));
    return () => { cancelled = true; };
  }, []);

  // Load existing groups from DB. If rows already exist for this event,
  // display them directly (do NOT re-run the algorithm).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchGroupes(eventUuid);
        if (cancelled) return;
        if (rows.length > 0) {
          // Rebuild groupes from DB rows, merging with invitee data
          const groupeMap = {};
          rows.forEach(r => {
            if (!groupeMap[r.groupe_numero]) {
              groupeMap[r.groupe_numero] = { numero: r.groupe_numero, heure: r.heure_debut, membres: [] };
            }
            const inv = invitees.find(i => i.email === r.email) || { name: r.email, email: r.email };
            groupeMap[r.groupe_numero].membres.push({
              ...inv,
              role: r.role,
              modifie_manuellement: r.modifie_manuellement || false,
              ordre_passage: r.ordre_passage,
              note: r.note || '',
            });
          });
          setGroupes(Object.values(groupeMap).sort((a, b) => a.numero - b.numero));
          // Consider loaded rows as "already saved"
          setLastSavedAt(Date.now());
        }
      } catch (e) {
        console.error('Erreur chargement groupes:', e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [eventUuid]);

  // Persist a given groupes snapshot to Supabase. Used by every mutation
  // (generate, manual swap, role toggle, reset) so the DB is always in sync.
  const persistGroupes = useCallback(async (nextGroupes) => {
    if (!nextGroupes || !dateFormation) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveGroupes(eventUuid, dateFormation, nextGroupes);
      setLastSavedAt(Date.now());
    } catch (e) {
      console.error('Erreur sauvegarde:', e);
      setSaveError(e.message || String(e));
    }
    setSaving(false);
  }, [eventUuid, dateFormation]);

  const generer = useCallback(() => {
    const result = repartirGroupes(invitees);
    setGroupes(result);
    void persistGroupes(result);
  }, [invitees, persistGroupes]);

  const sauvegarder = useCallback(() => {
    if (groupes) void persistGroupes(groupes);
  }, [groupes, persistGroupes]);

  const resetGroupe = useCallback((gIdx) => {
    if (!groupes) return;
    const result = repartirGroupes(invitees);
    const next = [...groupes];
    if (result[gIdx]) next[gIdx] = result[gIdx];
    setGroupes(next);
    void persistGroupes(next);
  }, [groupes, invitees, persistGroupes]);

  const moveToGroupe = useCallback((fromG, memIdx, toG) => {
    if (!groupes) return;
    const next = groupes.map(g => ({ ...g, membres: [...g.membres] }));
    const [moved] = next[fromG].membres.splice(memIdx, 1);
    moved.modifie_manuellement = true;
    next[toG].membres.push(moved);
    setGroupes(next);
    void persistGroupes(next);
  }, [groupes, persistGroupes]);

  const toggleRole = useCallback((gIdx, memIdx) => {
    if (!groupes) return;
    const next = groupes.map(g => ({ ...g, membres: [...g.membres] }));
    const m = { ...next[gIdx].membres[memIdx] };
    const label = getNiveauLabel(m);
    if (m.role === 'voiture' && (label === 'Jamais conduit' || label === 'Formulaire manquant')) {
      return; // Block: can't put on scooter
    }
    m.role = m.role === 'scooter' ? 'voiture' : 'scooter';
    m.modifie_manuellement = true;
    next[gIdx].membres[memIdx] = m;
    setGroupes(next);
    void persistGroupes(next);
  }, [groupes, persistGroupes]);

  if (loading) {
    return <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>Chargement des groupes...</div>;
  }

  const errors = groupes ? getValidationErrors(groupes) : [];
  const hasBlockers = errors.some(e => e.type === 'error');
  const allValid = groupes && errors.length === 0;
  const satisfaction = groupes && groupes.length >= 2 ? computeSatisfaction(groupes) : null;

  return (
    <div style={{ marginTop: 12 }}>
      <style>{CSS}</style>

      {groupes && (saving || lastSavedAt || saveError) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 6, marginBottom: 12,
          fontSize: 12, fontWeight: 500,
          background: saving ? 'rgba(108,99,255,0.12)' : saveError ? 'rgba(226,75,74,0.12)' : 'rgba(16,185,129,0.12)',
          color: saving ? '#a5b4fc' : saveError ? '#E24B4A' : '#10b981',
        }}>
          {saving
            ? <>⏳ Sauvegarde en cours...</>
            : saveError
              ? <>❌ Erreur de sauvegarde : {saveError}</>
              : <>✅ Groupes sauvegardés — dernière modification {formatTimeAgo(lastSavedAt, nowTick)}</>
          }
        </div>
      )}

      <div className="groupes-toolbar">
        <button
          onClick={generer}
          style={{ background: '#6c63ff', color: '#fff' }}
        >
          <RefreshCw size={13} />
          {groupes ? 'Regénérer' : 'Générer les groupes'}
        </button>
        {groupes && saveError && (
          <button
            onClick={sauvegarder}
            disabled={saving || hasBlockers}
            style={{ background: 'rgba(226,75,74,0.15)', color: '#E24B4A' }}
            title="Réessayer la sauvegarde"
          >
            <Check size={13} />
            Réessayer
          </button>
        )}
        {groupes && (
          <button
            onClick={() => setShowSMS(true)}
            disabled={!config}
            style={{ background: 'rgba(108,99,255,0.15)', color: '#a5b4fc' }}
            title={!config ? 'Chargement de la config…' : 'Voir les SMS à envoyer'}
          >
            <MessageSquare size={13} />
            Voir les SMS
          </button>
        )}
      </div>

      {errors.map((err, i) => (
        <div key={i} className={`groupes-alert ${err.type}`}>
          <AlertTriangle size={13} />
          {err.msg}
        </div>
      ))}
      {allValid && groupes && (
        <div className="groupes-alert success">
          <Check size={13} />
          Tous les groupes sont valides
        </div>
      )}

      {satisfaction && (
        <div style={{
          padding: '10px 14px',
          background: '#12172a',
          border: '1px solid #1e2640',
          borderRadius: 8,
          marginBottom: 12,
          fontSize: 12,
        }}>
          <div style={{ color: '#10b981', fontWeight: 600 }}>
            ✅ Préférences respectées : {satisfaction.respected}/{satisfaction.total} élève{satisfaction.total > 1 ? 's' : ''}
          </div>
          {satisfaction.nonRespected > 0 && (
            <div style={{ color: '#f59e0b', marginTop: 4, fontWeight: 500 }}>
              ⚠️ Non respectées : {satisfaction.nonRespected} ({satisfaction.nonRespectedList.map(x => `${x.name} — préfère ${x.wants}`).join(', ')})
            </div>
          )}
          {satisfaction.nonRespected > 0 && (
            <div style={{ color: '#64748b', marginTop: 4, fontSize: 11 }}>
              Raison : groupe matin au maximum de capacité avec buffer
            </div>
          )}
        </div>
      )}

      {groupes && (
        <div className="groupes-container">
          {groupes.map((g, gIdx) => {
            const scooters = g.membres.filter(m => m.role === 'scooter');
            const voitures = g.membres.filter(m => m.role === 'voiture');
            return (
              <div key={g.numero} className="groupe-col">
                <div className="groupe-header">
                  <div className="groupe-header-title">
                    <span>{g.numero === 1 ? '🕙' : g.numero === 2 ? '🕑' : '🕕'}</span>
                    Groupe {g.numero} — {g.heure}
                  </div>
                  <div className="groupe-header-sub">
                    {g.membres.length} élève{g.membres.length > 1 ? 's' : ''} · {scooters.length} 🛵 · {voitures.length} 🚗
                    <button
                      onClick={() => resetGroupe(gIdx)}
                      className="groupe-btn-sm"
                      style={{ marginLeft: 8, background: 'rgba(107,113,148,0.15)', color: '#94a3b8' }}
                    >
                      Réinitialiser
                    </button>
                  </div>
                  {gIdx === 0 && groupes.length >= 2 && (() => {
                    const free = MAX_PAR_GROUPE - g.membres.length;
                    if (free > 0) {
                      return (
                        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: '#10b981' }}>
                          ✅ {free} place{free > 1 ? 's' : ''} disponible{free > 1 ? 's' : ''}
                        </div>
                      );
                    }
                    if (groupes.length === 2) {
                      return (
                        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>
                          ⚠️ Complet — toute nouvelle réservation nécessitera un 3ème groupe
                        </div>
                      );
                    }
                    return (
                      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>
                        ⚠️ Complet
                      </div>
                    );
                  })()}
                </div>

                {scooters.length > 0 && (
                  <>
                    <div className="groupe-section-label">🛵 Scooters ({scooters.length})</div>
                    {scooters.map((m, mi) => {
                      const realIdx = g.membres.indexOf(m);
                      return renderMembre(m, gIdx, realIdx, groupes.length, moveToGroupe, toggleRole, isMobile);
                    })}
                  </>
                )}

                {voitures.length > 0 && (
                  <>
                    <div className="groupe-section-label">🚗 Voiture ({voitures.length})</div>
                    {voitures.map((m, mi) => {
                      const realIdx = g.membres.indexOf(m);
                      return renderMembre(m, gIdx, realIdx, groupes.length, moveToGroupe, toggleRole, isMobile);
                    })}
                  </>
                )}

                {g.membres.length === 0 && (
                  <div style={{ padding: 16, color: '#475569', fontSize: 12, textAlign: 'center' }}>Aucun élève</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!groupes && (
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
          Cliquez sur "Générer les groupes" pour répartir automatiquement les élèves.
        </div>
      )}

      {showSMS && groupes && config && session.start_time && (
        <div
          onClick={() => setShowSMS(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0e1222', border: '1px solid #1e2640', borderRadius: 12,
              maxWidth: 720, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid #1e2640',
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
                  SMS de convocation
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {groupes.reduce((n, g) => n + g.membres.length, 0)} messages — session du {new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(session.start_time))}
                </div>
              </div>
              <button
                onClick={() => setShowSMS(false)}
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8',
                  cursor: 'pointer', padding: 4, display: 'flex',
                }}
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groupes.flatMap(g => g.membres.map(m => {
                const prenom = (m.name || '').trim().split(/\s+/)[0] || (m.email || '').split('@')[0];
                const msg = genererMessageSMS(prenom, new Date(session.start_time), g.numero, config);
                const key = `${g.numero}-${m.email || m.name}`;
                return (
                  <div key={key} style={{
                    background: '#12172a', border: '1px solid #1e2640', borderRadius: 8, padding: 12,
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      marginBottom: 8,
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.name || m.email}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          Groupe {g.numero} — {g.heure} · {m.phone || 'pas de téléphone'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg);
                          setCopiedEmail(key);
                          setTimeout(() => setCopiedEmail(null), 1500);
                        }}
                        className="groupe-btn-sm"
                        style={{
                          background: copiedEmail === key ? 'rgba(16,185,129,0.2)' : 'rgba(108,99,255,0.15)',
                          color: copiedEmail === key ? '#10b981' : '#a5b4fc',
                          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                        }}
                      >
                        {copiedEmail === key ? <Check size={11} /> : <Copy size={11} />}
                        {copiedEmail === key ? 'Copié' : 'Copier'}
                      </button>
                    </div>
                    <div style={{
                      fontSize: 12, color: '#cbd5e1', lineHeight: 1.5,
                      background: '#0e1222', border: '1px solid #1e2640', borderRadius: 6, padding: 10,
                      fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap',
                    }}>
                      {msg}
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderMembre(m, gIdx, memIdx, nbGroupes, moveToGroupe, toggleRole, isMobile) {
  const nStyle = getNiveauStyle(m);
  const label = nStyle.label;
  const crType = getCreneauType(m.creneau_prefere);
  const dot = CRENEAU_DOT[crType];
  const canToggleScooter = !(m.role === 'voiture' && (label === 'Jamais conduit' || label === 'Formulaire manquant'));

  return (
    <div
      key={m.email || m.name}
      className="groupe-membre"
      style={{ borderLeft: `3px solid ${nStyle.borderColor}` }}
    >
      <Avatar name={m.name} photoUrl={m.photo_identite} size={28} />
      <div className="groupe-membre-info">
        <div className="groupe-membre-name">
          {m.name || m.email || '—'}
          {m.modifie_manuellement && <Pencil size={10} style={{ color: '#f59e0b', flexShrink: 0 }} title="Modification manuelle" />}
          <span className="creneau-dot" style={{ background: dot.color }} title={dot.title} />
        </div>
        <span className="groupe-membre-niveau" style={{ color: nStyle.badgeColor }}>
          {label}
        </span>
      </div>
      <div className="groupe-membre-actions">
        <button
          className="groupe-btn-sm"
          onClick={() => toggleRole(gIdx, memIdx)}
          disabled={!canToggleScooter && m.role === 'voiture'}
          style={{
            background: m.role === 'scooter' ? 'rgba(226,75,74,0.15)' : 'rgba(16,185,129,0.15)',
            color: m.role === 'scooter' ? '#E24B4A' : '#10b981',
          }}
          title={m.role === 'scooter' ? 'Passer en voiture' : 'Passer en scooter'}
        >
          {m.role === 'scooter' ? '🛵→🚗' : '🚗→🛵'}
        </button>
        {nbGroupes > 1 && Array.from({ length: nbGroupes }, (_, i) => i).filter(i => i !== gIdx).map(targetG => (
          <button
            key={targetG}
            className="groupe-btn-sm"
            onClick={() => moveToGroupe(gIdx, memIdx, targetG)}
            style={{ background: 'rgba(108,99,255,0.15)', color: '#a5b4fc' }}
            title={`Déplacer vers Groupe ${targetG + 1}`}
          >
            → G{targetG + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
