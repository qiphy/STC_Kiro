// Fails if the built client bundle contains server-only secret names or values.
// Usage: npm run build && npm run check:secrets
// Never prints secret values, only file paths and the name of the forbidden item.
import 'dotenv/config';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'client', 'dist');

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error('check:secrets FAILED: client/dist does not exist. Run "npm run build" first.');
  process.exit(1);
}

const forbiddenNames = ['SERVICE_ROLE', 'SUPABASE_SERVICE_ROLE_KEY', 'LLM_API_KEY', 'GEMINI'];
const forbiddenValues = [
  ['SUPABASE_SERVICE_ROLE_KEY value', process.env.SUPABASE_SERVICE_ROLE_KEY],
  ['LLM_API_KEY value', process.env.LLM_API_KEY],
].filter(([, v]) => typeof v === 'string' && v.trim().length >= 8);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

let files = 0;
const problems = [];
for (const file of walk(distDir)) {
  files += 1;
  const content = readFileSync(file).toString('latin1');
  const rel = file.slice(root.length + 1);
  for (const name of forbiddenNames) {
    if (content.includes(name)) problems.push(`${rel}: contains "${name}"`);
  }
  for (const [label, value] of forbiddenValues) {
    if (content.includes(value.trim())) problems.push(`${rel}: contains ${label}`);
  }
}

if (problems.length > 0) {
  console.error('check:secrets FAILED:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check:secrets OK: scanned ${files} file(s) in client/dist, no secrets found.`);
