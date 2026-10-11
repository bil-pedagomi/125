import { useState } from 'react';
import { LogIn, Loader } from 'lucide-react';
import { supabase } from '../supabase';

// Connexion par compte Supabase (Auth). Le contrôle d'accès se fait côté
// serveur : les données ne sont lisibles qu'avec le jeton d'un compte autorisé
// (f125_app_users, ou admin de la paie). Un compte valide mais non autorisé
// est connecté, puis reçoit « Accès au cockpit 125 refusé » de dashboard-125.
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
    }
    // En cas de succès, App bascule via onAuthStateChange (ce composant est
    // alors démonté).
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
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null); }}
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
            required
            onChange={e => { setPassword(e.target.value); setError(null); }}
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

        <button type="submit" disabled={loading} style={{
          width: '100%',
          padding: '12px 0',
          fontSize: 15,
          fontWeight: 700,
          color: '#fff',
          background: '#6C63FF',
          border: 'none',
          borderRadius: 10,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          {loading ? <Loader size={16} /> : <LogIn size={16} />}
          Se connecter
        </button>
      </form>
    </div>
  );
}
