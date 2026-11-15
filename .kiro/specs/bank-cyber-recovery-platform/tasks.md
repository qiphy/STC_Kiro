# Implementation Plan: Bank Cyber Recovery Platform

## Overview

Implementation is in JavaScript (React + Vite client, Express API on Vercel, Supabase Postgres), as set in the design. Tasks follow the build order in `structure.md` and are split across four people. Each task title starts with its owner tag.

| Tag | Person | Area |
|---|---|---|
| **[P1]** | Person 1, lead | Repo setup, `supabase/`, `vercel.json`, README, integration, deploy |
| **[P2]** | Person 2, frontend | Everything under `client/` |
| **[P3]** | Person 3, backend | Everything under `api/` except the skeleton and stub routers from task 1.1 |
| **[P4]** | Person 4, tests | Vitest and fast-check tests, smoke test, demo run-through |

How the work runs in parallel:

- Task 1.1 (P1) creates the repo skeleton, `package.json` scripts, `vercel.json`, `.env.example`, and an empty stub router for every file in `api/routes/`. Task 1.4 (P1) writes the API contract (paths, request and response shapes, error codes) into the README from `design.md`. Once these exist, P2, P3 and P4 work independently against the contract.
- P2 builds pages against the contract and can use mock responses until the matching route is live.
- P4 writes tests against the function contracts in `design.md` (test-first, before the lib code lands).
- Test files sit next to the code they test as `api/lib/*.test.js`. This is the only addition to the `structure.md` layout.
- Tasks that write the same file are in different waves in the dependency graph.

## Tasks

- [x] 1. Foundation and contracts (P1 leads, build order step 1)
  - [x] 1.1 [P1] Create repo skeleton and shared config
    - Create the folders and empty files listed in `structure.md`: `api/index.js`, `api/routes/*.js` (each an Express Router stub), `api/lib/*.js` including `status.js`, `client/` Vite app shell, `supabase/`.
    - Root `package.json` with dependencies (react, react-router-dom, express, @supabase/supabase-js, cors, dotenv, vite, concurrently, vitest, fast-check) and scripts `dev` (Vite and API together, non-zero exit naming the failed process), `build`, `test` (`vitest --run`). No ORM, state library or chart library.
    - `api/index.js`: Express app, JSON body limit 100 KB, mount all routers under `/api`, malformed JSON mapped to 400 `{ "error" }`, JSON 404 for unknown `/api/*`, central error handler returning a generic 500, startup check that exits naming missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` without printing values, CORS limited to the Vite origin, `app.listen` only when `VERCEL` is unset, default export of the app.
    - Vite config proxying `/api` to the local API port. `vercel.json` routing `/api/(.*)` to `api/index.js` and serving the client build for other paths.
    - `.env.example` with empty values for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`, `VITE_API_BASE_URL`. Confirm `.env` is in `.gitignore`.
    - _Requirements: 13.2, 13.4, 13.6, 13.7, 14.1, 14.2, 14.4, 14.5, 14.6, 17.1, 17.2, 17.3, 17.5, 18.5, 18.6, 18.7_

  - [x] 1.2 [P1] Write `supabase/schema.sql`
    - Tables `services` (with `restored_by_tasks`), `service_dependencies` (composite key, no self-dependency check), `technicians`, `incidents` (partial unique index on active status), `incident_services`, `tasks`, `advisories`, `notifications`, `alt_channels`, with check constraints and `on delete cascade` for incident links.
    - Postgres functions `simulate_attack()` (fixed preset of five services and their tasks, raises when an incident is active), `reset_demo()`, and `update_task_and_recompute(task_id, patch jsonb)`, each in one transaction.
    - _Requirements: 2.4, 2.5, 4.2, 4.3, 4.4, 4.6, 4.8, 4.9, 12.4, 12.5, 12.6, 12.7, 12.8, 15.1_

  - [x] 1.3 [P1] Write `supabase/seed.sql`
    - Seven required services plus one database service, each with criticality and customer impact 1 to 5 and status `operational`.
    - At least 6 acyclic dependencies including Mobile App → Core Banking → database service. At least 3 technicians and 3 verified alt channels. All data fictional. No incidents, tasks, advisories or notifications. Wrap in one transaction so a failure leaves no partial rows.
    - _Requirements: 2.6, 15.2, 15.3, 15.4, 15.5, 15.6, 15.8_

  - [x] 1.4 [P1] Write the API contract section in `README.md`
    - List every endpoint with method, path, request body, response shape, and status codes (400, 404, 409, 500) copied from `design.md`, using the `{ "error": "message" }` error format.
    - Include the run steps (schema, seed, `.env`, `npm run dev`) as a first draft. P2, P3 and P4 code against this section.
    - _Requirements: 13.3, 16.10_

