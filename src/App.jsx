import { useState, useEffect } from 'react';
import { LayoutDashboard, CalendarDays, Users, LogOut } from 'lucide-react';
import './App.css';
import { fetchDashboardData, consolidateData } from './utils';
import Dashboard from './views/Dashboard';
import Agenda from './views/Agenda';
import Eleves from './views/Eleves';
import LoginPage from './components/LoginPage';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'eleves', label: 'Élèves', icon: Users },
];

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loggedIn) return;
    setLoading(true);
    fetchDashboardData()
      .then(raw => setData(consolidateData(raw)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [loggedIn]);

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
            onClick={() => { setLoggedIn(false); setData(null); setTab('dashboard'); }}
            title="Déconnexion"
          >
            <LogOut size={16} />
            <span className="logout-label">Déconnexion</span>
          </button>
        </nav>
      </header>
      <main className="main">
        {tab === 'dashboard' && <Dashboard data={data} />}
        {tab === 'agenda' && <Agenda data={data} />}
        {tab === 'eleves' && <Eleves data={data} />}
      </main>
    </div>
  );
}

export default App;
