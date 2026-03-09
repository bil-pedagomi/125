import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Euro, FileCheck, Phone, PhoneCall, Mail, AlertTriangle, MessageSquare } from 'lucide-react';
import { getMonthKey, getMonthLabel, formatDate } from '../utils';

const PRICE = 199;

function Dashboard({ data }) {
  const { eleves, sessions, motifs } = data;

  const totalEleves = eleves.length;
  const caEstime = totalEleves * PRICE;
  const nbFormRempli = eleves.filter(e => e.formulaireRempli).length;
  const pctForm = totalEleves > 0 ? Math.round((nbFormRempli / totalEleves) * 100) : 0;
  const nbAppele = eleves.filter(e => e.nbAppels > 0).length;
  const tauxAppel = totalEleves > 0 ? Math.round((nbAppele / totalEleves) * 100) : 0;
  const nbEmailRecus = eleves.filter(e => e.nbEmails > 0).length;

  const chartData = useMemo(() => {
    const months = {};
    eleves.forEach(e => {
      const session = sessions.find(s =>
        s.invitees?.some(i => i.emailNorm === e.emailNorm)
      );
      const dateStr = session?.start_time || session?.date || e.created_at || e.date;
      const mk = getMonthKey(dateStr);
      if (mk) {
        months[mk] = (months[mk] || 0) + 1;
      }
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({ month: getMonthLabel(key), eleves: count }));
  }, [eleves, sessions]);

  const formNonRemplis = eleves.filter(e => !e.formulaireRempli);
  const ontAppele = eleves.filter(e => e.nbAppels > 0);

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card accent">
          <span className="kpi-label"><Users size={12} style={{ display: 'inline', marginRight: 4 }} />Total élèves</span>
          <span className="kpi-value">{totalEleves}</span>
        </div>
        <div className="kpi-card green">
          <span className="kpi-label"><Euro size={12} style={{ display: 'inline', marginRight: 4 }} />CA estimé</span>
          <span className="kpi-value">{caEstime.toLocaleString('fr-FR')} €</span>
          <span className="kpi-sub">@{PRICE}€/élève</span>
        </div>
        <div className="kpi-card blue">
          <span className="kpi-label"><FileCheck size={12} style={{ display: 'inline', marginRight: 4 }} />Formulaire rempli</span>
          <span className="kpi-value">{pctForm}%</span>
          <span className="kpi-sub">{nbFormRempli}/{totalEleves}</span>
        </div>
        <div className="kpi-card orange">
          <span className="kpi-label"><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />Taux d'appel</span>
          <span className="kpi-value">{tauxAppel}%</span>
          <span className="kpi-sub">Objectif : 0%</span>
        </div>
        <div className="kpi-card red">
          <span className="kpi-label"><PhoneCall size={12} style={{ display: 'inline', marginRight: 4 }} />Ont appelé</span>
          <span className="kpi-value">{nbAppele}</span>
        </div>
        <div className="kpi-card blue">
          <span className="kpi-label"><Mail size={12} style={{ display: 'inline', marginRight: 4 }} />Emails reçus</span>
          <span className="kpi-value">{nbEmailRecus}</span>
          <span className="kpi-sub">Objectif : 0</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title"><Users size={16} /> Élèves par mois</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
                <XAxis dataKey="month" tick={{ fill: '#9aa0b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9aa0b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e2235', border: '1px solid #2a2f45', borderRadius: 8, fontSize: 13 }}
                  labelStyle={{ color: '#e8eaed' }}
                  itemStyle={{ color: '#6c63ff' }}
                />
                <Bar dataKey="eleves" fill="#6c63ff" radius={[4, 4, 0, 0]} name="Élèves" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-state">Aucune donnée</p>
          )}
        </div>

        <div className="card">
          <div className="card-title"><MessageSquare size={16} /> Motifs d'appels</div>
          {motifs.length > 0 ? (
            <ul className="motif-list">
              {motifs.map((m, i) => (
                <li key={i} className="motif-item">
                  <span className="motif-count">{m.count}</span>
                  <span className="motif-text">{m.motif}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Aucun motif d'appel enregistré</p>
          )}
        </div>
      </div>

      <div className="actions-section">
        <div className="card">
          <div className="card-title"><AlertTriangle size={16} /> Actions requises</div>
          <div className="action-list">
            {formNonRemplis.map((e, i) => (
              <div key={`form-${i}`} className="action-item warning">
                <div className="action-icon orange"><FileCheck size={16} /></div>
                <div>
                  <div className="action-name">{e.name || e.nom || e.email}</div>
                  <div className="action-detail">Formulaire non rempli</div>
                </div>
              </div>
            ))}
            {ontAppele.map((e, i) => (
              <div key={`call-${i}`} className="action-item danger">
                <div className="action-icon red"><PhoneCall size={16} /></div>
                <div>
                  <div className="action-name">{e.name || e.nom || e.email}</div>
                  <div className="action-detail">{e.nbAppels} appel{e.nbAppels > 1 ? 's' : ''} Ringover</div>
                </div>
              </div>
            ))}
            {formNonRemplis.length === 0 && ontAppele.length === 0 && (
              <p className="empty-state">Aucune action requise</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
