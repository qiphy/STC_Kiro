// Pure scoring and ordering of affected services. No I/O.
// services: [{ id, name, criticality, customer_impact }] (affected only)
// dependencies: [{ service_id, depends_on_id }] (all edges)
// returns { list: [{ rank, service_id, name, score, reason }], cycleDetected }
export function scoreServices(services, dependencies) {
  if (!services || services.length === 0) return { list: [], cycleDetected: false };
  const edges = dependencies || [];

  const scored = services.map((s) => {
    const dependents = edges.filter((e) => e.depends_on_id === s.id).length;
    const score = s.criticality * 3 + s.customer_impact * 2 + dependents * 2;
    return {
      service_id: s.id,
      name: s.name,
      score,
      reason: `Criticality ${s.criticality}, customer impact ${s.customer_impact}, ${dependents} dependent service(s); score ${score}`,
    };
  });

  const byId = new Map(scored.map((s) => [s.service_id, s]));
  // Edges between affected services only: a service waits for what it depends on.
  const waitingOn = new Map(scored.map((s) => [s.service_id, new Set()]));
  for (const e of edges) {
    if (byId.has(e.service_id) && byId.has(e.depends_on_id)) {
      waitingOn.get(e.service_id).add(e.depends_on_id);
    }
  }

  const better = (a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const done = new Set();
  const ordered = [];
  let remaining = [...scored];

  while (remaining.length > 0) {
    const ready = remaining.filter((s) => [...waitingOn.get(s.service_id)].every((d) => done.has(d)));
    if (ready.length === 0) break;
    ready.sort(better);
    const next = ready[0];
    ordered.push(next);
    done.add(next.service_id);
    remaining = remaining.filter((s) => s !== next);
  }

  const cycleDetected = remaining.length > 0;
  if (cycleDetected) ordered.push(...remaining.sort(better));

  return { list: ordered.map((s, i) => ({ rank: i + 1, ...s })), cycleDetected };
}
