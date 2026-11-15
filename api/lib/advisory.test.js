import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTemplateDraft,
  containsCredentialRequest,
  findUnverifiedChannels,
  generateAdvisory,
} from './advisory.js';

const services = [
  { name: 'Online Banking', status: 'down', severity: 'critical' },
  { name: 'Mobile App', status: 'degraded', severity: 'high' },
];
const channels = [
  { name: 'Hotline', type: 'phone', contact: '+60 3-1234 5678' },
  { name: 'Site', type: 'website', contact: 'https://bank.example.com/help' },
  { name: 'Mail', type: 'email', contact: 'help@bank.example.com' },
];

test('template names services, channels, and is safe', () => {
  const { title, body } = buildTemplateDraft({ affectedServices: services, verifiedChannels: channels });
  assert.ok(title);
  for (const s of services) assert.ok(body.includes(s.name));
  for (const c of channels) assert.ok(body.includes(c.contact));
  assert.ok(!/\{\{|undefined/.test(body));
  assert.equal(containsCredentialRequest(body), false);
  assert.deepEqual(findUnverifiedChannels(body, channels), []);
});

test('credential request detection', () => {
  assert.equal(containsCredentialRequest('Please send your OTP to us.'), true);
  assert.equal(containsCredentialRequest('Never share your PIN.'), false);
  assert.equal(containsCredentialRequest('We are fixing things.'), false);
});

test('unverified channels are found', () => {
  const out = findUnverifiedChannels('Call 0123456789 or visit http://evil.com or a@b.com', channels);
  assert.equal(out.length, 3);
});

test('no key returns template without fallback', async () => {
  const r = await generateAdvisory({ affectedServices: services, verifiedChannels: channels, llmKey: '' });
  assert.equal(r.source, 'template');
  assert.equal(r.fallback, false);
});

test('good LLM output is used', async () => {
  const llmClient = async () => 'Title here\n\nOnline Banking is down. Call +60 3-1234 5678.';
  const r = await generateAdvisory({ affectedServices: services, verifiedChannels: channels, llmKey: 'k', llmClient });
  assert.equal(r.source, 'llm');
  assert.equal(r.title, 'Title here');
  assert.equal(r.fallback, false);
});

test('throw, empty, credential and unverified channel all fall back', async () => {
  const outputs = [
    async () => { throw new Error('boom'); },
    async () => '   ',
    async () => 'T\n\nPlease enter your password now.',
    async () => 'T\n\nCall 0199999999 today.',
  ];
  for (const llmClient of outputs) {
    const r = await generateAdvisory({ affectedServices: services, verifiedChannels: channels, llmKey: 'k', llmClient });
    assert.equal(r.source, 'template');
    assert.equal(r.fallback, true);
  }
});