- [ ] 2. Backend core and priority scoring (P3, with P4 tests; build order step 2)
  - [x] 2.1 [P3] Implement `api/lib/supabase.js` and `api/lib/validate.js`
    - Supabase client from env using the service role key (server only).
    - `validateBody(schema, body)` and enum constants (`TASK_STATUSES`, `AUDIENCES`, advisory statuses). Checks required fields, enums, string length (max 1,000), notification message 1 to 500 after trim, task title 1 to 200. Returns the first invalid field name.
    - _Requirements: 8.2, 8.3, 10.2, 10.9, 13.1, 13.3, 13.5, 14.1_

  - [x] 2.2 [P3] Implement `api/lib/priority.js`
    - `scoreServices(services, dependencies)` returning `{ list, cycleDetected }` with the score formula, topological ordering that puts dependencies first, name tie-break by `<`, cycle fallback, one-line reason under 200 characters, and empty input handling. No I/O, no LLM.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7, 3.8, 3.9_

  - [x] 2.3 [P3] Implement `api/lib/status.js`
    - `progressPercent`, `deriveServiceStatus`, `shouldResolveIncident`, `toPublicStatus` (published advisory with latest `created_at`, verified channels only, no private fields), and the constant `TIPS` array (phishing warning, never share OTP, official channels only).
    - _Requirements: 7.3, 9.1, 9.2, 9.4, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 2.4 [P3] Implement `services.js` and `technicians.js` routes
    - `GET /api/services` returns each service with `dependencies` as a list of names (empty list when none). `GET /api/technicians` returns id and name.
    - _Requirements: 1.3, 2.1, 10.6_

  - [x] 2.5 [P3] Implement `incidents.js` routes
    - `GET /api/incidents/active` returns incident, affected services and the ranked list from `scoreServices` over all dependency edges, or null and empty lists when none is active. Include `cycleDetected`.
    - `POST /api/incidents/simulate` calls the `simulate_attack` RPC and maps the active-incident error to 409. `POST /api/incidents/reset` calls `reset_demo` and succeeds when nothing is active. Failures return a generic 500.
    - _Requirements: 3.5, 3.8, 3.9, 4.2, 4.3, 4.4, 4.6, 4.8, 4.9_

  - [ ] 2.6 [P4] Write `api/lib/priority.test.js` example tests
    - Known three-service example (Core Banking, Mobile App, Online Banking) with expected order and scores. Empty input returns an empty list. Written against the contract so it can run as soon as task 2.2 lands.
    - _Requirements: 3.1, 3.2, 3.3, 3.8, 3.10_

  - [ ] 2.7 [P4] Write property test for the priority score formula
    - **Property 1: Priority score matches the formula**
    - **Validates: Requirements 3.1**
    - Use `fast-check` with `{ numRuns: 100 }` and the tag comment `Feature: bank-cyber-recovery-platform, Property 1`. Add to `api/lib/priority.test.js`.

  - [ ] 2.8 [P4] Write property test for dependency ordering
    - **Property 2: Dependencies rank above all dependents**
    - **Validates: Requirements 3.2, 3.6**
    - Generate acyclic graphs. Check direct and transitive dependents rank lower and ranks run 1 to n.

  - [ ] 2.9 [P4] Write property test for determinism and tie-break
    - **Property 3: Ranking is deterministic and breaks ties by name**
    - **Validates: Requirements 3.3**

  - [ ] 2.10 [P4] Write property test for the reason string
    - **Property 4: Reason string is a bounded single line with the inputs**
    - **Validates: Requirements 3.4**
    - Include service names up to 200 characters.

  - [x] 2.11 [P4] Write property test for cycles
    - **Property 5: Cycles are reported and every service is still ranked**
    - **Validates: Requirements 3.8, 3.9**
    - Use an independent cycle check in the test to compare with `cycleDetected`.

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Client shell and Dashboard (P2; build order step 3)
  - [x] 4.1 [P2] Build the client shell
    - `main.jsx`, `App.jsx` with `useState` role switcher (`manager`, `technician`, `customer`, default `manager`, not persisted), role-based nav, redirect to the role's default page when the current page is not allowed, `/status` always reachable without a role. Routes for all five pages with minimal placeholder page files that later tasks replace.
    - `api.js`: `request(path, options)` using `VITE_API_BASE_URL || '/api'`, 10 s `AbortController` timeout, throws `Error` with the API `error` message.
    - `styles.css` with base layout and badge colours.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 14.2, 14.3, 14.8, 18.5_

  - [x] 4.2 [P2] Build shared components
    - `StatusBadge` and `SeverityBadge` (text badges, unique colour per value), `ProgressBar` (div width, handles 0%), `ServiceCard`, `TaskRow`.
    - _Requirements: 1.2, 12.3, 18.7_

  - [x] 4.3 [P2] Build `Dashboard.jsx`
    - Service cards with status, severity and dependency names (or a "no dependencies" note), priority list (rank, name, score, reason), "no active incident" message, Simulate and Reset buttons disabled while pending, manual refresh, error with retry that keeps old data, empty-state message, dependency load error shown without hiding other content, cycle warning when `cycleDetected` is true.
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.7, 3.6, 3.8, 3.9, 4.1, 4.5, 4.7, 4.10, 16.1, 16.2_

  - [x] 4.4 [P4] Verify the frontend builds and behaves per requirements
    - Depends on tasks 4.3, 5.2, 5.3 and 7.5 being complete. This is a verification task: report defects, do not fix them.
    - Run `npm run build` and record any errors or warnings.
    - Start the Vite dev server with the API not running, and check: the role switcher shows manager (Dashboard, Communication, Recovery), technician (My Tasks) and customer (Status page), and defaults to manager; `/status` loads without a role selected; the Dashboard shows an error with a retry control and keeps its layout; `CustomerStatus` shows "status unavailable" and the security tips; badge colours are unique per value in `StatusBadge` and `SeverityBadge`.
    - Report each defect as a list entry with file and line number. Make no code changes.
    - _Requirements: 1.2, 1.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 9.8, 9.9, 18.5_

