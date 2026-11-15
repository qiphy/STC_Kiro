import StatusBadge from './StatusBadge.jsx';

export default function TaskRow({ task, technicianName }) {
  const tech = technicianName || task.technician_name || task.technician?.name || 'Unassigned';
  return (
    <div className="task-row">
      <span className="task-title">{task.title}</span>
      <span className="task-tech">{tech}</span>
      <StatusBadge status={task.status} />
    </div>
  );
}
