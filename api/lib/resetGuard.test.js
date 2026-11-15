import test from 'node:test';
import assert from 'node:assert/strict';
import { checkResetAllowed, projectRefFromUrl, RESET_CONFIRMATION } from './resetGuard.js';

const allowedEnv = {
  ALLOW_DEMO_RESET: 'true',
  RESET_ALLOWED_PROJECT_REF: 'abcd1234',
  SUPABASE_URL: 'https://abcd1234.supabase.co',
};
const confirm = { confirm: RESET_CONFIRMATION };

test('blocked by default when nothing is configured', () => {
  const r = checkResetAllowed({ SUPABASE_URL: 'https://abcd1234.supabase.co' }, confirm);
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
});

test('blocked when ALLOW_DEMO_RESET is not exactly "true"', () => {
  for (const v of ['false', '1', 'TRUE', '', undefined]) {
    assert.equal(checkResetAllowed({ ...allowedEnv, ALLOW_DEMO_RESET: v }, confirm).status, 403);
  }
});

test('blocked when the allowed project ref is missing or different', () => {
  assert.equal(checkResetAllowed({ ...allowedEnv, RESET_ALLOWED_PROJECT_REF: '' }, confirm).status, 403);
  assert.equal(checkResetAllowed({ ...allowedEnv, RESET_ALLOWED_PROJECT_REF: 'other' }, confirm).status, 403);
  assert.equal(checkResetAllowed({ ...allowedEnv, SUPABASE_URL: 'https://zzzz9999.supabase.co' }, confirm).status, 403);
  assert.equal(checkResetAllowed({ ...allowedEnv, SUPABASE_URL: 'https://db.example.com' }, confirm).status, 403);
});

test('allowed environment still needs the confirmation in the body', () => {
  for (const body of [undefined, null, {}, { confirm: 'yes' }, { confirm: true }, 'RESET_DEMO_DATA']) {
    const r = checkResetAllowed(allowedEnv, body);
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
  }
});

test('allowed environment and confirmation passes', () => {
  assert.deepEqual(checkResetAllowed(allowedEnv, confirm), { ok: true });
});

test('client-facing messages never contain the project ref or URL', () => {
  const r = checkResetAllowed({ ...allowedEnv, RESET_ALLOWED_PROJECT_REF: 'other' }, confirm);
  assert.ok(!r.error.includes('abcd1234') && !r.log.includes('abcd1234'));
});

test('projectRefFromUrl', () => {
  assert.equal(projectRefFromUrl('https://abcd1234.supabase.co'), 'abcd1234');
  assert.equal(projectRefFromUrl('https://abcd1234.supabase.co/'), 'abcd1234');
  assert.equal(projectRefFromUrl('http://localhost:54321'), null);
  assert.equal(projectRefFromUrl('nope'), null);
  assert.equal(projectRefFromUrl(undefined), null);
});
