import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';

const router = Router();

// GET /api/technicians -> [{ id, name }]
router.get('/technicians', async (req, res, next) => {
  try {
    const { data, error } = await getSupabase().from('technicians').select('id, name').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
