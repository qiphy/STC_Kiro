import { useEffect, useRef, useState } from 'react';
import { request } from '../api.js';
import ProgressBar from '../components/ProgressBar.jsx';
import TaskRow from '../components/TaskRow.jsx';

const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked'];

const RESTORED_TITLE = 'Services restored';
const RESTORED_BODY =
  'All affected banking services have been restored and are operating normally. ' +
  'Thank you for your patience. We will never ask for your password, PIN or OTP. ' +
  'Use official bank channels only.';

const taskServiceId = (t) => t.service_id ?? t.service?.id ?? null;
const taskTechId = (t) => t.technician_id ?? t.technician?.id ?? '';

function countDone(tasks) {
  return tasks.filter((t) => t.status === 'done').length;
}

export default function Recovery() {
  const [tasks, setTasks] = useState([]);
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [incident, setIncident] = useState(null);
  const [affected, setAffected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ title: '', service_id: '', technician_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState(null);
  const [restoredPending, setRestoredPending] = useState(false);
  const [restoredMsg, setRestoredMsg] = useState('');
  const [posting, setPosting] = useState(false);
  const hadActive = useRef(false);

  async function load() {
    setLoading(true);
    try {
      const [t, s, tech, active] = await Promise.all([
        request('/tasks'),
        request('/services'),
        request('/technicians'),
        request('/incidents/active'),
      ]);
      setTasks(Array.isArray(t) ? t : t?.tasks || []);
      setServices(Array.isArray(s) ? s : s?.services || []);
      setTechnicians(Array.isArray(tech) ? tech : tech?.technicians || []);
      const inc = active?.incident || null;
      setIncident(inc);
      setAffected(Array.isArray(active?.services) ? active.services : []);
      if (inc && inc.status === 'active') {
        hadActive.current = true;
      } else if (inc && inc.status === 'resolved') {
        setRestoredPending(true);
        hadActive.current = false;
      } else if (!inc && hadActive.current) {
        // The incident was active and is no longer: it has been resolved.
        setRestoredPending(true);
        hadActive.current = false;
      }
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load recovery data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const serviceName = (id) => services.find((s) => s.id === id)?.name || 'Unknown service';
  const techName = (id) => technicians.find((t) => t.id === id)?.name;

  // Group tasks by service (only services with at least one task).
  const groups = [];
  for (const t of tasks) {
    const sid = taskServiceId(t);
    let g = groups.find((x) => x.id === sid);
    if (!g) {
      g = { id: sid, name: serviceName(sid), tasks: [] };
      groups.push(g);
    }
    g.tasks.push(t);
  }

  // Affected services shown even when they have zero tasks (0%).
  const affectedIds = affected.map((s) => s.id);
  const progressList = [...groups];
  for (const id of affectedIds) {
    if (!progressList.some((g) => g.id === id)) {
      progressList.push({ id, name: serviceName(id), tasks: [] });
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const title = form.title.trim();
    if (title.length < 1 || title.length > 200) {
      setFormError('Title must be 1 to 200 characters');
      return;
    }
    if (!form.service_id) {
      setFormError('Select a service');
      return;
    }
    const body = { title, service_id: form.service_id };
    if (form.technician_id) body.technician_id = form.technician_id;
    setSubmitting(true);
    setFormError('');
    try {
      await request('/tasks', { method: 'POST', body });
      setForm({ title: '', service_id: form.service_id, technician_id: '' });
      await load();
    } catch (err) {
      // Keep entered form values on error.
      setFormError(err.message || 'Could not create task');
    } finally {
      setSubmitting(false);
    }
  }

  async function patchTask(task, changes) {
    if (Object.keys(changes).length === 0) return;
    setBusyTaskId(task.id);
    setError('');
    try {
      await request(`/tasks/${task.id}`, { method: 'PATCH', body: changes });
      await load();
    } catch (err) {
      setError(err.message || 'Task update failed');
    } finally {
      setBusyTaskId(null);
    }
  }

  function onAssignee(task, value) {
    const current = taskTechId(task) || '';
    if (value === current) return;
    patchTask(task, { technician_id: value === '' ? null : value });
  }

  function onStatus(task, value) {
    if (value === task.status) return;
    patchTask(task, { status: value });
  }

  async function postRestored() {
    setPosting(true);
    setRestoredMsg('');
    try {
      const incident_id = incident?.id;
      await request('/advisories', {
        method: 'POST',
        body: { title: RESTORED_TITLE, body: RESTORED_BODY, status: 'published', ...(incident_id ? { incident_id } : {}) },
      });
      for (const audience of ['customers', 'technicians']) {
        await request('/notifications', {
          method: 'POST',
          body: { audience, message: RESTORED_BODY, ...(incident_id ? { incident_id } : {}) },
        });
      }
      setRestoredPending(false);
      setRestoredMsg('Restored advisory and notifications posted.');
    } catch (err) {
      setRestoredMsg(err.message || 'Could not post restored update');
    } finally {
      setPosting(false);
    }
  }

  const total = tasks.length;
  const done = countDone(tasks);

  return (
    <div className="page recovery">
      <h2>Recovery</h2>
      <button type="button" onClick={load} disabled={loading}>
        {loading ? 'Loading...' : 'Refresh'}
      </button>

      {error && <p className="error" role="alert">{error}</p>}
      {restoredMsg && <p className="notice">{restoredMsg}</p>}

      {restoredPending && (
        <div className="restored-banner">
          <strong>All services are restored.</strong>
          <button type="button" onClick={postRestored} disabled={posting}>
            {posting ? 'Posting...' : 'Post restored advisory and notification'}
          </button>
          <button type="button" onClick={() => setRestoredPending(false)} disabled={posting}>
            Dismiss
          </button>
        </div>
      )}

      <section>
        <ProgressBar label="Overall progress" done={done} total={total} />
      </section>

      <section>
        <h3>Create task</h3>
        <form onSubmit={handleCreate} className="task-form">
          <input
            type="text"
            placeholder="Task title"
            value={form.title}
            maxLength={200}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            aria-label="Task title"
          />
          <select
            value={form.service_id}
            onChange={(e) => setForm({ ...form, service_id: e.target.value })}
            aria-label="Service"
          >
            <option value="">Select service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={form.technician_id}
            onChange={(e) => setForm({ ...form, technician_id: e.target.value })}
            aria-label="Technician"
          >
            <option value="">Unassigned</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add task'}</button>
        </form>
        {formError && <p className="error" role="alert">{formError}</p>}
      </section>

      <section>
        <h3>Tasks by service</h3>
        {progressList.length === 0 && !loading && <p>No tasks yet.</p>}
        {progressList.map((g) => (
          <div key={g.id ?? 'none'} className="service-group">
            <h4>{g.name}</h4>
            <ProgressBar done={countDone(g.tasks)} total={g.tasks.length} />
            {g.tasks.map((t) => (
              <div key={t.id} className="task-edit">
                <TaskRow task={t} technicianName={techName(taskTechId(t))} />
                <select
                  value={taskTechId(t) || ''}
                  disabled={busyTaskId === t.id}
                  onChange={(e) => onAssignee(t, e.target.value)}
                  aria-label={`Assignee for ${t.title}`}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
                <select
                  value={t.status}
                  disabled={busyTaskId === t.id}
                  onChange={(e) => onStatus(t, e.target.value)}
                  aria-label={`Status for ${t.title}`}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
