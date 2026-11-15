import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreServices } from './priority.js';

test('empty input returns an empty list', () => {
  assert.deepEqual(scoreServices([], []), { list: [], cycleDetected: false });
});

test('dependencies rank before dependents and score follows the formula', () => {
  const services = [
    { id: 3, name: 'Online Banking', criticality: 4, customer_impact: 5 },
    { id: 2, name: 'Core Banking', criticality: 5, customer_impact: 5 },
    { id: 4, name: 'Mobile App', criticality: 4, customer_impact: 5 },
  ];
  const deps = [
    { service_id: 2, depends_on_id: 1 },
    { service_id: 3, depends_on_id: 2 },
    { service_id: 4, depends_on_id: 2 },
  ];
  const { list, cycleDetected } = scoreServices(services, deps);
  assert.equal(cycleDetected, false);
  assert.deepEqual(list.map((s) => s.name), ['Core Banking', 'Mobile App', 'Online Banking']);
  assert.equal(list[0].score, 5 * 3 + 5 * 2 + 2 * 2);
  assert.deepEqual(list.map((s) => s.rank), [1, 2, 3]);
});

test('cycles are reported and every service is still ranked', () => {
  const services = [
    { id: 1, name: 'A', criticality: 1, customer_impact: 1 },
    { id: 2, name: 'B', criticality: 1, customer_impact: 1 },
  ];
  const deps = [
    { service_id: 1, depends_on_id: 2 },
    { service_id: 2, depends_on_id: 1 },
  ];
  const { list, cycleDetected } = scoreServices(services, deps);
  assert.equal(cycleDetected, true);
  assert.equal(list.length, 2);
});
