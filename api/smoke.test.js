import { describe, it, expect } from 'vitest';

// Smoke tests against a live local API. Run with:
//   SMOKE_API_URL=http://localhost:3001 npx vitest --run api/smoke.test.js
//
// Two groups:
//   1. Read-only checks. Safe on any database. Run whenever SMOKE_API_URL is set.
//   2. Demo-flow test. It simulates an incident, completes tasks and calls
//      reset, so it destroys data. It only runs when the SERVER reports that
//      reset is allowed (ALLOW_DEMO_RESET=true and RESET_ALLOWED_PROJECT_REF
//      matching the connected project), which means a dedicated test database.
//      Otherwise it is skipped, and your development data is never touched.
const BASE = (process.env.SMOKE_API_URL || '').replace(/\/$/, '');
const CONFIRM = { confirm: 'RESET_DEMO_DATA' };

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // leave null; assertions on json will fail
  }
  return { status: res.status, json };
}

// Asks the server whether reset is allowed WITHOUT resetting anything: the
// server checks its own safeguards before it looks at the confirmation, so a
// request with no confirmation is answered 403 (not allowed) or 400 (allowed,
// but not confirmed). Neither deletes data.
async function resetIsAllowedOnServer() {
  if (!BASE) return false;
  try {
    const { status } = await call('POST', '/api/incidents/reset', {});
    return status === 400;
  } catch {
    return false;
  }
}

const DESTRUCTIVE_ENABLED = await resetIsAllowedOnServer();
if (BASE && !DESTRUCTIVE_ENABLED) {
  console.warn(
    '[smoke] Demo-flow test SKIPPED: the server does not allow reset, so it is not a dedicated test ' +
      'database. To run it, point a test server at a separate Supabase project and set ' +
      'ALLOW_DEMO_RESET=true and RESET_ALLOWED_PROJECT_REF=<that project ref>.'
  );
}

describe.skipIf(!BASE)('read-only API checks', () => {
  it('lists services as an array', async () => {
    const { status, json } = await call('GET', '/api/services');
    expect(status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
  });

  it('lists technicians as an array', async () => {
    const { status, json } = await call('GET', '/api/technicians');
    expect(status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
  });

  it('returns the active incident shape', async () => {
    const { status, json } = await call('GET', '/api/incidents/active');
    expect(status).toBe(200);
    expect(Array.isArray(json.priority)).toBe(true);
  });

  it('reset without confirmation never deletes anything (403 or 400)', async () => {
    const { status } = await call('POST', '/api/incidents/reset', {});
    expect([400, 403]).toContain(status);
  });

  it('unknown /api path returns JSON 404 with error', async () => {
    const { status, json } = await call('GET', '/api/does-not-exist');
    expect(status).toBe(404);
    expect(typeof json.error).toBe('string');
  });
});

describe.skipIf(!DESTRUCTIVE_ENABLED)('demo flow (destructive, test database only)', () => {
  const state = {};

  it('starts healthy: all services operational', async () => {
    await call('POST', '/api/incidents/reset', CONFIRM);
    const { status, json } = await call('GET', '/api/services');
    expect(status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json.every((s) => s.status === 'operational')).toBe(true);
  });

  it('simulates an attack once, second call is 409', async () => {
    const first = await call('POST', '/api/incidents/simulate');
    expect(first.status).toBe(200);
    expect(first.json.status).toBe('active');
    state.incidentId = first.json.id;
    const second = await call('POST', '/api/incidents/simulate');
    expect(second.status).toBe(409);
    expect(typeof second.json.error).toBe('string');
  });

  it('active incident has a non-empty priority list', async () => {
    const { status, json } = await call('GET', '/api/incidents/active');
    expect(status).toBe(200);
    expect(json.incident).not.toBeNull();
    expect(json.priority.length).toBeGreaterThan(0);
    expect(typeof json.priority[0].reason).toBe('string');
    state.serviceId = json.services[0].id;
  });

  it('creates a task and assigns it to a technician', async () => {
    const techs = await call('GET', '/api/technicians');
    expect(techs.status).toBe(200);
    expect(techs.json.length).toBeGreaterThan(0);
    const techId = techs.json[0].id;

    const created = await call('POST', '/api/tasks', {
      title: 'Smoke test task',
      service_id: state.serviceId,
    });
    expect(created.status).toBe(201);
    expect(created.json.status).toBe('todo');

    const patched = await call('PATCH', `/api/tasks/${created.json.id}`, { technician_id: techId });
    expect(patched.status).toBe(200);
    expect(patched.json.technician_id).toBe(techId);
  });

  it('draft advisory is hidden from public status, published one appears', async () => {
    const title = 'Smoke advisory';
    const draft = await call('POST', '/api/advisories', {
      title: `${title} draft`,
      body: 'We are investigating a service disruption.',
      status: 'draft',
    });
    expect(draft.status).toBe(201);
    let pub = await call('GET', '/api/public/status');
    expect(pub.status).toBe(200);
    expect(pub.json.advisory?.title).not.toBe(`${title} draft`);

    const published = await call('POST', '/api/advisories', {
      title: `${title} published`,
      body: 'Some services are affected. Use official channels only.',
      status: 'published',
    });
    expect(published.status).toBe(201);
    pub = await call('GET', '/api/public/status');
    expect(pub.json.advisory.title).toBe(`${title} published`);
  });

  it('sends a simulated notification', async () => {
    const { status, json } = await call('POST', '/api/notifications', {
      audience: 'customers',
      message: 'We are working on restoring services.',
    });
    expect(status).toBe(201);
    expect(json.audience).toBe('customers');
  });

  it('completing all tasks raises progress and restores services', async () => {
    const list = await call('GET', '/api/tasks');
    expect(list.status).toBe(200);
    const tasks = list.json.filter((t) => t.incident_id === state.incidentId);
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      const r = await call('PATCH', `/api/tasks/${t.id}`, { status: 'done' });
      expect(r.status).toBe(200);
    }
    const after = await call('GET', '/api/tasks');
    const mine = after.json.filter((t) => t.incident_id === state.incidentId);
    expect(mine.every((t) => t.status === 'done')).toBe(true);

    const services = await call('GET', '/api/services');
    expect(services.json.every((s) => s.status === 'operational')).toBe(true);
  });

  it('reset succeeds twice', async () => {
    for (let i = 0; i < 2; i++) {
      const { status, json } = await call('POST', '/api/incidents/reset', CONFIRM);
      expect(status).toBe(200);
      expect(json.ok).toBe(true);
    }
  });
});
