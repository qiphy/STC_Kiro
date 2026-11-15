export default function SeverityBadge({ severity }) {
  if (!severity) return <span className="badge badge-none">none</span>;
  return <span className={`badge badge-${severity}`}>{severity}</span>;
}
