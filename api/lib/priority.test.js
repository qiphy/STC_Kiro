import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { scoreServices } from './priority.js';

// Independent cycle check (iterative DFS with colors), edges between supplied services only.
function hasCycle(services, dependencies) {
  const ids = new Set(services.map((s) => s.id));
  const adj = new Map([...ids].map((id) => [id, []]));
  for (const d of dependencies) {
    if (ids.has(d.service_id) && ids.has(d.depends_on_id)) {
      adj.get(d.service_id).push(d.depends_on_id);
    }
  }
  const color = new Map([...ids].map((id) => [id, 0])); // 0 new, 1 on stack, 2 done
  for (const start of ids) {
    if (color.get(start) !== 0) continue;
    const stack = [[start, 0]];
    color.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [node, i] = top;
      const next = adj.get(node);
      if (i < next.length) {
        top[1] += 1;
        const n = next[i];
        if (color.get(n) === 1) return true;
        if (color.get(n) === 0) {
          color.set(n, 1);
          stack.push([n, 0]);
        }
      } else {
        color.set(node, 2);
        stack.pop();
      }
    }
  }
  return false;
}

// Services with unique ids; dependencies may be cyclic, self-referencing, or point outside the set.
const graphArb = fc
  .integer({ min: 0, max: 8 })
  .chain((n) => {
    const ids = Array.from({ length: n }, (_, i) => `s${i}`);
    const idPool = [...ids, 'outside1', 'outside2'];
    return fc.record({
      services: fc.tuple(
        ...ids.map((id) =>
          fc.record({
            id: fc.constant(id),
            name: fc.string({ minLength: 1, maxLength: 12 }),
            criticality: fc.integer({ min: 1, max: 5 }),
            customer_impact: fc.integer({ min: 1, max: 5 }),
          })
        )
      ),
      dependencies: fc.array(
        fc.record({
          service_id: fc.constantFrom(...idPool),
          depends_on_id: fc.constantFrom(...idPool),
        }),
        { maxLength: 20 }
      ),
    });
  });

describe('scoreServices cycles', () => {
  it('empty input returns empty list and no cycle', () => {
    expect(scoreServices([], [])).toEqual({ list: [], cycleDetected: false });
  });

  // Feature: bank-cyber-recovery-platform, Property 5
  // **Validates: Requirements 3.8, 3.9**
  it('reports cycles iff present and ranks every service exactly once', () => {
    fc.assert(
      fc.property(graphArb, ({ services, dependencies }) => {
        const { list, cycleDetected } = scoreServices(services, dependencies);
        expect(list).toHaveLength(services.length);
        expect(list.map((r) => r.service_id).sort()).toEqual(
          services.map((s) => s.id).sort()
        );
        expect(cycleDetected).toBe(hasCycle(services, dependencies));
      }),
      { numRuns: 100 }
    );
  });
});
