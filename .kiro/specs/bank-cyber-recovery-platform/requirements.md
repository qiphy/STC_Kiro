# Requirements Document

## Introduction

The Bank Cyber Recovery Platform is a web application that helps a fictional bank recover from a cyberattack. It shows which banking services are affected, ranks them for restoration, tracks recovery tasks, and keeps customers informed through simulated notifications and a public status page. The scope is a 4-hour hackathon MVP that runs a clean demo on seeded, fictional data. Anything external (email, SMS, monitoring) is simulated.

## Glossary

- **Platform**: The complete web application, made up of the Client and the API.
- **Client**: The React (Vite, JavaScript) browser application.
- **API**: The Node.js and Express backend, deployed as Vercel serverless functions under `/api`.
- **Database**: The Supabase Postgres database accessed only by the API.
- **Service**: A banking service (for example Online Banking, Core Banking, ATM Network) with a criticality (1-5), customer impact (1-5), status and severity.
- **Service_Status**: One of `operational`, `degraded`, `down`, `recovering`.
- **Severity**: One of `low`, `medium`, `high`, `critical`.
- **Dependency**: A relationship in which one Service (the dependent) requires another Service (the dependency) to function.
- **Dependents_Count**: The number of Services that directly depend on a given Service.
- **Priority_Scorer**: The API module that computes recovery priority scores and reasons.
- **Priority_Score**: `criticality * 3 + customer_impact * 2 + dependents_count * 2`.
- **Priority_List**: The list of affected Services ordered by recovery priority, each with a one-line reason.
- **Incident**: A record with status `active` or `resolved` that groups affected Services and Tasks.
- **Simulated_Attack**: A preset scenario started on demand that marks a fixed set of Services as affected.
- **Task**: A recovery work item with a title, a Service, an assigned Technician and a Task_Status.
- **Task_Status**: One of `todo`, `in_progress`, `done`, `blocked`.
- **Technician**: An IT recovery technician who works on Tasks.
- **Manager**: The incident manager on the bank IT and cybersecurity team.
- **Customer**: A bank customer using the public status page.
- **Role_Switcher**: A Client control that selects the active role (`manager`, `technician`, `customer`).
- **Advisory**: A customer-facing incident message with a title, body and status (`draft`, `published`).
- **Advisory_Generator**: The API module that produces a draft Advisory from a template or, optionally, from an LLM.
- **Notification**: A simulated message record with an audience (`customers`, `technicians`), a message and a sent time.
- **Notification_Log**: The Client view listing stored Notifications.
- **Alt_Channel**: An alternative contact channel (branch, hotline, other working channel) with a `verified` flag.
- **Verified_Channel**: An Alt_Channel whose `verified` flag is true.
- **Status_Page**: The public Client page showing customer-facing status information.
- **Security_Tips**: Short static cybersecurity guidance (phishing warning, never share OTP, use official channels only).
- **Seed_Data**: Fictional demo data loaded from `supabase/seed.sql`.

## Requirements

### Requirement 1: Service Status and Severity Dashboard

**User Story:** As a Manager, I want to see all banking services with their status and severity, so that I can understand the impact of an attack at a glance.

#### Acceptance Criteria

1. WHEN the Manager opens the Dashboard, THE Client SHALL display every Service returned by the API as one row or card showing its name, Service_Status and Severity, within 2 seconds of the API response being received.
2. THE Client SHALL display each Service_Status value (`operational`, `degraded`, `down`, `recovering`) and each Severity value (`low`, `medium`, `high`, `critical`) as a text badge. Each value SHALL have its own badge colour, and no two values within the same set SHALL share a colour.
3. WHEN the Client requests `GET /api/services`, THE API SHALL return every Service within 2 seconds. Each Service SHALL include its name, Service_Status, Severity and a list of the identifiers or names of the Services it depends on. The list SHALL be empty when the Service has no Dependencies.
4. WHEN the Manager activates the manual refresh control, THE Client SHALL request `GET /api/services` again and replace the displayed Service data with the response. The control SHALL be disabled while the request is in progress.
5. IF the `GET /api/services` request fails or does not respond within 10 seconds, THEN THE Client SHALL display an error message indicating that Services could not be loaded and a retry control. The Client SHALL keep any previously displayed Service data visible. WHEN the Manager activates the retry control, THE Client SHALL repeat the request.
6. IF the API returns zero Services, THEN THE Client SHALL display a message indicating that no Services are available.

