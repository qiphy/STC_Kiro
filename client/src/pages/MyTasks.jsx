import { useEffect, useState } from 'react';
import { request } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked'];

const asList = (data, key) => (Array.isArray(data) ? data : data?.[key] || []);
const taskTechId = (t) => t.technician_id ?? t.technician?.id ?? null;

export default function MyTasks() {
  const [technicians, setTechnicians] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [services, setServices] = useState([]);
  const [techId, setTechId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [tech, t, s] = await Promise.all([
          request('/technicians'),
          request('/tasks'),
          request('/services'),
        ]);
        if (cancelled) return;
        setTechnicians(asList(tech, 'technicians'));
        setTasks(asList(t, 'tasks'));
        setServices(asList(s, 'services'));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load tasks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const serviceName = (t) =>
    t.service_name ||
    t.service?.name ||
    services.find((s) => s.id === t.service_id)?.name ||
    'Unknown service';

  const myTasks = techId ? tasks.filter((t) => String(taskTechId(t)) === String(techId)) : [];

  async function changeStatus(task, status) {
    if (status === task.status) return;
    setBusyId(task.id);
    setError('');
    try {
      await request(`/tasks/${task.id}`, { method: 'PATCH', body: { status } });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    } catch (err) {
      // Previous status stays: state is only updated on success.
      setError(`Update failed for "${task.title}": ${err.message || 'unknown error'}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page my-tasks">
      <h2>My Tasks</h2>

      <label>
        Acting technician{' '}
        <select value={techId} onChange={(e) => setTechId(e.target.value)} aria-label="Technician">
          <option value="">Select technician</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && !techId && <p>Select a technician to see assigned tasks.</p>}
      {!loading && techId && myTasks.length === 0 && <p>No tasks are assigned to this technician.</p>}

      {myTasks.map((t) => (
        <div key={t.id} className="task-edit">
          <div className="task-row">
            <span className="task-title">{t.title}</span>
            <span className="task-service">{serviceName(t)}</span>
            <StatusBadge status={t.status} />
          </div>
          <select
            value={t.status}
            disabled={busyId === t.id}
            onChange={(e) => changeStatus(t, e.target.value)}
            aria-label={`Status for ${t.title}`}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
