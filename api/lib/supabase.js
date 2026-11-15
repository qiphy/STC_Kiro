import { createClient } from '@supabase/supabase-js';

let client;

// Server only. Uses the service role key, which must never reach the browser.
export function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase environment variables are not set');
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
