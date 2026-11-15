import { useEffect, useRef, useState } from 'react';

const ACTIONS = ['Run restore', 'Verify', 'Re-enable'];
const STEP_MS = 2000;
const TICK_MS = 100;

export default function TaskActions({ status, onStart }) {
  const [running, setRunning] = useState(null);
  const [pct, setPct] = useState(0);
  const [completed, setCompleted] = useState([]);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  function run(action) {
    if (running) return;
    // First action on a todo task moves it to in_progress (parent handles errors).
    if (status === 'todo' && onStart) onStart();
    setRunning(action);
    setPct(0);
    const began = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - began) / STEP_MS) * 100));
      setPct(p);
      if (p >= 100) {
        clearInterval(timer.current);
        setCompleted((prev) => (prev.includes(action) ? prev : [...prev, action]));
        setRunning(null);
      }
    }, TICK_MS);
  }

  return (
    <div className="task-actions">
      <div className="task-actions-buttons">
        {ACTIONS.map((a) => (
          <button key={a} type="button" disabled={!!running} onClick={() => run(a)}>
            {completed.includes(a) ? '✓ ' : ''}{a}
          </button>
        ))}
      </div>
      {running && (
        <div className="task-actions-progress">
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-text">{running}... {pct}%</span>
        </div>
      )}
      <p className="task-actions-note">Simulated, no real system is touched</p>
    </div>
  );
}
