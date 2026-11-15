// Customer advisory generation: template draft, optional LLM draft, safety checks.

const LLM_TIMEOUT_MS = 15000;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

const CREDENTIAL_WORDS = /\b(password|pin|otp)\b/i;
const CREDENTIAL_VERBS = /\b(provide|send|enter|share|give|submit|tell|reply)\b/i;
const NEGATION = /\b(never|do not|don't|will not|won't)\b/i;

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+?\d[\d\s\-().]{5,}\d/g;

function cleanList(list) {
  return Array.isArray(list) ? list.filter(Boolean) : [];
}

export function buildTemplateDraft({ affectedServices, verifiedChannels } = {}) {
  const services = cleanList(affectedServices);
  const channels = cleanList(verifiedChannels);

  const serviceLines = services.length
    ? services.map((s) => `- ${s.name}`).join('\n')
    : '- No services are currently affected.';
  const channelLines = channels.length
    ? channels.map((c) => `- ${c.name} (${c.type}): ${c.contact}`).join('\n')
    : '- Please visit your nearest branch.';

  const title = 'Service disruption notice';
  const body = [
    'We are currently experiencing a service disruption. Our teams are working to restore the following services:',
    serviceLines,
    'We apologise for the inconvenience and will share updates as services are restored.',
    'For help, use only these official contact channels:',
    channelLines,
    'Security tips: Never share your OTP, PIN or password with anyone, including bank staff. Do not click links in unexpected messages.',
  ].join('\n');

  return { title, body };
}

export function containsCredentialRequest(text) {
  if (typeof text !== 'string') return false;
  return text
    .split(/[.!?\n]+/)
    .some((s) => CREDENTIAL_WORDS.test(s) && CREDENTIAL_VERBS.test(s) && !NEGATION.test(s));
}

function normalise(value, kind) {
  const v = String(value).trim();
  if (kind === 'phone') return v.replace(/\D/g, '');
  return v.toLowerCase().replace(/[.,;:!?]+$/, '').replace(/\/+$/, '');
}

export function findUnverifiedChannels(text, verifiedChannels) {
  if (typeof text !== 'string') return [];
  const verified = cleanList(verifiedChannels).map((c) => String(c.contact ?? ''));
  const known = new Set();
  for (const c of verified) {
    known.add(normalise(c, 'text'));
    known.add(normalise(c, 'phone'));
  }
  known.delete('');

  const found = [];
  const urls = text.match(URL_RE) || [];
  const emails = text.match(EMAIL_RE) || [];
  const rest = text.replace(URL_RE, ' ').replace(EMAIL_RE, ' ');
  const phones = (rest.match(PHONE_RE) || []).filter((p) => p.replace(/\D/g, '').length >= 7);

  for (const u of urls) if (!known.has(normalise(u, 'text'))) found.push(u);
  for (const e of emails) if (!known.has(normalise(e, 'text'))) found.push(e);
  for (const p of phones) if (!known.has(normalise(p, 'phone'))) found.push(p.trim());
  return found;
}

export function createOpenAIClient(apiKey) {
  return async function generate({ affectedServices, verifiedChannels }) {
    const services = cleanList(affectedServices)
      .map((s) => `${s.name} (status: ${s.status}, severity: ${s.severity})`)
      .join('; ');
    const channels = cleanList(verifiedChannels)
      .map((c) => `${c.name} (${c.type}): ${c.contact}`)
      .join('; ');
    const system =
      'You write short customer advisories for a bank during a service disruption. ' +
      'Never ask customers for passwords, PINs or OTPs. ' +
      'Do not include any phone number, URL or email address other than the verified channels supplied by the user. ' +
      'Reply with the title on the first line, then a blank line, then the body. Plain text only.';
    const user = `Affected services: ${services || 'none'}.\nVerified channels: ${channels || 'none'}.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timer);
    }
  };
}

function parseLlmText(text) {
  const trimmed = text.trim();
  const idx = trimmed.indexOf('\n');
  if (idx === -1) return { title: 'Service disruption notice', body: trimmed };
  const title = trimmed.slice(0, idx).replace(/^#+\s*/, '').replace(/^title:\s*/i, '').trim();
  const body = trimmed.slice(idx + 1).trim();
  return { title: title || 'Service disruption notice', body: body || trimmed };
}

export async function generateAdvisory({ affectedServices, verifiedChannels, llmKey, llmClient } = {}) {
  const template = buildTemplateDraft({ affectedServices, verifiedChannels });
  const templateResult = { ...template, source: 'template', fallback: false };

  const client = llmClient || (llmKey ? createOpenAIClient(llmKey) : null);
  if (!llmKey && !llmClient) return templateResult;
  if (!client) return templateResult;

  const fallback = { ...template, source: 'template', fallback: true };
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), LLM_TIMEOUT_MS);
    });
    const raw = await Promise.race([client({ affectedServices, verifiedChannels }), timeout]);
    const text = typeof raw === 'string' ? raw : raw?.body ? `${raw.title ?? ''}\n\n${raw.body}` : '';
    if (!text.trim()) return fallback;
    if (containsCredentialRequest(text)) return fallback;
    if (findUnverifiedChannels(text, verifiedChannels).length > 0) return fallback;
    return { ...parseLlmText(text), source: 'llm', fallback: false };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