### Requirement 2: Dependency View

**User Story:** As a Manager, I want to see what each service depends on, so that I can understand how a failure spreads.

#### Acceptance Criteria

1. WHEN the Manager opens the Dashboard, THE Client SHALL display, for each Service, the names of the Services it directly depends on, within 2 seconds of the Dashboard finishing load.
2. IF a Service has no Dependencies, THEN THE Client SHALL display an indication that the Service has no dependencies in place of a dependency name list.
3. THE Client SHALL render the dependency view as a list or table without a graph library.
4. THE Database SHALL store each Dependency as a pair of Service identifiers in the `service_dependencies` table, where the first identifier is the dependent Service and the second is the Service it depends on.
5. IF a Dependency would reference a Service identifier that does not exist, or would pair a Service with itself, THEN THE Database SHALL reject the Dependency and retain all previously stored Dependencies unchanged.
6. THE Seed_Data SHALL include a dependency chain in which Mobile App depends on Core Banking and Core Banking depends on a database service.
7. IF the Client fails to retrieve Dependency data, THEN THE Client SHALL display an error message indicating that dependencies could not be loaded and SHALL continue to display the other Dashboard content.

### Requirement 3: Rule-Based Recovery Priority

**User Story:** As a Manager, I want affected services ranked by a clear rule, so that the team restores the most important services first.

#### Acceptance Criteria

1. WHEN an Incident has one or more affected Services, THE Priority_Scorer SHALL compute the Priority_Score for each affected Service as `criticality * 3 + customer_impact * 2 + dependents_count * 2`, where criticality and customer_impact are integers from 1 to 5 and dependents_count is an integer from 0 to 100.
2. WHEN a Service is a dependency of another affected Service, THE Priority_Scorer SHALL rank that Service above all of its direct and transitive dependents, regardless of Priority_Score.
3. WHEN two Services have equal rank after applying the dependency rule and the Priority_Score, THE Priority_Scorer SHALL order them by Service name in ascending, case-sensitive Unicode code point order.
4. WHEN the Priority_Scorer ranks a Service, THE Priority_Scorer SHALL return a single-line reason string of at most 200 characters that contains the Service's criticality value, customer impact value and Dependents_Count value.
5. WHEN the Client requests `GET /api/incidents/active` and an Incident is active, THE API SHALL return the active Incident, its affected Services and the Priority_List within 2 seconds.
6. WHEN the Dashboard receives a Priority_List, THE Dashboard SHALL display one row per ranked Service, ordered by rank starting at 1, showing rank, Service name, Priority_Score and reason.
7. THE Priority_Scorer SHALL compute Priority_Score and rank without calling an LLM.
8. IF no Incident is active, THEN THE API SHALL return a null Incident, an empty Priority_List and an empty affected Services list, and THE Dashboard SHALL display a message indicating that no Incident is active.
9. IF the dependency relationships among affected Services contain a cycle, THEN THE Priority_Scorer SHALL rank the Services in the cycle by Priority_Score and then by Service name, and SHALL return an error indication identifying that a dependency cycle was detected.
10. THE Platform SHALL include automated tests for the Priority_Scorer covering the formula, the dependency ordering, the tie-break rule, and the empty-Incident case.

### Requirement 4: Simulate Attack and Reset

**User Story:** As a Manager, I want to start and reset a demo attack on demand, so that the demo can be repeated.

#### Acceptance Criteria

