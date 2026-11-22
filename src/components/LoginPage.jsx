import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { signIn } from '../auth';

// Connexion avec un compte Supabase (e-mail + mot de passe). L'accès au cockpit
// est réservé aux comptes autorisés (table f125_app_users) — vérifié par la base.
export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(username, password);
      onLogin();
    } catch (err) {
      setError(err.status === 403 ? err.message : 'E-mail ou mot de passe incorrect');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0e1a',
      padding: 16,
    }}>
      <form onSubmit={handleSubmit} style={{
        width: '100%',
        maxWidth: 400,
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 16,
        padding: 32,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>
            Pedagomi <span style={{ color: '#6C63FF' }}>125</span>
          </h1>
          <span style={{
            display: 'inline-block',
            marginTop: 8,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 2,
            color: '#6C63FF',
            background: 'rgba(108,99,255,0.12)',
            padding: '4px 12px',
            borderRadius: 6,
            textTransform: 'uppercase',
          }}>
            COCKPIT
          </span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
            E-mail
          </label>
          <input
            type="email"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(''); }}
            autoComplete="username"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#e2e8f0',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
            Mot de passe
          </label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#e2e8f0',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.12)',
            color: '#ef4444',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} style={{
          width: '100%',
          padding: '12px 0',
          fontSize: 15,
          fontWeight: 700,
          color: '#fff',
          background: '#6C63FF',
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <LogIn size={16} />
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
