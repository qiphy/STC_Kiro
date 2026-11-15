# Tech Stack

Keep it simple. Pick the fastest path to a working demo.

## Stack
| Layer | Choice |
|---|---|
| Frontend | React (Vite, JavaScript), React Router, plain CSS or Tailwind |
| Backend | Node.js + Express, runs as Vercel serverless functions under `/api` |
| Database | Supabase (Postgres) |
| Deploy | Vercel (frontend + API in one project) |
| Tools | Git, GitHub, Kiro IDE |

Use JavaScript, not TypeScript, to save time. Do not add other frameworks, state libraries (use React state/hooks), ORMs, or chart/graph libraries unless a feature cannot work without them.

## Secrets and environment
- All secrets live in `.env` (local) and in Vercel project environment variables (deployed).
- `.env` is in `.gitignore`. **Never commit it.** Commit only `.env.example` with empty values.
- Never hard-code keys, never log them, never print them in error responses.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in the backend. The frontend must never receive it. Only variables prefixed `VITE_` reach the browser.

| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | backend | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | backend only | Server-side access |
| `VITE_API_BASE_URL` | frontend | Defaults to `/api` |
| `LLM_API_KEY` | backend, optional | If empty, advisories use templates |

## Architecture
```
React (browser) --HTTP--> Express API (/api) --supabase-js--> Supabase Postgres
```
The frontend calls only our API. It does not talk to Supabase directly. This keeps the service key on the server.

## Data model (Supabase tables)
- `services`: id, name, description, criticality (1-5), status, severity, customer_impact (1-5)
- `service_dependencies`: service_id, depends_on_id
- `technicians`: id, name, role, email (fictional)
- `incidents`: id, title, status (`active`, `resolved`), started_at, resolved_at
- `incident_services`: incident_id, service_id (marks which services are affected)
- `tasks`: id, incident_id, service_id, title, technician_id, status
- `advisories`: id, incident_id, title, body, status (`draft`, `published`), created_at
- `notifications`: id, incident_id, audience (`customers`, `technicians`), message, sent_at (simulated send)
- `alt_channels`: id, name, type, contact, verified (boolean)

Provide `supabase/schema.sql` and `supabase/seed.sql` so the database can be rebuilt in minutes. Seed fictional data only.

## API (REST, JSON)
- `GET /api/services` list with status, severity, dependencies
- `GET /api/incidents/active` current incident, affected services, priority list
- `POST /api/incidents/simulate` start the demo attack
- `POST /api/incidents/reset` reset demo data
- `GET/POST /api/tasks`, `PATCH /api/tasks/:id` list, create, update status or assignee
- `GET /api/technicians`
- `POST /api/advisories/generate` returns a draft (template or LLM)
- `POST /api/advisories`, `POST /api/notifications` save advisory, send simulated notification
- `GET /api/public/status` public customer data: service status, latest published advisory, verified alt channels, tips

## Priority scoring (rule-based)
`score = criticality * 3 + customer_impact * 2 + dependents_count * 2`
Higher score is restored first. A service that others depend on must rank above its dependents. Return a short `reason` string with each result.

## Auth (MVP)
No real login. Use a role switcher in the UI (`manager`, `technician`, `customer`) stored in local state. The customer status page is public. State this limitation in the README. Do not build Supabase Auth unless time remains.

## Conventions
- ES modules, `async/await`, small functions.
- Validate request bodies in the API (check required fields and allowed enum values). Use supabase-js query methods, never string-built SQL.
- Return `{ error: "message" }` with a proper HTTP status on failure. No stack traces to the client.
- Enable CORS only as needed for local dev.
- Write a few tests only for the priority scoring function. Skip other tests for the MVP.

## Local run
```
npm install
npm run dev     # starts Vite and the API locally
```
Deploy: push to GitHub, import the repo in Vercel, add the environment variables, deploy.

## Git
- `main` is always demo-ready. Use short feature branches or commit directly if working solo.
- Small commits with clear messages.
- Before each commit, check that no `.env` file or key is staged.
