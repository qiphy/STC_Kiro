// Safeguards for the destructive demo reset. Pure logic, no database calls.
//
// POST /api/incidents/reset deletes every incident, task, advisory and
// notification. It only runs when ALL of these are true:
//   1. ALLOW_DEMO_RESET=true on the server (off by default).
//   2. RESET_ALLOWED_PROJECT_REF equals the project ref of SUPABASE_URL, so a
//      server pointed at any other Supabase project can never reset.
//   3. The request body is { "confirm": "RESET_DEMO_DATA" }, so the call must
//      be deliberate even for someone using curl.
// The frontend confirmation dialog is an extra layer, not the safeguard.

export const RESET_CONFIRMATION = 'RESET_DEMO_DATA';

// "https://abcd1234.supabase.co" -> "abcd1234". Returns null if it can't be read.
export function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.supabase.co') ? host.split('.')[0] : null;
  } catch {
    return null;
  }
}

// Returns { ok: true } or { ok: false, status, error, log }.
// `error` is safe to send to the client; `log` is for the server terminal.
export function checkResetAllowed(env, body) {
  if (env.ALLOW_DEMO_RESET !== 'true') {
    return {
      ok: false,
      status: 403,
      error: 'Reset is disabled on this server',
      log: 'Reset blocked: ALLOW_DEMO_RESET is not "true".',
    };
  }

  const allowedRef = (env.RESET_ALLOWED_PROJECT_REF || '').trim();
  const currentRef = projectRefFromUrl(env.SUPABASE_URL || '');
  if (!allowedRef || !currentRef || allowedRef !== currentRef) {
    return {
      ok: false,
      status: 403,
      error: 'Reset is not allowed for this database',
      log: 'Reset blocked: RESET_ALLOWED_PROJECT_REF is missing or does not match the connected Supabase project.',
    };
  }

  const confirm = body !== null && typeof body === 'object' ? body.confirm : undefined;
  if (confirm !== RESET_CONFIRMATION) {
    return {
      ok: false,
      status: 400,
      error: `Reset needs a confirmation: send { "confirm": "${RESET_CONFIRMATION}" }`,
      log: 'Reset blocked: missing confirmation in the request body.',
    };
  }

  return { ok: true };
}