1. WHEN the Manager clicks "Simulate attack", THE Client SHALL send `POST /api/incidents/simulate` and disable the "Simulate attack" and "Reset" buttons until a response is received or 10 seconds elapse.
2. WHEN `POST /api/incidents/simulate` is received and no Incident is active, THE API SHALL create exactly one Incident with status `active`, mark the same preset set of at least one Service as affected on every request, assign each affected Service a Service_Status other than `operational` and a Severity, and return a success response containing the created Incident.
3. WHEN `POST /api/incidents/simulate` is received and no Incident is active, THE API SHALL create the same preset recovery Tasks on every request, with at least one Task for each affected Service, each linked to the created Incident and its affected Service.
4. IF `POST /api/incidents/simulate` is received while an Incident is active, THEN THE API SHALL return HTTP 409 with an error message stating that an Incident is already active, and SHALL leave all Incidents, Services, Tasks, Advisories and Notifications unchanged.
5. WHEN the Manager clicks "Reset", THE Client SHALL send `POST /api/incidents/reset` and disable the "Simulate attack" and "Reset" buttons until a response is received or 10 seconds elapse.
6. WHEN `POST /api/incidents/reset` is received, THE API SHALL set every Service to `operational`, delete all Tasks, Advisories and Notifications linked to any Incident, set no Incident to `active`, and return a success response.
7. WHEN the simulate or reset request succeeds, THE Client SHALL reload the Dashboard data and re-enable the buttons.
8. IF `POST /api/incidents/reset` is received while no Incident is active, THEN THE API SHALL return a success response and SHALL leave all data unchanged.
9. IF creating the Incident, Service changes or Tasks fails during `POST /api/incidents/simulate`, or the reset fails part-way through `POST /api/incidents/reset`, THEN THE API SHALL roll back all changes made by that request and return an error response with an error message indicating the operation failed.
10. IF the simulate or reset request returns an error response or receives no response within 10 seconds, THEN THE Client SHALL display an error message indicating the operation failed, keep the currently displayed Dashboard data, and re-enable the buttons.

### Requirement 5: Role Switcher Without Real Authentication

**User Story:** As a demo presenter, I want to switch between manager, technician and customer views, so that I can show each user's experience without logging in.

#### Acceptance Criteria

1. THE Client SHALL provide a Role_Switcher that offers exactly three options: `manager`, `technician` and `customer`.
2. WHEN the Client first loads, THE Client SHALL set the selected role to `manager`.
3. WHEN the presenter selects a role in the Role_Switcher, THE Client SHALL store the selected role in local component state and display the pages for that role within 200 ms, without a page reload and without sending a request to the API.
4. WHILE the selected role is `manager`, THE Client SHALL show navigation to exactly three pages: Dashboard, Communication and Recovery.
5. WHILE the selected role is `technician`, THE Client SHALL show navigation to exactly one page: My Tasks.
6. WHILE the selected role is `customer`, THE Client SHALL show navigation to exactly one page: Status_Page.
7. WHEN the presenter switches roles while viewing a page that is not available to the new role, THE Client SHALL display the default page of the new role (Dashboard for `manager`, My Tasks for `technician`, Status_Page for `customer`).
8. THE Status_Page SHALL be reachable by direct URL without a role having been selected and without any login prompt.
9. IF the presenter reloads the browser, THEN THE Client SHALL reset the selected role to `manager` because the role is not persisted.
10. THE README SHALL state that the Role_Switcher is not real authentication, that the Platform has no login, and that the role selection does not restrict access to API data.

### Requirement 6: Advisory Draft and Manager Review

**User Story:** As a Manager, I want a draft incident advisory that I can review and edit, so that customers receive accurate and safe information.

#### Acceptance Criteria

