import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Check, AlertTriangle, Pencil, MessageSquare, Send, CheckCircle, Plus, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import SmsModal from './SmsModal';
import SmsHistorique from './SmsHistorique';
import { getNiveauStyle, getNiveauLabel, repartirGroupes, fetchGroupes, fetchGroupesMeta, saveGroupes, heureForGroupe, MAX_PAR_GROUPE, MAX_SCOOTERS, computeSatisfaction, fetchConfig, toE164, fetchSMSHistory, formatName } from '../utils';
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
    const cap = g.capacite ?? MAX_PAR_GROUPE;
    // Capacity is a SOFT limit: a manual move may exceed it → warn, never block.
    if (g.membres.length > cap) {
      errors.push({ type: 'warn', groupe: g.numero, msg: `Groupe ${g.numero} : capacité dépassée (${g.membres.length}/${cap})` });
    }
    const scooterCount = g.membres.filter(m => m.role === 'scooter').length;
    // Physical PCX scooters available per session — real constraint.
    if (scooterCount > MAX_SCOOTERS) {
      errors.push({ type: 'warn', groupe: g.numero, msg: `Groupe ${g.numero} : ${scooterCount} scooters (max ${MAX_SCOOTERS})` });
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
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }
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
  const [smsHistory, setSmsHistory] = useState({});
  const [smsModalGroupe, setSmsModalGroupe] = useState(null);

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

  useEffect(() => {
    let cancelled = false;
    fetchSMSHistory(eventUuid)
      .then(rows => {
        if (cancelled) return;
        const map = {};
        rows.forEach(r => {
          const key = toE164(r.telephone) || r.telephone;
          if (!map[key]) map[key] = [];
          map[key].push(r);
        });
        setSmsHistory(map);
      })
      .catch(e => console.error('Erreur chargement historique SMS:', e));
    return () => { cancelled = true; };
  }, [eventUuid]);

  const refreshSmsHistory = useCallback(async () => {
    try {
      const rows = await fetchSMSHistory(eventUuid);
      const map = {};
      rows.forEach(r => {
        const key = toE164(r.telephone) || r.telephone;
        if (!map[key]) map[key] = [];
        map[key].push(r);
      });
      setSmsHistory(map);
    } catch (e) {
      console.error('Erreur refresh historique SMS:', e);
    }
  }, [eventUuid]);

  // Load existing groups from DB. If data already exists for this event,
  // display it directly (do NOT re-run the algorithm). Metadata carries the
  // editable heure/capacité and lets empty groups exist; member rows fill them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rows, meta] = await Promise.all([
          fetchGroupes(eventUuid),
          fetchGroupesMeta(eventUuid),
        ]);
        if (cancelled) return;
        if (rows.length > 0 || meta.length > 0) {
          const groupeMap = {};
          // Seed groups from metadata (allows empty groups + real heure/capacité)
          meta.forEach(mt => {
            groupeMap[mt.numero] = {
              numero: mt.numero,
              heure: (mt.heure || '').slice(0, 5),
              capacite: mt.capacite ?? MAX_PAR_GROUPE,
              membres: [],
            };
          });
          // Attach members; synthesize a group from legacy rows lacking metadata
          rows.forEach(r => {
            if (!groupeMap[r.groupe_numero]) {
              groupeMap[r.groupe_numero] = {
                numero: r.groupe_numero,
                heure: (r.heure_debut || '').slice(0, 5),
                capacite: MAX_PAR_GROUPE,
                membres: [],
              };
            }
            const inv = invitees.find(i => i.email === r.email) || { name: r.email, email: r.email };
            groupeMap[r.groupe_numero].membres.push({
              ...inv,
              role: r.role,
              modifie_manuellement: r.modifie_manuellement || false,
              ordre_passage: r.ordre_passage,
              note: r.note || '',
              creneau_prefere: inv.creneau_prefere || r.preference_creneau || null,
            });
          });
          setGroupes(Object.values(groupeMap).sort((a, b) => a.numero - b.numero));
          // Consider loaded data as "already saved"
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

  // Default parameters injected into the (pure) algorithm. Single source of
  // truth = f125_config; constants in utils.js only act as fallback.
  const algoDefaults = useMemo(() => {
    const heures = [config?.heure_groupe_1, config?.heure_groupe_2, config?.heure_groupe_3]
      .filter(Boolean)
      .map(h => String(h).slice(0, 5));
    return {
      maxParGroupe: parseInt(config?.max_eleves_par_groupe, 10) || MAX_PAR_GROUPE,
      maxScooters: parseInt(config?.max_scooters, 10) || MAX_SCOOTERS,
      heuresDefaut: heures.length ? heures : undefined,
    };
  }, [config]);

  // EXPLICIT (re)generation: recomputes a default split and OVERWRITES manual
  // edits. Confirmation required when groups already hold students.
  const generer = useCallback(() => {
    const hasExisting = groupes && groupes.some(g => g.membres.length > 0);
    if (hasExisting && !window.confirm(
      'Regénérer recalcule une répartition par défaut et écrase les ajustements manuels (heures, capacités, déplacements, groupes ajoutés). Continuer ?'
    )) return;
    const result = repartirGroupes(invitees, algoDefaults);
    setGroupes(result);
    void persistGroupes(result);
  }, [invitees, algoDefaults, groupes, persistGroupes]);

  const sauvegarder = useCallback(() => {
    if (groupes) void persistGroupes(groupes);
  }, [groupes, persistGroupes]);

  const openSmsModal = useCallback((gIdx) => {
    if (!groupes || !groupes[gIdx]) return;
    setSmsModalGroupe(groupes[gIdx]);
  }, [groupes]);

  const openSmsModalForMember = useCallback((membre, gIdx) => {
    if (!groupes || !groupes[gIdx]) return;
    setSmsModalGroupe({ ...groupes[gIdx], membres: [membre] });
  }, [groupes]);

  // Routine edit — change a group's start time, persisted. All readers
  // (display + SMS) use this real value, never the config default.
  const setHeureGroupe = useCallback((gIdx, heure) => {
    if (!groupes || !heure) return;
    const next = groupes.map((g, i) => (i === gIdx ? { ...g, heure } : g));
    setGroupes(next);
    void persistGroupes(next);
  }, [groupes, persistGroupes]);

  // Routine edit — change a group's capacity (soft limit), persisted.
  const setCapaciteGroupe = useCallback((gIdx, raw) => {
    if (!groupes) return;
    const capacite = Math.max(1, parseInt(raw, 10) || 1);
    const next = groupes.map((g, i) => (i === gIdx ? { ...g, capacite } : g));
    setGroupes(next);
    void persistGroupes(next);
  }, [groupes, persistGroupes]);

  // Add a (possibly empty) group with default heure + capacity, no cap on count.
  const addGroupe = useCallback(() => {
    const base = groupes || [];
    const numero = base.length + 1;
    const newG = {
      numero,
      heure: heureForGroupe(numero - 1, algoDefaults.heuresDefaut),
      capacite: algoDefaults.maxParGroupe,
      membres: [],
    };
    const next = [...base, newG];
    setGroupes(next);
    void persistGroupes(next);
  }, [groupes, algoDefaults, persistGroupes]);

  // Delete a group — blocked while it still holds students (safety). The UI
  // disables the button in that case; this guard is a belt-and-braces check.
  // Remaining groups are renumbered contiguously (1..k).
  const deleteGroupe = useCallback((gIdx) => {
    if (!groupes || groupes[gIdx].membres.length > 0) return;
    const next = groupes
      .filter((_, i) => i !== gIdx)
      .map((g, i) => ({ ...g, numero: i + 1 }));
    setGroupes(next);
    void persistGroupes(next);
  }, [groupes, persistGroupes]);

  const moveToGroupe = useCallback((fromG, memIdx, toG) => {
    if (!groupes) return;
    const next = groupes.map(g => ({ ...g, membres: [...g.membres] }));
    const [moved] = next[fromG].membres.splice(memIdx, 1);
    moved.modifie_manuellement = true;
    next[toG].membres.push(moved); // soft limit: overflow allowed, surfaced by badge
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
        {groupes && (
          <button
            onClick={addGroupe}
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
            title="Ajouter un groupe vide"
          >
            <Plus size={13} />
            Ajouter un groupe
          </button>
        )}
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
            const cap = g.capacite ?? MAX_PAR_GROUPE;
            const over = g.membres.length > cap;
            const empty = g.membres.length === 0;
            return (
              <div key={g.numero} className="groupe-col">
                <div className="groupe-header">
                  <div className="groupe-header-title">
                    <span>{g.numero === 1 ? '🕙' : g.numero === 2 ? '🕑' : '🕕'}</span>
                    Groupe {g.numero}
                    <input
                      type="time"
                      value={g.heure || ''}
                      onChange={(e) => setHeureGroupe(gIdx, e.target.value)}
                      title="Heure de début du groupe"
                      style={{
                        marginLeft: 6, background: '#0e1222', border: '1px solid #1e2640',
                        borderRadius: 6, color: '#e2e8f0', fontSize: 13, padding: '2px 6px',
                        fontWeight: 600, colorScheme: 'dark',
                      }}
                    />
                    <button
                      onClick={() => deleteGroupe(gIdx)}
                      className="groupe-btn-sm"
                      disabled={!empty}
                      title={empty ? 'Supprimer ce groupe' : 'Déplacez d\'abord les élèves'}
                      style={{
                        marginLeft: 'auto', background: 'rgba(226,75,74,0.12)', color: '#E24B4A',
                        display: 'inline-flex', alignItems: 'center',
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div className="groupe-header-sub" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>{g.membres.length} élève{g.membres.length > 1 ? 's' : ''} · {scooters.length} 🛵 · {voitures.length} 🚗</span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
                      Capacité
                      <input
                        type="number"
                        min={1}
                        value={cap}
                        onChange={(e) => setCapaciteGroupe(gIdx, e.target.value)}
                        title="Capacité du groupe (limite souple)"
                        style={{
                          width: 44, background: '#0e1222', border: '1px solid #1e2640',
                          borderRadius: 6, color: '#e2e8f0', fontSize: 12, padding: '2px 6px',
                          colorScheme: 'dark',
                        }}
                      />
                    </label>
                    <button
                      onClick={() => openSmsModal(gIdx)}
                      className="groupe-btn-sm"
                      disabled={!config || empty}
                      style={{ background: 'rgba(108,99,255,0.15)', color: '#a5b4fc' }}
                      title="Envoyer les SMS à tout le groupe"
                    >
                      <Send size={10} /> SMS
                    </button>
                  </div>
                  {over ? (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>
                      ⚠️ Dépassement — {g.membres.length}/{cap} (limite souple)
                    </div>
                  ) : g.membres.length < cap ? (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: '#10b981' }}>
                      ✅ {cap - g.membres.length} place{cap - g.membres.length > 1 ? 's' : ''} disponible{cap - g.membres.length > 1 ? 's' : ''}
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                      Complet ({cap}/{cap})
                    </div>
                  )}
                </div>

                {scooters.length > 0 && (
                  <>
                    <div className="groupe-section-label">🛵 Scooters ({scooters.length})</div>
                    {scooters.map((m, mi) => {
                      const realIdx = g.membres.indexOf(m);
                      return renderMembre(m, gIdx, realIdx, groupes.length, moveToGroupe, toggleRole, isMobile, { history: smsHistory, onSend: openSmsModalForMember });
                    })}
                  </>
                )}

                {voitures.length > 0 && (
                  <>
                    <div className="groupe-section-label">🚗 Voiture ({voitures.length})</div>
                    {voitures.map((m, mi) => {
                      const realIdx = g.membres.indexOf(m);
                      return renderMembre(m, gIdx, realIdx, groupes.length, moveToGroupe, toggleRole, isMobile, { history: smsHistory, onSend: openSmsModalForMember });
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

      <SmsModal
        open={!!smsModalGroupe}
        onClose={() => setSmsModalGroupe(null)}
        groupe={smsModalGroupe}
        session={session}
        config={config}
        smsHistory={smsHistory}
        onSmsSent={refreshSmsHistory}
      />

      {groupes && <SmsHistorique eventUuid={eventUuid} />}
    </div>
  );
}

function renderMembre(m, gIdx, memIdx, nbGroupes, moveToGroupe, toggleRole, isMobile, smsCtx) {
  const nStyle = getNiveauStyle(m);
  const label = nStyle.label;
  const crType = getCreneauType(m.creneau_prefere);
  const dot = CRENEAU_DOT[crType];
  const canToggleScooter = !(m.role === 'voiture' && (label === 'Jamais conduit' || label === 'Formulaire manquant'));
  const isMismatched = (crType === 'matin' && gIdx !== 0) || (crType === 'aprem' && gIdx === 0);

  return (
    <div
      key={m.email || m.name}
      className="groupe-membre"
      style={{ borderLeft: `3px solid ${nStyle.borderColor}` }}
    >
      <Avatar name={m.name} photoUrl={m.photo_identite} size={28} />
      <div className="groupe-membre-info">
        <div className="groupe-membre-name">
          {formatName(m.name) !== '—' ? formatName(m.name) : (m.email || '—')}
          {m.modifie_manuellement && <Pencil size={10} style={{ color: '#f59e0b', flexShrink: 0 }} title="Modification manuelle" />}
          <span className="creneau-dot" style={{ background: dot.color }} title={dot.title} />
        </div>
        <span className="groupe-membre-niveau" style={{ color: nStyle.badgeColor }}>
          {label}
        </span>
        {m.creneau_prefere && (
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 8, fontWeight: 600, marginTop: 2,
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: isMismatched ? 'rgba(245,158,11,0.15)' : 'rgba(71,85,105,0.1)',
            color: isMismatched ? '#f59e0b' : '#64748b',
          }}>
            {isMismatched && '⚠️ '}{crType === 'matin' ? 'Matin' : crType === 'aprem' ? 'Après-midi' : 'Indifférent'}
          </span>
        )}
      </div>
      <div className="groupe-membre-actions">
        {smsCtx && (() => {
          const phoneKey = toE164(m.phone);
          const hasSent = (phoneKey && smsCtx.history[phoneKey]?.some(s => s.statut === 'sent')) || false;
          const validPhone = m.phone && toE164(m.phone);
          return (
            <button
              className="groupe-btn-sm"
              onClick={(e) => { e.stopPropagation(); smsCtx.onSend(m, gIdx); }}
              disabled={!validPhone}
              style={{
                background: hasSent ? 'rgba(16,185,129,0.15)' : 'rgba(108,99,255,0.15)',
                color: hasSent ? '#10b981' : '#a5b4fc',
              }}
              title={!validPhone ? 'Pas de téléphone valide' : hasSent ? 'SMS déjà envoyé — renvoyer' : 'Envoyer le SMS'}
            >
              {hasSent ? <CheckCircle size={10} /> : <MessageSquare size={10} />}
            </button>
          );
        })()}
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
