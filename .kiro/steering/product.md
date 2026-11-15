# Product: Bank Cyber Recovery Platform

A web platform that helps a bank recover from a cyberattack faster. It shows which services are hit, tells the IT team what to restore first, tracks recovery work, and keeps customers informed.

**Scope rule:** This is a 4-hour hackathon MVP. It must run a clean demo. Do not over-design. Use seeded demo data and simulate anything external.

## Users
| User | Needs |
|---|---|
| Bank IT & Cybersecurity Team (incident manager) | See affected services and severity, get a recovery order, assign tasks, send notices |
| IT Recovery Technician | See assigned tasks, update task status |
| Bank Customer | See which services are down, get verified alternative channels and security guidance |

## Core objective
Minimise service disruption, protect affected customers, and restore essential banking services safely and quickly.

## MVP features (build in this order)

### 1. Incident Dashboard (IT team)
- List of banking services (e.g. Online Banking, Mobile App, ATM Network, Card Payments, Core Banking, Fund Transfer, Customer Support Line).
- Each service shows status (`operational`, `degraded`, `down`, `recovering`) and severity (`low`, `medium`, `high`, `critical`).
- Dependency view: a simple list or table showing what each service depends on (e.g. Mobile App -> Core Banking -> Database). No graph library needed.
- **Recovery priority list:** services ranked by a priority score. Score = business criticality + customer impact + number of services that depend on it. Use a plain rule-based formula. Show the reason for each rank in one line. An LLM is optional and must not be required.
- Button to "Simulate attack" that marks a preset set of services as affected, so the demo can start on demand. Include a reset button.

### 2. Customer Protection & Communication
- IT team writes or generates an incident advisory (template by default, optional LLM draft). The IT user reviews it before sending.
- "Notify" action sends to audiences: affected customers, technicians. Sending is **simulated**: store a record in the `notifications` table and show it in a log. No real email or SMS.
- Public customer status page (no login): current service status, latest advisory, verified alternative channels (branch, hotline, other working channel), and short cybersecurity tips (phishing warning, never share OTP, official channels only).

### 3. Recovery Progress & Coordination
- Recovery tasks per affected service: title, assigned technician, status (`todo`, `in_progress`, `done`, `blocked`).
- Technician view: "my tasks" with status update.
- Overall progress bar (done tasks / total tasks) and per-service progress.
- Marking all tasks of a service done sets the service to `operational`.

## Out of scope for the MVP
Real email/SMS delivery, real SIEM or monitoring integration, real authentication and SSO, multi-bank tenancy, audit export, mobile apps, multi-language, real-time websockets (use manual refresh or short polling).

## Demo flow (what we must be able to show)
1. Dashboard is healthy. Click "Simulate attack".
2. Affected services and severity appear, with the recovery priority list.
3. Manager assigns tasks to technicians.
4. Manager generates an advisory and notifies customers and technicians.
5. Customer status page shows the outage, alternative channels and security tips.
6. Technician completes tasks. Progress rises and services return to operational.
7. Manager posts a "restored" update.

## Principles
- Safety of customers first. Customer-facing text must never ask for passwords, PINs or OTPs, and must only list verified channels from the database.
- Keep the UI simple and readable under stress: status colours, big numbers, few clicks.
- Demo data is fictional. Never use real bank names, customer data or credentials.
