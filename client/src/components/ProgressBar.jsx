export default function ProgressBar({ done = 0, total = 0, label }) {
  const d = Number(done) || 0;
  const t = Number(total) || 0;
  const pct = t > 0 ? Math.min(100, Math.max(0, Math.round((d / t) * 100))) : 0;
  return (
    <div className="progress-wrap">
      {label && <div className="progress-label">{label}</div>}
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-text">{pct}% ({d}/{t})</div>
    </div>
  );
}