1. WHEN the Manager requests an advisory draft, THE Client SHALL send `POST /api/advisories/generate`.
2. WHEN `POST /api/advisories/generate` is received and `LLM_API_KEY` is empty, THE Advisory_Generator SHALL return a template draft within 2 seconds. The draft SHALL list every Service currently marked as affected and every Verified_Channel, and SHALL contain no unresolved placeholder text.
3. WHERE `LLM_API_KEY` is set, WHEN `POST /api/advisories/generate` is received, THE Advisory_Generator SHALL request a draft from the LLM and SHALL return the LLM draft within 15 seconds of receiving the request.
4. IF the LLM request fails, returns an empty response, or does not respond within 15 seconds, THEN THE Advisory_Generator SHALL return the template draft from criterion 2 and SHALL indicate to the Client that the template was used as a fallback. The Client SHALL display this indication to the Manager.
5. WHEN the Advisory_Generator returns a draft, THE Client SHALL display the draft in an editable form. The Client SHALL NOT save the Advisory until the Manager chooses to save it.
6. WHEN the Manager saves the Advisory, THE Client SHALL send `POST /api/advisories` with the status `draft` or `published` as chosen by the Manager, and THE API SHALL store the Advisory with that status.
7. IF `POST /api/advisories` is received with a status other than `draft` or `published`, or with empty advisory text, THEN THE API SHALL reject the request with a validation error and SHALL NOT store the Advisory. The Client SHALL keep the Manager's edited text in the form and SHALL display the error.
8. THE Platform SHALL NOT store or publish an LLM-generated draft unless the Manager has saved it through `POST /api/advisories`.
9. WHILE `LLM_API_KEY` is empty, THE Platform SHALL provide all Advisory features (generate, edit, save as `draft` or `published`) using the template alone.

### Requirement 7: Customer-Facing Content Safety

**User Story:** As a bank, I want customer-facing text to be safe, so that customers are protected from fraud during an incident.

#### Acceptance Criteria

1. WHEN the Advisory_Generator produces draft text, THE Advisory_Generator SHALL ensure the draft contains zero requests for a password, PIN or OTP. A request is text containing the word "password", "PIN" or "OTP" (case-insensitive) together with a verb asking the customer to provide, send, enter or share it.
2. WHEN the Advisory_Generator produces draft text, THE Advisory_Generator SHALL include only contact channels (phone numbers, URLs, email addresses) that exist in the Database as Verified_Channels, and SHALL include 0 unverified channels.
3. WHEN the Status_Page is rendered, THE Status_Page SHALL display only Verified_Channels from the Database and SHALL display 0 unverified channels.
4. IF a saved Advisory body contains a request for a password, PIN or OTP (as defined in criterion 1), THEN THE API SHALL reject the request with HTTP 400 and an error message indicating that the body contains a prohibited credential request, and THE API SHALL NOT persist the Advisory.
5. IF an Advisory body submitted to the API contains a contact channel that is not a Verified_Channel, THEN THE API SHALL reject the request with HTTP 400 and an error message indicating that the body contains an unverified channel, and THE API SHALL NOT persist the Advisory.
6. WHERE the Advisory_Generator uses an LLM, THE Advisory_Generator SHALL apply the checks in criteria 1 and 2 to the LLM output before returning it.
7. IF the LLM output fails a check in criterion 1 or 2, or the LLM does not respond within 15 seconds, THEN THE Advisory_Generator SHALL return the template draft instead and SHALL discard the LLM output.

### Requirement 8: Simulated Notifications and Log

**User Story:** As a Manager, I want to notify customers and technicians and see a log of what was sent, so that communication is tracked.

#### Acceptance Criteria

1. WHEN the Manager confirms sending a Notification, THE Client SHALL send `POST /api/notifications` with an audience and a message.
2. WHEN `POST /api/notifications` is received with an audience of `customers` or `technicians` and a message of 1 to 500 characters after trimming leading and trailing whitespace, THE API SHALL store a Notification with the audience, the message and the current time in the `notifications` table and return the stored Notification within 2 seconds.
3. IF `POST /api/notifications` is received with a missing or unrecognised audience, or with a message that is empty, whitespace-only or longer than 500 characters, THEN THE API SHALL reject the request, store no Notification and return an error identifying the invalid field.
4. THE API SHALL deliver no real email or SMS.
5. WHEN the Manager opens the Notification_Log, THE Notification_Log SHALL list all stored Notifications with audience, message and sent time, ordered by sent time with the newest first.
6. WHEN the API returns a stored Notification, THE Client SHALL add it as the first entry of the Notification_Log within 1 second, without a page reload.
7. WHEN the Manager chooses to send a Notification, THE Client SHALL display a confirmation prompt showing the audience and message, and SHALL send the request only after the Manager confirms.
8. IF the Manager cancels the confirmation prompt, THEN THE Client SHALL send no request, close the prompt and keep the entered audience and message in the form.
9. IF `POST /api/notifications` fails or does not respond within 10 seconds, THEN THE Client SHALL display an error message indicating the Notification was not sent, add no entry to the Notification_Log and keep the entered audience and message in the form.

