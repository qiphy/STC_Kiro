import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { validateBody, toId, TASK_STATUSES } from '../lib/validate.js';

const router = Router();

const TASK_COLUMNS = 'id, incident_id, service_id, title, technician_id, status';

const createSchema = {
  title: { type: 'string', required: true, min: 1, max: 200 },
  service_id: { type: 'id', required: true },
  technician_id: { type: 'id' }, // optional, null means unassigned
};

const updateSchema = {
  status: { type: 'string', enum: TASK_STATUSES },
  title: { type: 'string', min: 1, max: 200 },
  technician_id: { type: 'id' }, // optional, null means unassigned
};

// A body must be a plain JSON object.
function isObject(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body);
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

// GET /api/tasks -> bare array of all tasks ordered by id.
router.get('/tasks', async (req, res, next) => {
  try {
    const { data, error } = await getSupabase().from('tasks').select(TASK_COLUMNS).order('id');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks { title, service_id, technician_id? } -> 201 with the new task.
// The task is attached to the active incident and starts as `todo`.
router.post('/tasks', async (req, res, next) => {
  try {
    const body = isObject(req.body) ? req.body : {};
    const invalid = validateBody(createSchema, body);
    if (invalid) return badRequest(res, `Invalid field: ${invalid}`);

    const serviceId = toId(body.service_id);
    const technicianId = body.technician_id === undefined || body.technician_id === null
      ? null
      : toId(body.technician_id);

    const db = getSupabase();

    // The referenced service and technician must exist.
    const service = await db.from('services').select('id').eq('id', serviceId).maybeSingle();
    if (service.error) throw service.error;
    if (!service.data) return badRequest(res, 'Unknown service_id');

    if (technicianId !== null) {
      const technician = await db.from('technicians').select('id').eq('id', technicianId).maybeSingle();
      if (technician.error) throw technician.error;
      if (!technician.data) return badRequest(res, 'Unknown technician_id');
    }

    // New tasks belong to the active incident.
    const incident = await db
      .from('incidents')
      .select('id')
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (incident.error) throw incident.error;
    if (!incident.data) return badRequest(res, 'No active incident');

    const { data, error } = await db
      .from('tasks')
      .insert({
        incident_id: incident.data.id,
        service_id: serviceId,
        title: body.title.trim(),
        technician_id: technicianId,
        status: 'todo',
      })
      .select(TASK_COLUMNS)
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id with any of { status, technician_id, title }.
// The update_task_and_recompute function changes the task, then service and
// incident status, in one database transaction.
router.patch('/tasks/:id', async (req, res, next) => {
  try {
    const taskId = toId(req.params.id);
    if (taskId === null) return badRequest(res, 'Invalid task id');

    const body = isObject(req.body) ? req.body : {};
    const invalid = validateBody(updateSchema, body);
    if (invalid) return badRequest(res, `Invalid field: ${invalid}`);

    // Only fields that were sent go into the patch. `technician_id: null`
    // is a real value (unassign), so test for presence, not truthiness.
    const patch = {};
    if (body.status !== undefined && body.status !== null) patch.status = body.status;
    if (body.title !== undefined && body.title !== null) patch.title = body.title.trim();
    if (body.technician_id !== undefined) {
      patch.technician_id = body.technician_id === null ? null : toId(body.technician_id);
    }
    if (Object.keys(patch).length === 0) return badRequest(res, 'No fields to update');

    const { data, error } = await getSupabase().rpc('update_task_and_recompute', {
      task_id: taskId,
      patch,
    });
    if (error) {
      if (error.code === 'P0002') return res.status(404).json({ error: 'Task not found' });
      if (error.code === '23503') return badRequest(res, 'Unknown technician_id');
      throw error;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
