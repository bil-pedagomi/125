import { useState } from 'react';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

const COLORS = [
  '#6C63FF', '#F472B6', '#34D399', '#FBBF24', '#60A5FA', '#A78BFA', '#F87171', '#2DD4BF',
];

function hashColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ name, photoUrl, size = 40, style }) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name);
  const bg = hashColor(name);

  const baseStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: '50%',
    border: '2px solid #334155',
    objectFit: 'cover',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.38,
    fontWeight: 700,
    color: '#fff',
    userSelect: 'none',
    ...style,
  };

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name || 'Photo'}
        style={{ ...baseStyle, display: 'block' }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div style={{ ...baseStyle, background: bg }}>
      {initials}
    </div>
  );
}
