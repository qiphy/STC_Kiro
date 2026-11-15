export const CHECKLIST_ITEMS = ['Backup verified', 'Service tested', 'Monitoring clear'];

export const isChecklistComplete = (checked) =>
  CHECKLIST_ITEMS.every((item) => checked?.[item] === true);

export default function TaskChecklist({ taskId, checked = {}, onChange }) {
  const complete = isChecklistComplete(checked);
  return (
    <div className="task-checklist">
      {CHECKLIST_ITEMS.map((item) => (
        <label key={item} className="checklist-item">
          <input
            type="checkbox"
            checked={checked[item] === true}
            onChange={(e) => onChange(taskId, item, e.target.checked)}
          />{' '}
          {item}
        </label>
      ))}
      {!complete && (
        <p className="checklist-hint">Tick all checklist items to mark this task done</p>
      )}
    </div>
  );
}
