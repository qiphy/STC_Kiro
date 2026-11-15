// Pure status helpers. No database access.

// Safe guidance shown on the public status page. Never ask for secrets here.
export const TIPS = [
  'Beware of phishing: do not click links in unexpected emails, texts or calls claiming to be from the bank.',
  'Never share your OTP, PIN or password with anyone. The bank will never ask for them.',
  'Use official banking channels only: the verified branch, hotline and channels listed on this page.',
];

// Percentage of tasks that are done, as an integer from 0 to 100.
export function progressPercent(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0;
  const done = tasks.filter((task) => task && task.status === 'done').length;
  return Math.round((done / tasks.length) * 100);
}

// Status rules from design.md, applied in order:
//   1. At least one task and all done          -> operational (restored_by_tasks = true)
//   2. Any task in_progress                    -> recovering  (restored_by_tasks = false)
//   3. Was operational because of tasks and a
//      task is no longer done                  -> recovering  (restored_by_tasks = false)
//   4. Otherwise                               -> unchanged
// `service` is { status, restored_by_tasks }. Returns { status, restored_by_tasks }.
// Calling deriveServiceStatus(tasks) with only a task list is also accepted;
// the service is then treated as having no current state.
export function deriveServiceStatus(service, tasks) {
  if (Array.isArray(service) && tasks === undefined) {
    tasks = service;
    service = {};
  }
  const current = service && typeof service === 'object' ? service : {};
  const taskList = Array.isArray(tasks) ? tasks : [];
  const unchanged = {
    status: current.status,
    restored_by_tasks: Boolean(current.restored_by_tasks),
  };

  if (taskList.length === 0) return unchanged;

  const statuses = taskList.map((task) => task && task.status);
  if (statuses.every((status) => status === 'done')) {
    return { status: 'operational', restored_by_tasks: true };
  }
  if (statuses.includes('in_progress')) {
    return { status: 'recovering', restored_by_tasks: false };
  }
  if (current.status === 'operational' && current.restored_by_tasks) {
    return { status: 'recovering', restored_by_tasks: false };
  }
  return unchanged;
}

// The incident is resolved when every affected service is operational.
// An incident with no affected services is never resolved by this rule.
export function shouldResolveIncident(affectedServices) {
  if (!Array.isArray(affectedServices) || affectedServices.length === 0) return false;
  return affectedServices.every((service) => service && service.status === 'operational');
}

// Build the response for the public status page. Only copies the fields
// that customers may see, so nothing private can leak by accident.
export function toPublicStatus({ services = [], advisories = [], channels = [], tips = TIPS } = {}) {
  const publicServices = (Array.isArray(services) ? services : [])
    .filter((service) => service)
    .map((service) => ({ name: service.name, status: service.status }));

  // Latest published advisory by created_at. Drafts are never shown.
  let latest = null;
  let latestTime = -Infinity;
  for (const advisory of Array.isArray(advisories) ? advisories : []) {
    if (!advisory || advisory.status !== 'published') continue;
    const time = Date.parse(advisory.created_at);
    const comparable = Number.isNaN(time) ? -Infinity : time;
    if (latest === null || comparable > latestTime) {
      latest = advisory;
      latestTime = comparable;
    }
  }
  const advisory = latest
    ? { title: latest.title, body: latest.body, created_at: latest.created_at }
    : null;

  const verifiedChannels = (Array.isArray(channels) ? channels : [])
    .filter((channel) => channel && channel.verified === true)
    .map((channel) => ({ name: channel.name, type: channel.type, contact: channel.contact }));

  return {
    services: publicServices,
    advisory,
    channels: verifiedChannels,
    tips: Array.isArray(tips) ? [...tips] : [...TIPS],
  };
}