- [ ] 5. Tasks, Recovery and My Tasks (P3 API, P2 UI; build order step 4)
  - [x] 5.1 [P3] Implement `tasks.js` routes
    - `GET /api/tasks` with service and technician info. `POST /api/tasks` validates title (1 to 200) and service id, optional technician, starts at `todo`, returns 400 for a missing reference. `PATCH /api/tasks/:id` updates only supplied fields, validates status, returns 404 for a missing task, and calls the `update_task_and_recompute` RPC so service and incident status stay in sync.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.8, 10.9, 10.10, 10.11, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [x] 5.2 [P2] Build `Recovery.jsx`
    - Overall and per-service progress bars (percentages from done over total, 0% when empty), tasks grouped by service, create-task form (title, service, technician) that keeps entered values on error, assignee and status controls sending only changed fields, API errors displayed, "post restored advisory and notification" control when the incident is resolved (dismissable).
    - _Requirements: 10.2, 10.3, 10.4, 10.7, 10.12, 12.1, 12.2, 12.3, 12.9, 16.3, 16.7_

  - [x] 5.3 [P2] Build `MyTasks.jsx`
    - Technician selector, tasks for the chosen technician with title, service name and status, empty state, status select sending `PATCH`, error message with previous status kept on failure.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 5.4 [P4] Write property test for progress percentage
    - **Property 10: Progress percentage is bounded and exact**
    - **Validates: Requirements 12.1, 12.2, 12.3**
    - Create `api/lib/status.test.js`.

  - [ ]* 5.5 [P4] Write property test for service status derivation
    - **Property 11: Service status follows task statuses**
    - **Validates: Requirements 12.4, 12.6**

  - [ ]* 5.6 [P4] Write property test for request validation
    - **Property 12: Request validation accepts exactly the valid bodies**
    - **Validates: Requirements 8.2, 8.3, 10.2, 10.9, 13.1, 13.3**
    - Create `api/lib/validate.test.js`.

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Advisory, notifications and public status (P3 API, P2 UI; build order step 5)
  - [ ] 7.1 [P3] Implement `api/lib/advisory.js`
    - `buildTemplateDraft`, `containsCredentialRequest`, `findUnverifiedChannels`, `generateAdvisory` with injected LLM client, 15 s timeout, template fallback with `fallback: true` when the call fails, is empty, times out or fails a safety check. Template needs no `LLM_API_KEY`.
    - _Requirements: 6.2, 6.3, 6.4, 6.9, 7.1, 7.2, 7.6, 7.7_

  - [ ] 7.2 [P3] Implement `advisories.js` and `notifications.js` routes
    - `POST /api/advisories/generate` (never writes). `POST /api/advisories` validates status and text, rejects credential requests and unverified channels with 400 and the specified messages, stores nothing on rejection. `GET` and `POST /api/notifications` with validation, newest first, no real delivery.
    - _Requirements: 6.1, 6.5, 6.6, 6.7, 6.8, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 7.3 [P3] Implement `public.js` route
    - `GET /api/public/status` without auth, using `toPublicStatus` with services, the latest published advisory, verified channels and tips.
    - _Requirements: 7.3, 9.1, 9.2, 9.7_

  - [x] 7.4 [P2] Build `Communication.jsx`
    - Generate draft, editable form that is not saved until the manager saves as draft or published, fallback notice, validation errors shown with edited text kept, notify form with a confirm prompt (cancel sends nothing and keeps the form), notification log newest first with the new entry added at the top, error handling without adding a log entry, "restored" advisory shortcut after resolution.
    - _Requirements: 6.1, 6.4, 6.5, 6.6, 6.7, 8.1, 8.5, 8.6, 8.7, 8.8, 8.9, 12.9, 16.4, 16.5, 16.9_

  - [x] 7.5 [P2] Build `CustomerStatus.jsx`
    - Public page with service names and statuses, latest published advisory or "No active advisory", verified channels, security tips, 30 s polling, keeps old data and shows a refresh error on failure, first-load failure shows "status unavailable" with the tips and keeps retrying.
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.8, 9.9, 16.6_

  - [ ]* 7.6 [P4] Write property test for credential request detection
    - **Property 6: Credential requests are detected**
    - **Validates: Requirements 7.1, 7.4**
    - Create `api/lib/advisory.test.js`.

  - [ ]* 7.7 [P4] Write property test for unverified channel detection
    - **Property 7: Unverified channels are detected**
    - **Validates: Requirements 7.2, 7.5**

  - [ ]* 7.8 [P4] Write property test for the template draft
    - **Property 8: Template draft is complete and safe**
    - **Validates: Requirements 6.2, 7.1, 7.2**

  - [ ]* 7.9 [P4] Write property test for generated advisory safety
    - **Property 9: Generated advisory is always safe**
    - **Validates: Requirements 6.4, 7.6, 7.7**
    - Stub the LLM client with throw, timeout, empty and arbitrary text outcomes.

  - [ ]* 7.10 [P4] Write property test for the public status shape
    - **Property 13: Public status never leaks private data**
    - **Validates: Requirements 7.3, 9.1, 9.2**
    - Add to `api/lib/status.test.js`.

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Integration, deploy and demo (build order step 6)
  - [x] 9.1 [P4] Write an API smoke test for the demo flow
    - `api/smoke.test.js` runs against a local API URL from an env variable and is skipped when it is unset. Steps follow the demo script: services all operational, simulate (second call returns 409), priority list present, create and assign a task, save a draft advisory (hidden from public status), publish, send a notification, mark tasks `done` and check progress and service status, reset twice, unknown `/api/*` path returns JSON 404.
    - _Requirements: 4.2, 4.4, 4.8, 9.2, 12.4, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 17.5_

  - [ ] 9.2 [P1] Finalize deploy configuration and secret checks
    - Confirm `vercel.json` routes and `package.json` build settings work for one Vercel project. Add an npm script that fails if the built client bundle contains `SERVICE_ROLE` or `LLM_API_KEY`. Confirm `.env.example` matches the variables actually read.
    - _Requirements: 14.1, 14.4, 14.5, 17.3, 17.4_

  - [ ] 9.3 [P1] Finish `README.md`
    - Setup steps, deploy steps, the demo script covering all nine demo steps in order (the manual run-through for P4 to follow), the statement that the role switcher is not authentication and does not restrict API data, and known limitations (RPC rollback, polling only on the status page, simulated notifications).
    - _Requirements: 5.10, 16.10_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP. Properties 1 to 5 (priority scorer) are required and are not marked optional.
- Each task references specific requirements for traceability.
- Manual demo run-through: after task 9.3, P4 follows the README demo script on the deployed URL (and locally), and P1 fixes any gaps. This is a human step and is not a coding task.
- If time runs short, cut from the bottom of the build order (see `structure.md`). Optional properties 6 to 13 go first.
- Fallback noted in the design: if the RPC functions take too long, `update_task_and_recompute` can be replaced by route code using `deriveServiceStatus`. Document this as a known limitation.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1", "2.2", "2.3", "2.6", "4.1"] },
    { "id": 2, "tasks": ["2.4", "2.5", "2.7", "4.2", "5.1", "5.4", "7.1"] },
    { "id": 3, "tasks": ["2.8", "4.3", "5.2", "5.3", "5.5", "7.2", "7.3", "7.6"] },
    { "id": 4, "tasks": ["2.9", "5.6", "7.4", "7.5", "7.7", "7.10"] },
    { "id": 5, "tasks": ["2.10", "4.4", "7.8"] },
    { "id": 6, "tasks": ["2.11", "7.9"] },
    { "id": 7, "tasks": ["9.1", "9.2", "9.3"] }
  ]
}
```
