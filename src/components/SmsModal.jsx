import { useState, useEffect, useMemo } from 'react';
import { X, Send, Save, Loader, Check, AlertTriangle } from 'lucide-react';
import { toE164, genererMessageFromTemplate, sendSMSViaEdgeFunction, saveSmsTemplate, formatHeureSms } from '../utils';

// Canonical SMS template key. The two legacy per-group templates are unified
// into this single hour-agnostic base ({horaire} injects the real hour), so
// template selection is independent of the (chronologically renumbered) group.
const SMS_TEMPLATE_KEY = 'sms_template_groupe_1';

function countSms(len) {
  if (len <= 160) return 1;
  if (len <= 306) return 2;
  return Math.ceil(len / 153);
}

const CSS = `
.sms-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.sms-modal { background: #0e1222; border: 1px solid #1e2640; border-radius: 12px; max-width: 720px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; }
.sms-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #1e2640; }
.sms-modal-body { overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
.sms-dest-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 13px; }
.sms-dest-row label { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; cursor: pointer; color: #e2e8f0; }
.sms-dest-row.disabled label { color: #475569; cursor: not-allowed; }
.sms-dest-phone { font-size: 11px; color: #64748b; flex-shrink: 0; }
.sms-dest-phone.valid { color: #10b981; }
.sms-dest-phone.fixe { color: #f59e0b; }
.sms-textarea { width: 100%; min-height: 100px; background: #12172a; border: 1px solid #1e2640; border-radius: 8px; color: #e2e8f0; padding: 12px; font-size: 13px; font-family: 'JetBrains Mono', monospace; resize: vertical; outline: none; }
.sms-textarea:focus { border-color: #6c63ff; }
.sms-counter { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
.sms-counter.warn { color: #f59e0b; }
.sms-counter.danger { color: #E24B4A; }
.sms-preview { background: #12172a; border: 1px solid #1e2640; border-radius: 8px; padding: 12px; font-size: 12px; color: #cbd5e1; line-height: 1.6; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; }
.sms-actions { display: flex; gap: 8px; justify-content: flex-end; padding: 14px 18px; border-top: 1px solid #1e2640; }
.sms-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: none; font-weight: 600; font-size: 12px; cursor: pointer; transition: opacity 0.15s; }
.sms-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sms-btn-primary { background: #6c63ff; color: #fff; }
.sms-btn-secondary { background: rgba(108,99,255,0.15); color: #a5b4fc; }
.sms-btn-ghost { background: transparent; color: #94a3b8; border: 1px solid #1e2640; }
.sms-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; }
.sms-variables { display: flex; gap: 6px; flex-wrap: wrap; }
.sms-var-chip { font-size: 10px; padding: 2px 8px; border-radius: 12px; background: rgba(108,99,255,0.15); color: #a5b4fc; cursor: pointer; border: none; font-weight: 600; }
@keyframes sms-spin { to { transform: rotate(360deg); } }
.sms-spin { animation: sms-spin 1s linear infinite; }
`;

function isFixe(phone) {
  const e164 = toE164(phone);
  if (!e164) return false;
  const after33 = e164.slice(3);
  return /^[12345]/.test(after33);
}

