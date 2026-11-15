# CyberRescue AI - corrected Supabase test dataset

Aligned to uploaded requirements.md (Requirement 15) and design.md.

## Files
- `supabase/schema.sql`: 9 tables, constraints, transactional simulation/reset/task-update RPCs.
- `supabase/seed.sql`: normal baseline: **8 services** (the exact seven required plus Database Service), **9 acyclic dependencies**, **4 fictional technicians**, **3 verified alternative channels**, **1 deliberately unverified channel**, **zero incidents, tasks, advisories, notifications**.

## Run
1. Use a **new, dedicated Supabase demo project**. These scripts are not for production.
2. In Supabase SQL Editor run `schema.sql`, then `seed.sql`.
3. Open the dashboard. All eight services should be `operational`; no incident should be active.
4. Click the app's **Simulate attack** button (calls `POST /api/incidents/simulate`). It should create one active incident, five affected services, and ten tasks.
5. Assign/update tasks, generate a draft advisory, publish after review, and send **simulated** notifications through the app. Finish every task to resolve the incident.
6. Click **Reset** while an incident is active to return to baseline. Note that per requirement 4.8, reset with no active incident is a no-op.

## Optional SQL smoke tests (run one at a time)
```sql
select name,status,severity from services order by name;
select count(*) as services from services; -- 8
select count(*) as dependencies from service_dependencies; -- 9
select count(*) as technicians from technicians; -- 4
select count(*) as verified_channels from alt_channels where verified; -- 3
select count(*) as incidents from incidents; -- 0
select * from simulate_attack();
select count(*) as affected_services from incident_services; -- 5
select count(*) as tasks from tasks; -- 10
-- Calling simulate_attack() again should raise 'Incident already active'.
select * from reset_demo();
```

## Important distinctions
- Do not load a pre-existing active incident into `seed.sql`: the requirement explicitly requires zero incidents at baseline. The attack is created by the `simulate_attack()` RPC.
- No real bank, customer, login, OTP or credential data is included. All contact points use reserved example domains or fictional numbers.
- The unverified channel is a negative test fixture. Public API and advisory generation must filter it out.
- This bundle provides database data and RPCs, not the React UI, Express endpoints or tests. Run application integration tests before presenting.
- `schema.sql` uses `CREATE TABLE IF NOT EXISTS` and is intended for an empty project; if you have an existing incompatible schema, review/migrate it instead of assuming the file will alter old columns.
