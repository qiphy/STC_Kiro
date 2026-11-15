import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';

const router = Router();

// GET /api/services -> services with `dependencies` as an array of service names.
router.get('/services', async (req, res, next) => {
  try {
    const db = getSupabase();
    const [svc, dep] = await Promise.all([
      db.from('services').select('*').order('id'),
      db.from('service_dependencies').select('service_id, depends_on_id'),
    ]);
    if (svc.error) throw svc.error;
    if (dep.error) throw dep.error;

    const names = new Map(svc.data.map((s) => [s.id, s.name]));
    const result = svc.data.map((s) => ({
      ...s,
      dependencies: dep.data
        .filter((d) => d.service_id === s.id)
        .map((d) => names.get(d.depends_on_id))
        .filter(Boolean),
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