### Requirement 9: Public Customer Status Page

**User Story:** As a Customer, I want a public page showing which services are down and how to reach the bank, so that I know what to do during an outage.

#### Acceptance Criteria

1. WHEN the Client requests `GET /api/public/status` without credentials, THE API SHALL return within 2 seconds a response containing the name and Service_Status of every Service, the single published Advisory with the most recent creation time, all Verified_Channels, and all Security_Tips.
2. THE API SHALL exclude `draft` Advisories, criticality, customer impact, Task data and Technician data from every `GET /api/public/status` response.
3. WHEN the Status_Page receives a successful response from `GET /api/public/status`, THE Status_Page SHALL display each Service name with its Service_Status, the latest published Advisory, all Verified_Channels and all Security_Tips.
4. THE Status_Page SHALL display Security_Tips that include a phishing warning, a statement to never share an OTP, and a statement to use official channels only.
5. IF no Advisory has been published, THEN THE Status_Page SHALL display the message "No active advisory" in place of the Advisory and SHALL continue to display Service names with Service_Status, Verified_Channels and Security_Tips.
6. WHILE the Status_Page is open, THE Client SHALL request `GET /api/public/status` every 30 seconds and update the displayed data within 2 seconds of receiving each successful response.
7. THE Status_Page SHALL be viewable without login, and THE API SHALL serve `GET /api/public/status` without requiring authentication.
8. IF a request to `GET /api/public/status` fails or does not respond within 10 seconds, THEN THE Status_Page SHALL keep the previously displayed data, display an error indication that the data could not be refreshed, and retry at the next 30-second interval.
9. IF the Status_Page cannot load data on its first request, THEN THE Status_Page SHALL display an error indication that status information is unavailable, display the Security_Tips, and retry every 30 seconds.

### Requirement 10: Recovery Tasks

**User Story:** As a Manager, I want to create and assign recovery tasks per service, so that the team knows who is doing what.

#### Acceptance Criteria

1. WHEN the Client requests `GET /api/tasks`, THE API SHALL return all Tasks, each with its identifier, title, Service, assigned Technician (or an empty value if unassigned) and Task_Status, within 2 seconds.
2. WHEN the Manager submits a new Task, THE Client SHALL send `POST /api/tasks` with a title of 1 to 200 characters, a Service identifier and an optional Technician identifier.
3. WHEN the API receives a valid `POST /api/tasks` request, THE API SHALL persist the Task with an initial Task_Status of `todo` and return the created Task, and the Recovery page SHALL show the new Task within 2 seconds.
4. WHEN the Manager changes a Task assignee or Task_Status, THE Client SHALL send `PATCH /api/tasks/:id` containing only the changed fields.
5. WHEN the API receives a valid `PATCH /api/tasks/:id` request, THE API SHALL update only the fields supplied, return the updated Task, and the Recovery page SHALL show the change within 2 seconds.
6. WHEN the Client requests `GET /api/technicians`, THE API SHALL return all Technicians, each with its identifier and name.
7. THE Recovery page SHALL display Tasks grouped by Service, showing a group for each Service that has at least one Task, with each Task listing its title, assigned Technician and Task_Status.
8. IF a `POST` or `PATCH` request references a Service or Technician that does not exist, THEN THE API SHALL return HTTP 400 with an error message identifying the invalid reference, and SHALL leave stored Tasks unchanged.
9. IF a `POST /api/tasks` request has a missing title, an empty title, a title longer than 200 characters, or a missing Service identifier, THEN THE API SHALL return HTTP 400 with an error message identifying the invalid field, and SHALL NOT create a Task.
10. IF a `PATCH /api/tasks/:id` request supplies a Task_Status that is not a defined Task_Status value, THEN THE API SHALL return HTTP 400 with an error message identifying the invalid value, and SHALL leave the Task unchanged.
11. IF `PATCH /api/tasks/:id` references a Task that does not exist, THEN THE API SHALL return HTTP 404 with an error message, and SHALL leave stored Tasks unchanged.
12. IF a Task request fails, THEN THE Client SHALL display the error message returned by the API on the Recovery page and SHALL retain the Manager's entered form values.

