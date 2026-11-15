import StatusBadge from './StatusBadge.jsx';
import SeverityBadge from './SeverityBadge.jsx';

export default function ServiceCard({ service }) {
  const deps = Array.isArray(service.dependencies) ? service.dependencies : [];
  return (
    <div className="card service-card">
      <h3>{service.name}</h3>
      <div>
        <StatusBadge status={service.status} /> <SeverityBadge severity={service.severity} />
      </div>
      <p className="deps">
        {deps.length > 0 ? `Depends on: ${deps.join(', ')}` : 'No dependencies'}
      </p>
    </div>
  );
}
