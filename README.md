# Bank Cyber Recovery Platform

Hackathon MVP. A simulated cyber attack hits a fictional bank. The incident manager sees ranked recovery priorities, assigns tasks and sends simulated notices. Customers see a public status page while technicians complete tasks and services return to `operational`.

Stack: React (Vite, JavaScript) client, Express API (Vercel serverless under `/api`), Supabase Postgres. Role switching in the UI is local React state for demo purposes. It is not security.

## Setup

1. Create a Supabase project (free tier is enough).
2. In the Supabase SQL editor, run these files in this order:
   1. `supabase/schema.sql`. Drops and recreates every table and the three functions (`simulate_attack`, `reset_demo`, `update_task_and_recompute`). Use this on a fresh project.
   2. `supabase/seed.sql`. Loads the fictional demo data. It starts with `truncate ... restart identity cascade`, so it wipes all existing rows in the demo tables, then inserts in one transaction (a failure leaves no partial rows).
   3. `supabase/rpc.sql` only if the database already existed and you did not re-run `schema.sql`. It installs the same three functions without dropping tables or deleting rows. After a fresh `schema.sql` it is not needed, but running it again is harmless.
3. Copy `.env.example` to `.env` and fill in:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server only. Never expose to the client. |
| `VITE_API_BASE_URL` | no | Defaults to `/api` |
| `LLM_API_KEY` | no | Google Gemini API key. Empty means template advisories. |
| `GEMINI_MODEL` | no | Gemini model name. Defaults to `gemini-2.5-flash`. |
| `CLIENT_ORIGIN` | no | Allowed CORS origin if the client is served elsewhere. Defaults to `http://localhost:5173`. |
| `PORT` | no | Local API port. Defaults to 3001. Ignored on Vercel. |

4. `npm install` (Node 20.19 or newer).
5. `npm run dev` starts the API on `http://localhost:3001` and Vite on `http://localhost:5173`. Vite proxies `/api` to the API.
6. `npm test` runs the API tests.

## API contract

This section is the contract for the API (P3) and for anyone calling it. It matches what `client/src/api.js` and `client/src/pages/*.jsx` already send and read. Items marked "(defined here)" are not specified in `design.md` and were fixed here.

### Conventions

- Base path `/api`. JSON in, JSON out. Request body limit 100 KB.
- Error format for every failure: `{ "error": "message" }`. The client shows `error` to the user.
- Status codes:

| Code | Meaning |
|---|---|
| 200 | Success (reads, PATCH, reset, simulate, generate) |
| 201 | Created (POST /tasks, /advisories, /notifications) (defined here; the client accepts any 2xx) |
| 400 | Malformed JSON, body over 100 KB, missing or invalid field, bad enum, string over 1,000 characters, unknown task or technician or service reference, unsafe advisory. The message names the first invalid field. Nothing is written. |
| 404 | Task `:id` does not exist, or unknown `/api/*` path (JSON, never HTML) |
| 409 | Simulate while an incident is active |
| 500 | Unexpected failure. Generic message `{ "error": "Operation failed" }`. No stack, no secrets. |

- Ids are Postgres `bigint` and are returned as JSON numbers. Ids in request bodies and in `:id` may be numbers or numeric strings (the client sends strings taken from `<select>` values). The API must coerce numeric strings to integers and answer 400 for anything else. A null `technician_id` means unassigned.
- Timestamps are ISO 8601 strings from Postgres `timestamptz`.
- Where the client accepts either a bare array or a wrapped object (`{ "tasks": [...] }`), the contract below picks one. `GET /api/services` MUST be a bare array because Dashboard only accepts an array.

### Enums

| Field | Values |
|---|---|
| service `status` | `operational`, `degraded`, `down`, `recovering` |
| service `severity` | `low`, `medium`, `high`, `critical`, or `null` when operational |
| task `status` | `todo`, `in_progress`, `done`, `blocked` |
| incident `status` | `active`, `resolved` |
| advisory `status` | `draft`, `published` |
| notification `audience` | `customers`, `technicians` |