### Requirement 11: Technician My Tasks View

**User Story:** As a Technician, I want to see my assigned tasks and update their status, so that the manager sees my progress.

#### Acceptance Criteria

1. WHILE the selected role is `technician`, THE Client SHALL provide a control listing every Technician, so that one Technician can be chosen as the acting Technician.
2. WHEN a Technician is chosen, THE Client SHALL display only the Tasks assigned to that Technician, each with its title, Service name and current Task_Status, within 1 second of the Task data being available.
3. IF the chosen Technician has no assigned Tasks, THEN THE Client SHALL display an empty-state message indicating that no Tasks are assigned.
4. WHEN the Technician selects a new Task_Status from `todo`, `in_progress`, `done` or `blocked`, THE Client SHALL send `PATCH /api/tasks/:id` with the new Task_Status.
5. WHEN the `PATCH /api/tasks/:id` request succeeds, THE Client SHALL display the new Task_Status on that Task without a page reload.
6. IF the `PATCH /api/tasks/:id` request fails or does not respond within 10 seconds, THEN THE Client SHALL display an error message indicating the update failed and SHALL keep displaying the previous Task_Status.

### Requirement 12: Recovery Progress and Service Restoration

**User Story:** As a Manager, I want overall and per-service progress, and I want services to return to operational when their work is done, so that I can see recovery advance.

#### Acceptance Criteria

1. WHEN the Recovery page loads or any Task's Task_Status changes, THE Recovery page SHALL display an overall progress bar whose value equals the count of `done` Tasks divided by the count of all Tasks of the active Incident, multiplied by 100 and rounded to the nearest whole percent (0 to 100), and SHALL update the bar within 2 seconds of the change.
2. WHEN the Recovery page loads or any Task's Task_Status changes, THE Recovery page SHALL display a progress bar for each affected Service whose value equals that Service's `done` Tasks divided by its total Tasks, multiplied by 100 and rounded to the nearest whole percent (0 to 100), and SHALL update the bar within 2 seconds of the change.
3. IF the active Incident has zero Tasks, or an affected Service has zero Tasks, THEN THE Recovery page SHALL display the corresponding progress bar at 0% and SHALL NOT display an error or a non-numeric value.
4. WHEN all Tasks of a Service have Task_Status `done` and the Service has at least 1 Task, THE API SHALL set that Service to `operational` and SHALL record that the change resulted from Task completion.
5. WHEN a Task of a Service changes from `done` to another Task_Status and the Service is `operational` because of Task completion, THE API SHALL set the Service to `recovering`.
6. WHEN at least one Task of an affected Service has Task_Status `in_progress` and the Service is not `operational`, THE API SHALL set the Service to `recovering`.
7. WHEN all Services affected by the active Incident are `operational`, THE API SHALL set the Incident status to `resolved` and record `resolved_at` as the current UTC timestamp, in the same operation as the final Service status change.
8. IF the API fails to persist a Service or Incident status change, THEN THE API SHALL return an error response indicating the failure and SHALL leave the Task, Service, and Incident statuses as they were before the triggering request.
9. WHEN the Incident status becomes `resolved`, THE Client SHALL display, within 2 seconds, a control that lets the Manager post a "restored" Advisory and Notification, and SHALL keep the control available until the Manager posts it or dismisses it.

### Requirement 13: API Validation and Error Format

**User Story:** As a developer, I want consistent request validation and error responses, so that the Client can handle failures predictably.

#### Acceptance Criteria

