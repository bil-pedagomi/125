import { useEffect, useState } from 'react';
import { X, Download, Loader } from 'lucide-react';
import { fetchProxiedFile } from '../utils';

export default function Lightbox({ url, label, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Fichier servi par file-proxy (authentifié) puis affiché via une URL blob.
  const [blob, setBlob] = useState({ src: null, error: null, forUrl: null });
  useEffect(() => {
    if (!url) return;
    let objectUrl = null;
    let cancelled = false;
    fetchProxiedFile(url)
      .then(u => {
        objectUrl = u;
        if (cancelled) URL.revokeObjectURL(u);
        else setBlob({ src: u, error: null, forUrl: url });
      })
      .catch(e => { if (!cancelled) setBlob({ src: null, error: e.message, forUrl: url }); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  const src = blob.forUrl === url ? blob.src : null;
  const loadError = blob.forUrl === url ? blob.error : null;

  if (!url) return null;

  const isPdf = url.toLowerCase().includes('.pdf');

  return (
    <div
      className="lightbox-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: isPdf ? 900 : 700,
          maxHeight: '90vh',
          width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}
      >
        {/* Header bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          width: '100%', marginBottom: 12,
        }}>
          <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>{label}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={url}
              download
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(108,99,255,0.2)', color: '#a5b4fc',
                border: 'none', borderRadius: 6, padding: '6px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              <Download size={14} /> Télécharger
            </a>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239,68,68,0.2)', color: '#ef4444',
                border: 'none', borderRadius: 6, padding: '6px 8px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content — served through the file-proxy so PDFs render inline
            instead of downloading. The download link above keeps the direct URL. */}
        {loadError ? (
          <div style={{ color: '#ef4444', fontSize: 13 }}>Impossible d'afficher le fichier : {loadError}</div>
        ) : !src ? (
          <Loader size={24} color="#a5b4fc" />
        ) : isPdf ? (
          <iframe
            src={src}
            style={{
              width: '100%', height: '80vh',
              border: '1px solid #334155', borderRadius: 8,
              background: '#fff',
            }}
            title={label}
          />
        ) : (
          <img
            src={src}
            alt={label}
            style={{
              maxWidth: '100%', maxHeight: '80vh',
              objectFit: 'contain', borderRadius: 8,
              border: '1px solid #334155',
            }}
          />
        )}
      </div>
    </div>
  );
}
