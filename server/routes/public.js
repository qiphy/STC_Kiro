import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { toPublicStatus, TIPS } from '../lib/status.js';

const router = Router();

// GET /api/public/status (no auth) -> customer-safe status.
// Only the columns customers may see are selected; toPublicStatus copies the rest.
router.get('/public/status', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const [services, advisories, channels] = await Promise.all([
      supabase.from('services').select('name, status').order('name'),
      supabase
        .from('advisories')
        .select('title, body, status, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase.from('alt_channels').select('name, type, contact, verified').eq('verified', true).order('id'),
    ]);
    for (const result of [services, advisories, channels]) {
      if (result.error) throw result.error;
    }
    res.json(
      toPublicStatus({
        services: services.data,
        advisories: advisories.data,
        channels: channels.data,
        tips: TIPS,
      }),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