export default function SmsModal({ open, onClose, groupe, session, config, smsHistory, onSmsSent }) {
  const [template, setTemplate] = useState('');
  const [selected, setSelected] = useState({});
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);

  const membres = groupe?.membres || [];
  const groupeNum = groupe?.numero || 1;
  // Use the group's REAL (possibly edited) start time, not a hardcoded map.
  const horaire = formatHeureSms(groupe?.heure);
  const eventUuid = session?.id;

  useEffect(() => {
    if (!open) return;
    // Single canonical template, hour-agnostic: the real group hour is injected
    // via {horaire}. Selection no longer depends on the group number, so the
    // chronological renumbering never sends a wrong/mismatched hour.
    const tpl = config?.[SMS_TEMPLATE_KEY] || 'Bonjour {prenom}, les groupes ont été constitués selon votre niveau. Formation demain à {horaire}, 28 rue Belgrand Paris 20e. Théorie puis pratique. Bonne journée !';
    setTemplate(tpl);
    setSendResult(null);
    setSaved(false);
    const sel = {};
    membres.forEach(m => { sel[m.email] = !!(m.phone && toE164(m.phone)); });
    setSelected(sel);
  }, [open, groupeNum, config, membres, horaire]);

  const checkedMembers = useMemo(
    () => membres.filter(m => selected[m.email] && m.phone && toE164(m.phone)),
    [membres, selected]
  );

  const firstChecked = checkedMembers[0];
  const previewMsg = useMemo(() => {
    if (!firstChecked) return '';
    const prenom = (firstChecked.name || '').trim().split(/\s+/)[0] || (firstChecked.email || '').split('@')[0];
    return genererMessageFromTemplate(template, {
      prenom,
      horaire,
      vehicule: firstChecked.role || 'scooter',
    });
  }, [firstChecked, template, horaire]);

  const charCount = previewMsg.length;
  const smsCount = countSms(charCount);
  const counterClass = smsCount > 3 ? 'danger' : smsCount > 1 ? 'warn' : '';

  const handleToggle = (email) => {
    setSelected(prev => ({ ...prev, [email]: !prev[email] }));
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      // Persist to the canonical key (matches what we read), not the group number.
      await saveSmsTemplate(1, template);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(`Erreur sauvegarde template : ${e.message}`);
    }
    setSaving(false);
  };

  const handleSend = async () => {
    if (Date.now() < lockUntil) return;
    if (checkedMembers.length === 0) return;

    setSending(true);
    setSendResult(null);
    setLockUntil(Date.now() + 5000);

    const destinataires = checkedMembers.map(m => {
      const prenom = (m.name || '').trim().split(/\s+/)[0] || (m.email || '').split('@')[0];
      const msg = genererMessageFromTemplate(template, {
        prenom,
        horaire,
        vehicule: m.role || 'scooter',
      });
      return {
        invitee_uuid: m.invitee_uuid || m.id || m.email,
        prenom,
        numero: m.phone || '',
        message: msg,
      };
    });

    const dateFormation = session?.start_time ? session.start_time.split('T')[0] : null;

    try {
      const result = await sendSMSViaEdgeFunction({
        calendly_event_uuid: eventUuid,
        groupe_numero: groupeNum,
        date_formation: dateFormation,
        heure_groupe: horaire,
        destinataires,
      });
      setSendResult(result);
      if (onSmsSent) onSmsSent();
    } catch (e) {
      setSendResult({ error: e.message });
    }
    setSending(false);
  };

  const insertVar = (v) => {
    setTemplate(prev => prev + `{${v}}`);
  };

  if (!open) return null;

  return (
    <div className="sms-modal-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="sms-modal" onClick={e => e.stopPropagation()}>
        <div className="sms-modal-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
              {membres.length === 1
                ? `SMS à ${(membres[0].name || '').split(/\s+/)[0] || membres[0].email}`
                : `Envoyer SMS — Groupe ${groupeNum} (${horaire})`}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {checkedMembers.length} destinataire{checkedMembers.length > 1 ? 's' : ''} sélectionné{checkedMembers.length > 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, display: 'flex' }} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="sms-modal-body">
          <div>
            <div className="sms-section-label" style={{ marginBottom: 6 }}>Destinataires</div>
            {membres.map(m => {
              const phone = toE164(m.phone);
              const hasPhone = !!phone;
              const fix = hasPhone && isFixe(m.phone);
              const phoneKey = toE164(m.phone);
              const hasSent = phoneKey && smsHistory?.[phoneKey]?.some(s => s.statut === 'sent');
              return (
                <div key={m.email} className={`sms-dest-row ${!hasPhone ? 'disabled' : ''}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!selected[m.email]}
                      onChange={() => handleToggle(m.email)}
                      disabled={!hasPhone}
                      style={{ accentColor: '#6c63ff' }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name || m.email}
                    </span>
                    {hasSent && <Check size={10} style={{ color: '#10b981', flexShrink: 0 }} title="Déjà envoyé" />}
                  </label>
                  <span className={`sms-dest-phone ${hasPhone ? (fix ? 'fixe' : 'valid') : ''}`}>
                    {hasPhone ? phone : (m.phone || 'Pas de téléphone')}
                    {fix && ' (fixe)'}
                  </span>
                </div>
              );
            })}
          </div>

          <div>
            <div className="sms-section-label" style={{ marginBottom: 6 }}>
              Message
              <span style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                — variables disponibles :
              </span>
            </div>
            <div className="sms-variables" style={{ marginBottom: 8 }}>
              {['prenom', 'horaire', 'vehicule'].map(v => (
                <button key={v} className="sms-var-chip" onClick={() => insertVar(v)} type="button">
                  {`{${v}}`}
                </button>
              ))}
            </div>
            <textarea
              className="sms-textarea"
              value={template}
              onChange={e => setTemplate(e.target.value)}
              placeholder="Saisissez votre message..."
            />
            <div className={`sms-counter ${counterClass}`}>
              <span>{charCount}/160 caractères</span>
              <span>{smsCount} SMS facturé{smsCount > 1 ? 's' : ''} par destinataire</span>
            </div>
            {smsCount > 3 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#E24B4A', marginTop: 4 }}>
                <AlertTriangle size={12} /> Message trop long — plus de 3 SMS par envoi
              </div>
            )}
          </div>

          {firstChecked && (
            <div>
              <div className="sms-section-label" style={{ marginBottom: 6 }}>
                Aperçu — {(firstChecked.name || '').split(/\s+/)[0] || firstChecked.email}
              </div>
              <div className="sms-preview">{previewMsg}</div>
            </div>
          )}

          {sendResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: sendResult.error ? 'rgba(226,75,74,0.12)' : 'rgba(16,185,129,0.12)',
              color: sendResult.error ? '#E24B4A' : '#10b981',
            }}>
              {sendResult.error
                ? `Erreur : ${sendResult.error}`
                : `${sendResult.success} SMS envoyé${sendResult.success > 1 ? 's' : ''}${sendResult.failed > 0 ? ` — ${sendResult.failed} échec${sendResult.failed > 1 ? 's' : ''}` : ''}`
              }
            </div>
          )}
        </div>

        <div className="sms-actions">
          <button
            className="sms-btn sms-btn-ghost"
            onClick={handleSaveTemplate}
            disabled={saving || !template.trim()}
          >
            {saving ? <Loader size={12} className="sms-spin" /> : saved ? <Check size={12} /> : <Save size={12} />}
            {saved ? 'Enregistré' : 'Enregistrer comme template'}
          </button>
          <button
            className="sms-btn sms-btn-primary"
            onClick={handleSend}
            disabled={sending || checkedMembers.length === 0 || Date.now() < lockUntil}
          >
            {sending ? <Loader size={12} className="sms-spin" /> : <Send size={12} />}
            {sending ? 'Envoi en cours…' : `Envoyer à ${checkedMembers.length} destinataire${checkedMembers.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
