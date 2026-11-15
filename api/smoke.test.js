import { describe, it, expect } from 'vitest';

// Demo-flow smoke test. Run against a live local API with seeded data:
//   SMOKE_API_URL=http://localhost:3001 npx vitest --run api/smoke.test.js
// Skipped when SMOKE_API_URL is unset. Mutates demo data, then resets it.
const BASE = (process.env.SMOKE_API_URL || '').replace(/\/$/, '');

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

describe.skipIf(!BASE)('demo flow smoke test', () => {
  const state = {};

  it('starts healthy: all services operational', async () => {
    await call('POST', '/api/incidents/reset');
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
      const { status, json } = await call('POST', '/api/incidents/reset');
      expect(status).toBe(200);
      expect(json.ok).toBe(true);
    }
  });

  it('unknown /api path returns JSON 404 with error', async () => {
    const { status, json } = await call('GET', '/api/does-not-exist');
    expect(status).toBe(404);
    expect(typeof json.error).toBe('string');
  });
});
