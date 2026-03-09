import useIsMobile from '../hooks/useIsMobile';

const btnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: '#10b981',
  color: 'white',
  padding: '8px 16px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 600,
};

export default function PhoneLink({ phone }) {
  const isMobile = useIsMobile();
  if (!phone) return null;

  if (isMobile) {
    return (
      <a href={`tel:${phone}`} style={btnStyle} onClick={e => e.stopPropagation()}>
        📞 Appeler
      </a>
    );
  }

  return <span style={{ fontSize: 12, color: '#e2e8f0' }}>{phone}</span>;
}
