import { useEffect, useState } from 'react';
import { request } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import TaskActions from '../components/TaskActions.jsx';
import Runbook from '../components/Runbook.jsx';
import TaskStatusButtons from '../components/TaskStatusButtons.jsx';
import TaskChecklist, { isChecklistComplete } from '../components/TaskChecklist.jsx';

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
  const [checklists, setChecklists] = useState({});

  const canMarkDone = (taskId) => isChecklistComplete(checklists[taskId]);
  const setChecked = (taskId, item, value) =>
    setChecklists((prev) => ({ ...prev, [taskId]: { ...prev[taskId], [item]: value } }));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [tech, t, s] = await Promise.allSettled([
          request('/technicians'),
          request('/tasks'),
          request('/services'),
        ]);
        if (cancelled) return;
        const failed = [];
        if (tech.status === 'fulfilled') setTechnicians(asList(tech.value, 'technicians'));
        else failed.push('technicians');
        if (t.status === 'fulfilled') setTasks(asList(t.value, 'tasks'));
        else failed.push('tasks');
        if (s.status === 'fulfilled') setServices(asList(s.value, 'services'));
        else failed.push('services');
        setError(failed.map((name) => `Could not load ${name}`).join('. '));
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
    if (status === 'done' && !canMarkDone(task.id)) {
      setError(`Tick all checklist items to mark "${task.title}" done`);
      return;
    }
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
          <TaskStatusButtons
            title={t.title}
            status={t.status}
            busy={busyId === t.id}
            canMarkDone={canMarkDone(t.id)}
            onChange={(status) => changeStatus(t, status)}
          />
          <TaskChecklist taskId={t.id} checked={checklists[t.id]} onChange={setChecked} />
          <TaskActions status={t.status} onStart={() => changeStatus(t, 'in_progress')} />
          <Runbook service={serviceName(t)} />
        </div>
      ))}
    </div>
  );
}
