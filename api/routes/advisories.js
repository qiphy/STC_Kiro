import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { validateBody, toId, ADVISORY_STATUSES } from '../lib/validate.js';
import {
  generateAdvisory,
  containsCredentialRequest,
  findUnverifiedChannels,
} from '../lib/advisory.js';

const router = Router();

const ADVISORY_COLUMNS = 'id, incident_id, title, body, status, created_at';

const createSchema = {
  title: { type: 'string', required: true, min: 1, max: 200 },
  body: { type: 'string', required: true, min: 1, max: 1000 },
  status: { type: 'string', required: true, enum: ADVISORY_STATUSES },
  incident_id: { type: 'id' }, // optional, defaults to the active incident
};

function isObject(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body);
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

async function getActiveIncident(db) {
  const { data, error } = await db
    .from('incidents')
    .select('id')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getVerifiedChannels(db) {
  const { data, error } = await db
    .from('alt_channels')
    .select('name, type, contact')
    .eq('verified', true)
    .order('id');
  if (error) throw error;
  return data || [];
}

// POST /api/advisories/generate -> { title, body, source, fallback }. Never writes.
router.post('/advisories/generate', async (req, res, next) => {
  try {
    const db = getSupabase();
    const incident = await getActiveIncident(db);
    const verifiedChannels = await getVerifiedChannels(db);

    let affectedServices = [];
    if (incident) {
      const { data, error } = await db
        .from('incident_services')
        .select('services(name, status, severity)')
        .eq('incident_id', incident.id);
      if (error) throw error;
      affectedServices = (data || []).map((row) => row.services).filter(Boolean);
    }

    const draft = await generateAdvisory({
      affectedServices,
      verifiedChannels,
      llmKey: process.env.LLM_API_KEY,
    });
    res.json({
      title: draft.title,
      body: draft.body,
      source: draft.source,
      fallback: draft.fallback,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/advisories { title, body, status, incident_id? } -> 201 with the stored row.
router.post('/advisories', async (req, res, next) => {
  try {
    const body = isObject(req.body) ? req.body : {};
    const invalid = validateBody(createSchema, body);
    if (invalid) return badRequest(res, `Invalid field: ${invalid}`);

    const title = body.title.trim();
    const text = body.body.trim();

    for (const [field, value] of [['body', text], ['title', title]]) {
      if (containsCredentialRequest(value)) {
        return badRequest(res, `${field} contains a prohibited credential request`);
      }
    }

    const db = getSupabase();
    const verifiedChannels = await getVerifiedChannels(db);
    for (const [field, value] of [['body', text], ['title', title]]) {
      if (findUnverifiedChannels(value, verifiedChannels).length > 0) {
        return badRequest(res, `${field} contains an unverified channel`);
      }
    }

    let incidentId;
    if (body.incident_id !== undefined && body.incident_id !== null) {
      incidentId = toId(body.incident_id);
      // The incident may already be resolved; it only has to exist.
      const found = await db.from('incidents').select('id').eq('id', incidentId).maybeSingle();
      if (found.error) throw found.error;
      if (!found.data) return badRequest(res, 'Unknown incident_id');
    } else {
      const active = await getActiveIncident(db);
      if (!active) return badRequest(res, 'No active incident');
      incidentId = active.id;
    }

    const { data, error } = await db
      .from('advisories')
      .insert({ incident_id: incidentId, title, body: text, status: body.status })
      .select(ADVISORY_COLUMNS)
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