1. WHEN the API receives a request with a JSON body, THE API SHALL check that every required field of the target resource is present and non-null, that each enum field holds one of its allowed values, and that each string field is at most 1,000 characters long before performing any Database write.
2. IF the request body is not valid JSON, is empty where a body is required, or exceeds 100 KB, THEN THE API SHALL return HTTP 400 and a JSON body of the form `{ "error": "message" }` with a message indicating the body is malformed or too large, and THE API SHALL leave the Database unchanged.
3. IF validation of a required field, enum field, or string length fails, THEN THE API SHALL return HTTP 400 and a JSON body of the form `{ "error": "message" }` whose message names the first invalid field, and THE API SHALL leave the Database unchanged.
4. IF an unexpected error occurs, THEN THE API SHALL return HTTP 500 and a JSON body of the form `{ "error": "message" }` whose message contains no stack trace, file path, or secret value, and THE API SHALL leave the Database unchanged for the failed request.
5. THE API SHALL access the Database only through supabase-js query methods and SHALL NOT build SQL from request values by string concatenation or interpolation.
6. THE API SHALL organise each resource in its own route file and SHALL keep scoring and advisory logic in `api/lib/`.
7. WHERE the Platform runs in local development, THE API SHALL enable CORS for the local Client origin only, and SHALL NOT send CORS allow headers for any other origin.

### Requirement 14: Secrets and Environment Handling

**User Story:** As a developer, I want secrets kept out of the code and the browser, so that the project is safe to publish.

#### Acceptance Criteria

1. THE API SHALL read `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `LLM_API_KEY` from environment variables, and THE Client bundle SHALL contain none of these three variable names or values.
2. THE Client SHALL read only environment variables whose names begin with `VITE_`.
3. WHERE `VITE_API_BASE_URL` is not set, THE Client SHALL use `/api` as the API base URL.
4. THE Platform SHALL list `.env` in `.gitignore` so that `git status` does not show a `.env` file as untracked or tracked.
5. THE Platform SHALL provide `.env.example` containing every environment variable name used by the API and the Client, each with an empty value, and no secret value.
6. IF `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing or empty at API startup, THEN THE API SHALL fail to start and SHALL report an error that names each missing variable and does not print any variable value. `LLM_API_KEY` is optional and an empty value SHALL NOT prevent startup.
7. THE API SHALL NOT include the value of `SUPABASE_SERVICE_ROLE_KEY` or `LLM_API_KEY` in any log entry or in any error response body.
8. THE Client SHALL send requests only to the API base URL and SHALL NOT send any request to the Database host.

### Requirement 15: Database Schema and Seed Data

**User Story:** As a developer, I want a rebuildable database with fictional data, so that the demo can be recreated in minutes.

#### Acceptance Criteria

1. THE Platform SHALL provide `supabase/schema.sql` that creates the tables `services`, `service_dependencies`, `technicians`, `incidents`, `incident_services`, `tasks`, `advisories`, `notifications` and `alt_channels` with the columns defined in the technical steering file.
2. THE Platform SHALL provide `supabase/seed.sql` that loads Seed_Data.
3. THE Seed_Data SHALL include exactly these seven Services: Online Banking, Mobile App, ATM Network, Card Payments, Core Banking, Fund Transfer and Customer Support Line, each with an integer criticality from 1 to 5 and an integer customer impact from 1 to 5, plus any database service needed for the dependency chain in Requirement 2.
4. THE Seed_Data SHALL include at least 3 Technicians, at least 3 Alt_Channels with verified status set to true, and at least 6 Service dependencies in which every referenced Service exists and no Service depends on itself, directly or through a cycle.
5. THE Seed_Data SHALL set the status of every Service to `operational` and SHALL contain 0 Incidents, 0 Tasks, 0 Advisories and 0 Notifications.
6. THE Seed_Data SHALL contain only fictional names, emails and contact details, and SHALL contain 0 real bank names, 0 real customer records and 0 credentials.
7. WHEN `supabase/schema.sql` and then `supabase/seed.sql` are run in order against an empty database, THE Platform SHALL complete both scripts without errors in 5 minutes or less.
8. IF `supabase/seed.sql` fails on any statement, THEN THE Platform SHALL report an error identifying the failing statement and SHALL leave 0 partially loaded Seed_Data rows in the database.

### Requirement 16: Demo Flow

