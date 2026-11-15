// Read-only database check. Run from the project root: npm run check:db
// It never writes, never prints keys, and only reports project references.
import 'dotenv/config';
import { getSupabase } from '../api/lib/supabase.js';

const TABLES = [
  'services',
  'service_dependencies',
  'technicians',
  'incidents',
  'incident_services',
  'tasks',
  'advisories',
  'notifications',
  'alt_channels',
];

// Project reference = first part of https://<ref>.supabase.co
function refFromUrl(url) {
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return null;
  }
}

// A Supabase key is a JWT. Its payload (not secret) names the project and role.
// Only the "ref" and "role" claims are read; the key itself is never printed.
function claimsFromKey(key) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return { ref: payload.ref || null, role: payload.role || null };
  } catch {
    return { ref: null, role: null };
  }
}

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
console.log(`SUPABASE_URL set: ${Boolean(url)}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY set: ${Boolean(key)}`);

const urlRef = refFromUrl(url);
const { ref: keyRef, role: keyRole } = claimsFromKey(key);
console.log(`Project ref from URL: ${urlRef ?? 'unknown'}`);
if (keyRef || keyRole) {
  console.log(`Key belongs to project: ${keyRef ?? 'unknown'}, role: ${keyRole ?? 'unknown'}`);
  if (keyRef && urlRef && keyRef !== urlRef) console.log('PROBLEM: the key and the URL belong to different projects.');
  if (keyRole && keyRole !== 'service_role') console.log('PROBLEM: the key is not the service_role key.');
} else if (key) {
  console.log('Key format not recognised (new-style keys carry no project claim); only the table checks below apply.');
}

let db;
try {
  db = getSupabase();
} catch (err) {
  console.log(`Cannot create client: ${err.message}`);
  process.exit(1);
}

let failed = false;
for (const table of TABLES) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    failed = true;
    const reason = (error.message || '').slice(0, 120);
    console.log(`${table.padEnd(22)} ERROR ${error.code || ''} ${reason}`);
  } else {
    console.log(`${table.padEnd(22)} ${count} rows`);
  }
}

const active = await db.from('incidents').select('id, status, started_at').eq('status', 'active');
if (!active.error) console.log(`Active incidents: ${active.data.length}`);
process.exit(failed ? 1 : 0);