### Endpoint summary

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/api/services` | 200 array | 500 |
| GET | `/api/incidents/active` | 200 object | 500 |
| POST | `/api/incidents/simulate` | 200 incident | 409, 500 |
| POST | `/api/incidents/reset` | 200 `{ "ok": true }` | 500 |
| GET | `/api/tasks` | 200 array | 500 |
| POST | `/api/tasks` | 201 task | 400, 500 |
| PATCH | `/api/tasks/:id` | 200 task | 400, 404, 500 |
| GET | `/api/technicians` | 200 array | 500 |
| POST | `/api/advisories/generate` | 200 draft | 500 |
| POST | `/api/advisories` | 201 advisory | 400, 500 |
| GET | `/api/notifications` | 200 array | 500 |
| POST | `/api/notifications` | 201 notification | 400, 500 |
| GET | `/api/public/status` | 200 object | 500 |

### GET /api/services

Request: none. Response (bare array, used by Dashboard, Recovery and MyTasks):

```json
[
  {
    "id": 1,
    "name": "Core Banking",
    "description": "...",
    "criticality": 5,
    "customer_impact": 5,
    "status": "down",
    "severity": "critical",
    "dependencies": ["Database"]
  }
]
```

`dependencies` is an array of service names (from `service_dependencies`, the services this one depends on). `ServiceCard` joins it with commas. Status codes: 200, 500.

### GET /api/incidents/active

Request: none. Always 200 when the database is reachable, including when no incident exists.

```json
{
  "incident": { "id": 7, "title": "...", "status": "active", "started_at": "...", "resolved_at": null },
  "services": [ { "id": 1, "name": "Core Banking", "status": "down", "severity": "critical" } ],
  "priority": [ { "rank": 1, "service_id": 1, "name": "Core Banking", "score": 29, "reason": "Criticality 5, customer impact 5, 3 dependent service(s); score 31" } ],
  "cycleDetected": false
}
```

- `incident` is `null` when there is no active incident; then `services` and `priority` are `[]` and `cycleDetected` is `false`.
- `services` lists the affected services of the incident (from `incident_services`). Recovery uses `services[].id` to decide which services get a progress group.
- `priority` comes from `scoreServices` over the affected services plus all dependency edges. Dashboard reads `rank`, `name`, `score`, `reason`. `reason` is a single line of at most 200 characters.
- Return the most recent active incident only. Once the last task of the last service is done, the incident becomes `resolved` and this endpoint returns `incident: null` (defined here: the schema keeps resolved incidents, but "active" means `status = 'active'`). The client treats `incident === null` or `incident.status === 'resolved'` as "restored" and shows the restored banner.

Status codes: 200, 500.

### POST /api/incidents/simulate

Request: no body. Calls `rpc('simulate_attack')`. Response 200: the incident row `{ "id", "title", "status": "active", "started_at", "resolved_at": null }`.

- 409 `{ "error": "An incident is already active" }` when the RPC raises SQLSTATE `IA409` (message `INCIDENT_ALREADY_ACTIVE`). Supabase exposes it as `error.code === 'IA409'`. Any other RPC error is 500.
- The Dashboard shows the `error` text and re-enables its buttons.

### POST /api/incidents/reset

Request: no body. Calls `rpc('reset_demo')`. Response 200 `{ "ok": true }` (defined here; the client ignores the body). Succeeds with no change when nothing is active, so calling it twice is fine. Status codes: 200, 500.

### GET /api/tasks

Request: none. Optional query `incident_id` is not used by the client and is not required. Response: bare array of all tasks, ordered by `id`:

```json
[ { "id": 12, "incident_id": 7, "service_id": 1, "title": "Isolate affected servers and contain the breach", "technician_id": null, "status": "todo" } ]
```

The client also tolerates `{ "tasks": [...] }`, `service_name`, `service.name`, `technician.id`, but the flat shape above is enough. Recovery and MyTasks read `id`, `title`, `status`, `service_id`, `technician_id`. Status codes: 200, 500.

### POST /api/tasks

Request:

```json
{ "title": "Restore ledger", "service_id": 1, "technician_id": 3 }
```

- `title`: required string, trimmed length 1 to 200.
- `service_id`: required, must exist.
- `technician_id`: optional, must exist when present and not null.
- `incident_id`: not sent by the client. The API uses the active incident (defined here). If there is no active incident, 400 `{ "error": "No active incident" }`.

Response 201: the created task row (same shape as GET /api/tasks items), `status` `todo`. Status codes: 201, 400 (invalid field, unknown service or technician, no active incident), 500.

### PATCH /api/tasks/:id

Request: any non-empty subset of:

```json
{ "status": "in_progress", "technician_id": 3, "title": "New title" }
```

The client sends `{ "status": ... }` or `{ "technician_id": <id or null> }`. Validate `status` against the task enum, `title` 1 to 200 characters, `technician_id` as an existing technician or `null`. An empty patch is 400.

Calls `rpc('update_task_and_recompute', { task_id, patch })`. It updates the task, recomputes service status and resolves the incident when every affected service is operational, all in one transaction. Response 200: the updated task row as returned by the RPC (`row_to_json(tasks)`).

- 404 `{ "error": "Task not found" }` when the RPC raises SQLSTATE `P0002` (message `TASK_NOT_FOUND`). `error.code === 'P0002'`.
- 400 for validation failures and for an unknown technician (foreign key violation, SQLSTATE `23503`).
- 500 for anything else.

Because the RPC returns only the task row, the client refetches `/services` and `/incidents/active` after a PATCH to see status changes.

### GET /api/technicians

Request: none. Response: bare array `[ { "id": 1, "name": "...", "role": "...", "email": "..." } ]`. Status codes: 200, 500.

### POST /api/advisories/generate

Request: `{}` (the client sends an empty object; no field is required). Never writes to the database. Response 200:

```json
{ "title": "...", "body": "...", "source": "template", "fallback": false }
```

`source` is `template` or `llm`. `fallback` is `true` when an LLM draft was discarded and the template was used instead; the client then shows a notice. The draft names the affected services of the active incident and lists only verified channels. With no active incident it still returns a generic template draft (defined here). Status codes: 200, 500.

### POST /api/advisories

Request:

```json
{ "title": "Service disruption", "body": "...", "status": "draft", "incident_id": 7 }
```

- `title`: required string, 1 to 200 characters (defined here; the DB only requires non-null).
- `body`: required string, 1 to 1,000 characters (defined here).
- `status`: `draft` or `published`. Required.
- `incident_id`: optional. When omitted, use the active incident if any. The schema requires `incident_id not null`, so with neither present respond 400 `{ "error": "No active incident" }` (defined here). The Recovery "restored" shortcut passes `incident_id` of the incident it loaded, which may already be resolved. Accept it.

Safety checks run before insert:

- Credential request in `title` or `body` (see `containsCredentialRequest`): 400 with an error message stating the advisory must not ask for passwords, PINs or OTPs.
- Any phone number, URL or email not in the verified channels list: 400 with an error message that names the unverified value.

Response 201: the inserted row `{ "id", "incident_id", "title", "body", "status", "created_at" }`. Status codes: 201, 400, 500.

### GET /api/notifications

Request: none. Response: bare array of the notification log, newest first (`sent_at` desc). The client re-sorts but expects `sent_at`, `audience`, `message`:

```json
[ { "id": 4, "incident_id": 7, "audience": "customers", "message": "...", "sent_at": "..." } ]
```

Status codes: 200, 500.

### POST /api/notifications

Request:

```json
{ "audience": "customers", "message": "We are working on it.", "incident_id": 7 }
```

- `audience`: `customers` or `technicians`.
- `message`: trimmed length 1 to 500.
- `incident_id`: optional. Same rule as advisories: default to the active incident, otherwise 400 `{ "error": "No active incident" }` (defined here).

Sending is simulated. The API only inserts a row; nothing leaves the system. Response 201: the inserted row (same shape as GET items). The client uses `saved.notification || saved`, so return the bare row. Status codes: 201, 400, 500.

### GET /api/public/status

No auth, no private data. Response 200:

```json
{
  "services": [ { "name": "Core Banking", "status": "down" } ],
  "advisory": { "title": "...", "body": "...", "created_at": "..." },
  "channels": [ { "name": "Hotline", "type": "phone", "contact": "+60..." } ],
  "tips": [ "..." ]
}
```

- `services`: every service, name and status only. No criticality, customer impact, severity, tasks or technicians.
- `advisory`: the published advisory with the latest `created_at`, or `null`. Drafts are never returned.
- `channels`: only rows with `verified = true`, fields `name`, `type`, `contact`.
- `tips`: constant array with the phishing warning, the never-share-OTP statement and the official-channels statement.

Status codes: 200, 500.

### Database notes for implementers

- Functions in `supabase/schema.sql`: `simulate_attack()`, `reset_demo()`, `update_task_and_recompute(task_id bigint, patch jsonb)`.
- SQLSTATEs: `IA409` for incident already active (maps to 409), `P0002` for `TASK_NOT_FOUND` (maps to 404).
- Only one active incident at a time (partial unique index on `incidents(status) where status = 'active'`).
- The API uses the service role key, which bypasses RLS. RLS is enabled with no policies to block the public anon key.

## Deploy

Deploy as one Vercel project. `vercel.json` sends `/api/*` to `api/index.js` and serves the client build for every other path.

1. Push the repository to GitHub.
2. In Vercel, import the repository.
3. Under Settings, Environment Variables, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and optionally `LLM_API_KEY`. Never give a secret a `VITE_` prefix, because Vite embeds those in the browser bundle.
4. Deploy. Vercel environment variable changes only apply to new deployments, so redeploy after changing any variable.
5. Before sharing the URL, run `npm run build && npm run check:secrets` locally. The check fails if the built client bundle contains a server secret name or value.
6. Post-deploy checks (replace `<url>` with the deployment URL):
   - `<url>/api/services` returns a JSON array of services.
   - `<url>/api/health` returns `{"ok":true}`.
   - An unknown path such as `<url>/api/nope` returns JSON `{"error":"Not found"}` with status 404, not HTML.
   - `<url>/status` loads the customer status page.
   - Refreshing the browser on `<url>/recovery` still loads the app (no 404).

Note: API code and tests live in `server/`, so `api/index.js` is the only serverless function (Vercel Hobby allows 12).

## Demo script

Run this once by hand before presenting. Start from a freshly seeded database (`seed.sql`) or click **Reset** on the Dashboard. Use the **Role** dropdown in the page header to switch between `manager`, `technician` and `customer`. Open the status page in a second tab, since `/status` is reachable in every role.

1. **Healthy dashboard** (role `manager`, Dashboard). Every service shows `operational` and there is no active incident. Click **Simulate attack**.
2. **Affected services and priority list** (Dashboard). Each affected service appears with its severity, and the recovery priority list shows ranks with a one-line reason each. Click **Refresh** if the view looks stale.
3. **Assign tasks** (Recovery). In the add-task form pick a service and a technician, then click **Add task**. For existing tasks, change the assignee in the assignee dropdown on the task row. The task shows its technician.
4. **Advisory and notices** (Communication). Click **Generate draft**, review and edit the text, then click **Save as draft**. A draft is not visible on the status page. Click **Publish** when ready. In the notification form choose the audience (`customers`, then `technicians`), type a message, click **Send notification**, then **Confirm**. Each send adds one entry to the notification log.
5. **Customer view** (role `customer`, Status page). The page shows the affected services, the published advisory, the verified alternative channels and the security tips. It refreshes every 30 seconds.
6. **Technician work** (role `technician`, My Tasks). Select a technician in **Acting technician**, then change each task's status dropdown to `in_progress` and then `done`. As tasks finish, switch to `manager` and open Recovery to watch the progress percentages rise. When every task of a service is `done`, that service returns to `operational` on the Dashboard.
7. **Restored update** (role `manager`). When every affected service is `operational`, Recovery shows "All services are restored." Click **Post restored advisory and notification**, or write one on Communication via **Prepare restored advisory** and **Publish**. The status page shows it as the latest advisory after its next refresh.
8. **Reset** (Dashboard). Click **Reset** to remove the incident, tasks, advisories and notifications and return to the healthy start state. Click **Simulate attack** again to replay.

The numbered steps map to Requirement 16 criteria 1 to 9: criteria 1 and 2 are steps 1 and 2, 3 is step 3, 4 and 5 are step 4, 6 is step 5, 7 and 8 are step 6, 9 is step 7.

## Role switcher is not authentication

The Role dropdown is local React state that only changes which pages the navigation shows. The Platform has no login, no sessions and no user accounts. Choosing a role does not restrict access to API data: anyone who can reach the site can call every `/api` endpoint, including simulate, reset and notifications. Do not use this platform with real data.

## Known limitations

- Atomic updates rely on the three Postgres functions (`simulate_attack`, `reset_demo`, `update_task_and_recompute`). They give all-or-nothing rollback. If they are not installed, simulate, reset and task updates fail with a 500 `Operation failed` error. Run `schema.sql` or `rpc.sql` to install them.
- Only the customer status page polls (every 30 seconds). All other pages update on their own actions or when you click **Refresh**. There are no websockets.
- Notifications are simulated. Sending writes a row to the `notifications` table and shows it in the log. No real email or SMS is sent.
- All data is fictional. Do not enter real customer data, bank names or credentials.
- The LLM is optional. Without `LLM_API_KEY`, or when the LLM draft fails safety checks, advisories use the built-in template (the client shows a notice when it falls back).
- Moving a task out of `done` after the incident was resolved does not reopen the incident.
- Reset and `seed.sql` delete data. Reset removes incidents, tasks, advisories and notifications. `seed.sql` truncates all demo tables. `schema.sql` drops them.
- No authentication, role-based access control or audit trail (see above).
