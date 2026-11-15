import { useEffect, useState } from 'react';
import { request } from '../api.js';

const RESTORED_TITLE = 'Services restored';
const RESTORED_BODY =
  'All affected banking services have been restored and are operating normally. ' +
  'Thank you for your patience. We will never ask for your password, PIN or OTP. ' +
  'Use official bank channels only.';

const AUDIENCES = ['customers', 'technicians'];

function toList(data, key) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[key]) ? data[key] : [];
}

function byNewest(list) {
  return [...list].sort((a, b) => new Date(b.sent_at || 0) - new Date(a.sent_at || 0));
}

function AdvisorySection({ incidentId, draftSeed }) {
  const [form, setForm] = useState({ title: '', body: '' });
  const [fallback, setFallback] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Prefill from the "restored" shortcut.
  useEffect(() => {
    if (draftSeed) {
      setForm({ title: draftSeed.title, body: draftSeed.body });
      setFallback(false);
      setError('');
      setMessage('');
    }
  }, [draftSeed]);

  async function generate() {
    setGenerating(true);
    setError('');
    setMessage('');
    try {
      const draft = await request('/advisories/generate', { method: 'POST', body: {} });
      setForm({ title: draft?.title || '', body: draft?.body || '' });
      setFallback(draft?.fallback === true);
    } catch (err) {
      setError(err.message || 'Could not generate a draft');
    } finally {
      setGenerating(false);
    }
  }

  async function save(status) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = { title: form.title, body: form.body, status };
      if (incidentId) body.incident_id = incidentId;
      await request('/advisories', { method: 'POST', body });
      setMessage(status === 'published' ? 'Advisory published.' : 'Advisory saved as draft.');
    } catch (err) {
      // Keep the edited text in the form.
      setError(err.message || 'Could not save the advisory');
    } finally {
      setSaving(false);
    }
  }

  const busy = generating || saving;

  return (
    <section>
      <h3>Advisory</h3>
      <button type="button" onClick={generate} disabled={busy}>
        {generating ? 'Generating...' : 'Generate draft'}
      </button>
      {fallback && (
        <p className="warning" role="status">
          The template draft was used because the AI draft was unavailable or failed safety checks.
        </p>
      )}
      <div className="comm-form">
        <input
          type="text"
          placeholder="Advisory title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          aria-label="Advisory title"
        />
        <textarea
          rows={8}
          placeholder="Advisory text"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          aria-label="Advisory text"
        />
        <div>
          <button type="button" onClick={() => save('draft')} disabled={busy}>
            Save as draft
          </button>{' '}
          <button type="button" onClick={() => save('published')} disabled={busy}>
            Publish
          </button>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
    </section>
  );
}

function NotificationLog({ entries }) {
  if (entries.length === 0) return <p>No notifications sent yet.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Sent</th>
          <th>Audience</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((n) => (
          <tr key={n.id ?? `${n.sent_at}-${n.audience}-${n.message}`}>
            <td>{n.sent_at ? new Date(n.sent_at).toLocaleString() : ''}</td>
            <td>{n.audience}</td>
            <td>{n.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NotifySection({ incidentId, messageSeed, onSent }) {
  const [audience, setAudience] = useState('customers');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (messageSeed) {
      setMessage(messageSeed);
      setError('');
    }
  }, [messageSeed]);

  function startSend(e) {
    e.preventDefault();
    const text = message.trim();
    if (!AUDIENCES.includes(audience)) {
      setError('Select an audience');
      return;
    }
    if (text.length < 1 || text.length > 500) {
      setError('Message must be 1 to 500 characters');
      return;
    }
    setError('');
    setConfirming(true);
  }

  async function confirmSend() {
    setSending(true);
    setError('');
    try {
      const body = { audience, message: message.trim() };
      if (incidentId) body.incident_id = incidentId;
      const saved = await request('/notifications', { method: 'POST', body });
      onSent(saved?.notification || saved);
      setMessage('');
      setConfirming(false);
    } catch (err) {
      // Keep the form values and add nothing to the log.
      setConfirming(false);
      setError(`Notification was not sent. ${err.message || ''}`.trim());
    } finally {
      setSending(false);
    }
  }

  return (
    <section>
      <h3>Notify</h3>
      <form onSubmit={startSend} className="comm-form">
        <select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Audience">
          {AUDIENCES.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <textarea
          rows={3}
          maxLength={500}
          placeholder="Notification message (max 500 characters)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Notification message"
        />
        <div>
          <button type="submit" disabled={sending || confirming}>Send notification</button>
        </div>
      </form>
      {confirming && (
        <div className="confirm-box" role="dialog" aria-label="Confirm notification">
          <p><strong>Send to {audience}?</strong></p>
          <p>{message.trim()}</p>
          <button type="button" onClick={confirmSend} disabled={sending}>
            {sending ? 'Sending...' : 'Confirm'}
          </button>{' '}
          <button type="button" onClick={() => setConfirming(false)} disabled={sending}>
            Cancel
          </button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}

export default function Communication() {
  const [incident, setIncident] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftSeed, setDraftSeed] = useState(null);
  const [messageSeed, setMessageSeed] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [active, notes] = await Promise.all([
        request('/incidents/active'),
        request('/notifications'),
      ]);
      setIncident(active?.incident || null);
      setLog(byNewest(toList(notes, 'notifications')));
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load communication data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onSent(entry) {
    if (entry) setLog((prev) => [entry, ...prev]);
  }

  function useRestored() {
    setDraftSeed({ title: RESTORED_TITLE, body: RESTORED_BODY });
    setMessageSeed(RESTORED_BODY);
  }

  const resolved = !loading && (!incident || incident.status === 'resolved');

  return (
    <div className="page communication">
      <h2>Communication</h2>
      <button type="button" onClick={load} disabled={loading}>
        {loading ? 'Loading...' : 'Refresh'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}

      {resolved && (
        <div className="restored-banner">
          <strong>No active incident.</strong>{' '}
          <button type="button" onClick={useRestored}>Prepare restored advisory</button>
        </div>
      )}

      <AdvisorySection incidentId={incident?.id} draftSeed={draftSeed} />
      <NotifySection incidentId={incident?.id} messageSeed={messageSeed} onSent={onSent} />

      <section>
        <h3>Notification log</h3>
        <NotificationLog entries={log} />
      </section>
    </div>
  );
}
