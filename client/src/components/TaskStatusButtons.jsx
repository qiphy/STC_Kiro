const BUTTONS = [
  { label: 'Start', status: 'in_progress' },
  { label: 'Done', status: 'done' },
  { label: 'Blocked', status: 'blocked' },
];

export default function TaskStatusButtons({ title, status, busy, canMarkDone, onChange }) {
  return (
    <div className="task-status-buttons" role="group" aria-label={`Status for ${title}`}>
      {BUTTONS.map(({ label, status: target }) => {
        const pressed = status === target;
        const gated = target === 'done' && !canMarkDone && !pressed;
        return (
          <button
            key={target}
            type="button"
            className={pressed ? 'status-btn active' : 'status-btn'}
            aria-pressed={pressed}
            disabled={busy || gated}
            title={gated ? 'Tick all checklist items to mark this task done' : undefined}
            onClick={() => onChange(target)}
          >
            {label}
          </button>
        );
      })}
      {status !== 'todo' && (
        <button
          type="button"
          className="link-btn"
          disabled={busy}
          onClick={() => onChange('todo')}
        >
          Reset to todo
        </button>
      )}
    </div>
  );
}
