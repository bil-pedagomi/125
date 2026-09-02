import { useState, useEffect } from 'react';
import { CalendarDays, Users, BarChart3, Target, LogOut } from 'lucide-react';
import './App.css';
import { fetchDashboardData, consolidateData } from './utils';
import Agenda from './views/Agenda';
import Eleves from './views/Eleves';
import Stats from './views/Stats';
import Conversions from './views/Conversions';
import LoginPage from './components/LoginPage';
import { supabase, hasCockpitAccess } from './supabaseClient';

const TABS = [
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'eleves', label: 'Élèves', icon: Users },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'conversions', label: 'Conversions', icon: Target },
];

function App() {
  // null = session pas encore connue (on ne sait pas s'il faut afficher le
  // login), false = deconnecte, true = connecte ET autorise sur le cockpit.
  const [loggedIn, setLoggedIn] = useState(null);
  const [tab, setTab] = useState('agenda');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Session Supabase : restauree au chargement (on reste connecte apres un
  // rafraichissement) puis suivie en direct — une deconnexion ou un refresh
  // token expire ramene automatiquement sur l'ecran de login.
  useEffect(() => {
    let cancelled = false;

    const resolve = async (session) => {
      if (!session) return false;
      return hasCockpitAccess();
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const ok = await resolve(session);
      if (!cancelled) setLoggedIn(ok);
    });

    // Ne jamais appeler une autre fonction supabase-js DANS ce callback : il
    // s'execute en tenant le verrou d'auth, et un appel imbrique peut se
    // bloquer. On repasse donc par la boucle d'evenements avant de verifier.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        const ok = await resolve(session);
        if (!cancelled) {
          setLoggedIn(ok);
          if (!ok) { setData(null); setTab('agenda'); }
        }
      }, 0);
    });

    return () => { cancelled = true; sub?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (loggedIn !== true) return;
    setLoading(true);
    fetchDashboardData()
      .then(raw => setData(consolidateData(raw)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [loggedIn]);

  if (loggedIn === null) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner" />
          <span>Ouverture de la session…</span>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  if (loading) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-left">
            <h1>Pedagomi <span>125</span></h1>
            <span className="header-badge">COCKPIT</span>
          </div>
        </header>
        <div className="loading">
          <div className="spinner" />
          <span>Chargement des données…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-left">
            <h1>Pedagomi <span>125</span></h1>
          </div>
        </header>
        <div className="error-box">{error}</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>Pedagomi <span>125</span></h1>
          <span className="header-badge">COCKPIT</span>
        </div>
        <nav className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
          <button
            className="tab logout-btn"
            onClick={() => { void supabase.auth.signOut(); }}
            title="Déconnexion"
          >
            <LogOut size={16} />
            <span className="logout-label">Déconnexion</span>
          </button>
        </nav>
      </header>
      <main className="main">
        {tab === 'agenda' && <Agenda data={data} />}
        {tab === 'eleves' && <Eleves data={data} />}
        {tab === 'stats' && <Stats data={data} />}
        {tab === 'conversions' && <Conversions />}
      </main>
    </div>
  );
}

export default App;
