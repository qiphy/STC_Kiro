// Public customer status page. Polls every 30 s; no login required.
import { useEffect, useState } from 'react';
import { request } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

const POLL_MS = 30000;

// Shown even when the API is unreachable.
const FALLBACK_TIPS = [
  'Beware of phishing: do not click links in unexpected emails, SMS or calls.',
  'Never share your OTP, PIN or password with anyone, including bank staff.',
  'Use official channels only: the bank website, app or the verified contacts listed here.',
];

export default function CustomerStatus() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await request('/public/status');
        if (!active) return;
        setData(res);
        setRefreshError(false);
      } catch {
        if (!active) return;
        setRefreshError(true);
      } finally {
        if (active) setLoaded(true);
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const unavailable = loaded && !data;
  const tips = data && Array.isArray(data.tips) && data.tips.length > 0 ? data.tips : FALLBACK_TIPS;
  const services = (data && data.services) || [];
  const channels = (data && data.channels) || [];
  const advisory = data && data.advisory;

  return (
    <div className="customer-status">
      <h2>Service status</h2>

      {!loaded && <p>Loading…</p>}
      {unavailable && <p className="error">Status unavailable. Retrying automatically.</p>}
      {data && refreshError && (
        <p className="error">Could not refresh. Showing the last known information.</p>
      )}

      {data && (
        <>
          <section>
            <h3>Services</h3>
            <ul className="status-list">
              {services.map((s) => (
                <li key={s.name}>
                  <span>{s.name}</span> <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Latest advisory</h3>
            {advisory ? (
              <div className="advisory">
                <h4>{advisory.title}</h4>
                <p>{advisory.body}</p>
                {advisory.created_at && (
                  <small>{new Date(advisory.created_at).toLocaleString()}</small>
                )}
              </div>
            ) : (
              <p>No active advisory</p>
            )}
          </section>

          <section>
            <h3>Verified alternative channels</h3>
            {channels.length === 0 ? (
              <p>No alternative channels listed.</p>
            ) : (
              <ul>
                {channels.map((c) => (
                  <li key={`${c.name}-${c.contact}`}>
                    <strong>{c.name}</strong> ({c.type}): {c.contact}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section>
        <h3>Security tips</h3>
        <ul>
          {tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
