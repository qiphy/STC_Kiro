import { useCallback, useEffect, useState } from 'react';
import { request } from '../api.js';
import ServiceCard from '../components/ServiceCard.jsx';

export default function Dashboard() {
  const [services, setServices] = useState(null);
  const [servicesError, setServicesError] = useState('');
  const [incidentData, setIncidentData] = useState(null);
  const [incidentLoaded, setIncidentLoaded] = useState(false);
  const [incidentError, setIncidentError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState('');

  // Services and incident load independently; a failure keeps old data.
  const load = useCallback(async () => {
    setLoading(true);
    const [s, i] = await Promise.allSettled([
      request('/services'),
      request('/incidents/active'),
    ]);
    if (s.status === 'fulfilled') {
      setServices(Array.isArray(s.value) ? s.value : []);
      setServicesError('');
    } else {
      setServicesError(s.reason?.message || 'Could not load services');
    }
    if (i.status === 'fulfilled') {
      setIncidentData(i.value);
      setIncidentLoaded(true);
      setIncidentError('');
    } else {
      setIncidentError(i.reason?.message || 'Could not load incident');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pending state is bounded by the 10 s request timeout in api.js.
  async function act(path) {
    setPending(true);
    setActionError('');
    try {
      await request(path, { method: 'POST' });
      await load();
    } catch (err) {
      setActionError(err.message || 'Action failed');
    } finally {
      setPending(false);
    }
  }

  const incident = incidentData?.incident || null;
  const priority = incidentData?.priority || [];

  return (
    <div>
      <h2>Incident Dashboard</h2>
      <div className="toolbar">
        <button onClick={() => act('/incidents/simulate')} disabled={pending}>
          Simulate attack
        </button>{' '}
        <button onClick={() => act('/incidents/reset')} disabled={pending}>
          Reset
        </button>{' '}
        <button onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {actionError && <p className="error">{actionError}</p>}

      <h3>Services</h3>
      {servicesError && (
        <p className="error">
          {servicesError} <button onClick={load} disabled={loading}>Retry</button>
        </p>
      )}
      {services && services.length === 0 && !servicesError && <p>No services found.</p>}
      {services && services.length > 0 && (
        <div className="service-grid">
          {services.map((svc) => (
            <ServiceCard key={svc.id} service={svc} />
          ))}
        </div>
      )}

      <h3>Recovery priority</h3>
      {incidentError && (
        <p className="error">
          {incidentError} <button onClick={load} disabled={loading}>Retry</button>
        </p>
      )}
      {incidentData?.cycleDetected && (
        <p className="warning">
          Warning: a circular dependency was detected. Priority order may be approximate.
        </p>
      )}
      {incidentLoaded && !incident && <p>No active incident</p>}
      {incident && (
        <div className="card">
          <p>
            <strong>{incident.title}</strong>
          </p>
          {priority.length === 0 ? (
            <p>No affected services.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Service</th>
                  <th>Score</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {priority.map((p) => (
                  <tr key={p.service_id}>
                    <td>{p.rank}</td>
                    <td>{p.name}</td>
                    <td>{p.score}</td>
                    <td>{p.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
