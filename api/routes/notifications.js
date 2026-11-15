import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { validateBody, toId, AUDIENCES } from '../lib/validate.js';

const router = Router();

const NOTIFICATION_COLUMNS = 'id, incident_id, audience, message, sent_at';

const createSchema = {
  audience: { type: 'string', required: true, enum: AUDIENCES },
  message: { type: 'string', required: true, min: 1, max: 500 },
  incident_id: { type: 'id' }, // optional, defaults to the active incident
};

function isObject(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body);
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

// GET /api/notifications -> bare array, newest first.
router.get('/notifications', async (req, res, next) => {
  try {
    const { data, error } = await getSupabase()
      .from('notifications')
      .select(NOTIFICATION_COLUMNS)
      .order('sent_at', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications { audience, message, incident_id? } -> 201 with the stored row.
// Sending is simulated: only a row is inserted, nothing is delivered.
router.post('/notifications', async (req, res, next) => {
  try {
    const body = isObject(req.body) ? req.body : {};
    const invalid = validateBody(createSchema, body);
    if (invalid) return badRequest(res, `Invalid field: ${invalid}`);

    const db = getSupabase();
    let incidentId;
    if (body.incident_id !== undefined && body.incident_id !== null) {
      incidentId = toId(body.incident_id);
      const found = await db.from('incidents').select('id').eq('id', incidentId).maybeSingle();
      if (found.error) throw found.error;
      if (!found.data) return badRequest(res, 'Unknown incident_id');
    } else {
      const active = await db
        .from('incidents')
        .select('id')
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active.error) throw active.error;
      if (!active.data) return badRequest(res, 'No active incident');
      incidentId = active.data.id;
    }

    const { data, error } = await db
      .from('notifications')
      .insert({
        incident_id: incidentId,
        audience: body.audience,
        message: body.message.trim(),
        sent_at: new Date().toISOString(),
      })
      .select(NOTIFICATION_COLUMNS)
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
