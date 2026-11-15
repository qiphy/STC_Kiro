import { createClient } from '@supabase/supabase-js';

let client;

// Server only. Uses the service role key, which must never reach the browser.
// The client is created on first use and then reused for every request.
export function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Report which variables are missing by name only, never by value.
    const missing = [];
    if (!url) missing.push('SUPABASE_URL');
    if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (missing.length > 0) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    assertValidProjectUrl(url);

    // No browser session here, so there is nothing to persist or refresh.
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// Turns a Supabase error into an Error that keeps the diagnostic fields
// (code, details, hint) so the central handler in api/index.js can log them.
// Clients still only ever see the generic 500 response.
export function toDbError(label, error) {
  let message = String(error?.message || 'unknown error');
  // An HTML body means the request reached a web page, not the Supabase API.
  if (/^\s*<(!doctype|html)/i.test(message)) {
    message =
      'received an HTML page instead of JSON. SUPABASE_URL probably points at the Supabase dashboard; use the Project URL (https://<project-ref>.supabase.co)';
  } else if (message.length > 300) {
    message = `${message.slice(0, 300)}...`; // keep terminal output readable
  }
  const err = new Error(`${label}: ${message}`);
  err.code = error?.code;
  err.details = typeof error?.details === 'string' ? error.details.slice(0, 300) : error?.details;
  err.hint = error?.hint;
  return err;
}

// SUPABASE_URL must be the project API URL, for example
// https://abcdefgh.supabase.co. Pasting the dashboard address
// (https://supabase.com/dashboard/project/...) makes every query fail with an
// HTML page. The value itself is never included in the error message.
function assertValidProjectUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('SUPABASE_URL is not a valid URL');
  }
  const hint = 'Use the Project URL from Supabase: Project Settings > API (https://<project-ref>.supabase.co).';
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`SUPABASE_URL must start with https://. ${hint}`);
  }
  const host = parsed.hostname;
  if (host === 'supabase.com' || host.endsWith('.supabase.com') || host === 'supabase.io') {
    throw new Error(`SUPABASE_URL points at the Supabase website or dashboard, not your project. ${hint}`);
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(`SUPABASE_URL must not contain a path such as /rest/v1. ${hint}`);
  }
}
