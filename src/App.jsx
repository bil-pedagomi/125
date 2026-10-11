import { useState, useEffect, lazy, Suspense } from 'react';
import { CalendarDays, Users, BarChart3, Target, LogOut } from 'lucide-react';
import './App.css';
import { fetchDashboardData, consolidateData } from './utils';
import Agenda from './views/Agenda';
import Eleves from './views/Eleves';
// Stats et Conversions embarquent recharts (~400 kB) : chargés à la demande.
const Stats = lazy(() => import('./views/Stats'));
const Conversions = lazy(() => import('./views/Conversions'));
import LoginPage from './components/LoginPage';
import { supabase } from './supabase';

const TABS = [
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'eleves', label: 'Élèves', icon: Users },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'conversions', label: 'Conversions', icon: Target },
];

function App() {
  // undefined = session pas encore lue ; null = déconnecté.
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState('agenda');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // On ne recharge que lorsque l'UTILISATEUR change, pas à chaque
  // rafraîchissement du jeton (toutes les heures).
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    fetchDashboardData()
      .then(raw => setData(consolidateData(raw)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setData(null);
    setError(null);
    setLoading(true);
    setTab('agenda');
  };

  if (session === undefined) return null;

  if (!session) {
    return <LoginPage />;
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
        <div className="error-box">
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="tab logout-btn" onClick={handleLogout}>
              <LogOut size={16} /> Se déconnecter
            </button>
          </div>
        </div>
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
            onClick={handleLogout}
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
        <Suspense fallback={<div className="loading"><div className="spinner" /></div>}>
          {tab === 'stats' && <Stats data={data} />}
          {tab === 'conversions' && <Conversions />}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
