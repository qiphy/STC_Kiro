import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { scoreServices } from '../lib/priority.js';

const router = Router();

// GET /api/incidents/active
router.get('/incidents/active', async (req, res, next) => {
  try {
    const db = getSupabase();
    const { data: incident, error } = await db
      .from('incidents')
      .select('id, title, status, started_at, resolved_at')
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!incident) return res.json({ incident: null, services: [], priority: [], cycleDetected: false });

    const { data: links, error: linkErr } = await db
      .from('incident_services')
      .select('service_id')
      .eq('incident_id', incident.id);
    if (linkErr) throw linkErr;
    const ids = links.map((l) => l.service_id);

    let services = [];
    if (ids.length > 0) {
      const { data, error: svcErr } = await db
        .from('services')
        .select('id, name, status, severity, criticality, customer_impact')
        .in('id', ids)
        .order('id');
      if (svcErr) throw svcErr;
      services = data;
    }

    const { data: deps, error: depErr } = await db
      .from('service_dependencies')
      .select('service_id, depends_on_id');
    if (depErr) throw depErr;

    const { list, cycleDetected } = scoreServices(services, deps);
    res.json({
      incident,
      services: services.map(({ id, name, status, severity }) => ({ id, name, status, severity })),
      priority: list,
      cycleDetected,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/simulate -> 201 with the new incident, 409 if one is active.
router.post('/incidents/simulate', async (req, res, next) => {
  try {
    const { data, error } = await getSupabase().rpc('simulate_attack');
    if (error) {
      if (error.code === 'IA409' || error.code === 'P0409' || error.code === '23505' || /INCIDENT_ALREADY_ACTIVE|active incident/i.test(error.message || '')) {
        return res.status(409).json({ error: 'An incident is already active' });
      }
      throw error;
    }
    res.status(201).json({ incident: Array.isArray(data) ? data[0] : data });
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/reset
router.post('/incidents/reset', async (req, res, next) => {
  try {
    const { error } = await getSupabase().rpc('reset_demo');
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