**User Story:** As a demo presenter, I want the full recovery story to work end to end, so that I can present it within the hackathon.

#### Acceptance Criteria

1. WHEN the Platform starts with Seed_Data, THE Dashboard SHALL show every Service in Seed_Data with status `operational` and no active Incident within 3 seconds of the Dashboard page load.
2. WHEN the Manager clicks "Simulate attack", THE Dashboard SHALL show, within 3 seconds, each affected Service with its Severity and the Priority_List ordered by recovery priority rank.
3. WHEN the Manager assigns a Task to a Technician, THE Platform SHALL show the Task with its assigned Technician on the Recovery page within 3 seconds.
4. WHEN the Manager generates an Advisory and saves it with status `draft`, THE Platform SHALL keep it unpublished and hidden from the Status_Page until the Manager publishes it.
5. WHEN the Manager sends a Notification to customers or technicians, THE Notification_Log SHALL add one entry for that Notification, showing its audience and sent time, within 3 seconds.
6. WHEN an Advisory is published, THE Status_Page SHALL show the outage, the Verified_Channels and the Security_Tips within 5 seconds of the next Status_Page refresh.
7. WHEN a Technician marks a Task `done`, THE Recovery page SHALL update its progress percentage to the number of `done` Tasks divided by the total Tasks, rounded to the nearest whole percent, within 3 seconds.
8. WHEN all Tasks for a Service are `done`, THE Dashboard SHALL change that Service's status to `operational` within 3 seconds.
9. WHEN every affected Service is `operational` and the Manager publishes a "restored" Advisory, THE Status_Page SHALL show that Advisory as the latest Advisory within 5 seconds of the next Status_Page refresh.
10. THE README SHALL document the setup steps, a demo script covering criteria 1 to 9 in order, and a list of known limitations.

### Requirement 17: Deployment and Local Run

**User Story:** As a developer, I want to run the Platform locally and deploy it with minimal steps, so that I can demo it on a public URL.

#### Acceptance Criteria

1. WHEN a developer runs `npm run dev` from the repository root, THE Platform SHALL start both the Client and the API locally, and SHALL respond to an HTTP request to the Client's local address and to the API's local address within 30 seconds of the command starting.
2. IF `npm run dev` cannot start the Client or the API (for example, because a required port is already in use or a dependency is not installed), THEN THE Platform SHALL exit with a non-zero exit code and print an error indicating which of the two processes failed to start.
3. THE Platform SHALL provide a `vercel.json` file at the repository root that routes requests matching `/api/*` to `api/index.js` and serves the Client build output for all other paths.
4. WHEN a developer deploys the repository to Vercel as a single project, THE Platform SHALL serve the Client at the project's public URL and the API under `/api/*` of the same URL, without requiring a second Vercel project.
5. IF a request is made to a `/api/*` path that the API does not define, THEN THE Platform SHALL return an error response from the API and SHALL NOT return the Client's HTML entry page.

### Requirement 18: MVP Scope Boundaries

**User Story:** As a project lead, I want the scope fixed, so that the team can finish within 4 hours.

#### Acceptance Criteria

1. WHEN a user opens a data view, THE Platform SHALL fetch current data from the API and display it within 2 seconds.
2. THE Platform SHALL update data using manual refresh controls, and THE Status_Page SHALL additionally poll the API every 30 seconds as defined in Requirement 9.
3. IF a polling request or manual refresh fails, THEN THE Platform SHALL keep the previously displayed data and show an error indication that the refresh failed.
4. THE Platform SHALL exclude the following features: real email delivery, real SMS delivery, SIEM or monitoring integration, real authentication, SSO, multi-bank tenancy, audit export, mobile apps, multi-language support and websockets.
5. THE Platform SHALL manage frontend state using only React state and React hooks, with zero state management libraries (such as Redux, MobX, Zustand or Recoil) in the frontend dependencies.
6. THE Platform SHALL access the database without any ORM, with zero ORM packages in the backend dependencies.
7. THE Platform SHALL render all progress indicators and status displays without any chart or graph library, with zero chart or graph packages in the frontend dependencies.