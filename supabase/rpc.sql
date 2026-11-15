-- =====================================================================
-- Migration: create the three API functions on an EXISTING database.
-- Run in the Supabase SQL Editor. It does NOT drop or recreate tables and does
-- not delete or change any rows. Safe to run more than once.
--
-- What it does, in order:
--   1. Checks that the tables and columns the functions use exist, and stops
--      with a clear message if a table is missing (run schema.sql first).
--   2. Applies three small non-destructive compatibility fixes if they are
--      needed (add services.restored_by_tasks, allow services.severity to be
--      null, add the one-active-incident index).
--   3. (Re)creates simulate_attack(), reset_demo() and
--      update_task_and_recompute(bigint, jsonb), and restricts them to the
--      service role.
-- The function code below is identical to the "Functions" section of schema.sql.
-- This file replaces the older, conflicting version of supabase/rpc.sql.
-- =====================================================================

do $$
declare
  t text;
  c text;
  missing text[] := '{}';
  required text[] := array[
    'services.id', 'services.name', 'services.status', 'services.severity',
    'incidents.id', 'incidents.title', 'incidents.status', 'incidents.started_at', 'incidents.resolved_at',
    'incident_services.incident_id', 'incident_services.service_id',
    'tasks.id', 'tasks.incident_id', 'tasks.service_id', 'tasks.title', 'tasks.technician_id', 'tasks.status',
    'technicians.id', 'advisories.id', 'notifications.id', 'service_dependencies.service_id', 'alt_channels.id'
  ];
begin
  -- Compatibility fixes (only when needed). Each is additive or loosening.
  if to_regclass('public.services') is not null then
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'services' and column_name = 'restored_by_tasks') then
      alter table public.services add column restored_by_tasks boolean not null default false;
      raise notice 'Added services.restored_by_tasks';
    end if;
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'services'
                  and column_name = 'severity' and is_nullable = 'NO') then
      alter table public.services alter column severity drop not null;
      raise notice 'services.severity now allows NULL';
    end if;
  end if;

  if to_regclass('public.incidents') is not null
     and not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'incidents_one_active') then
    if (select count(*) from public.incidents where status = 'active') <= 1 then
      create unique index incidents_one_active on public.incidents (status) where status = 'active';
      raise notice 'Created index incidents_one_active';
    else
      raise notice 'Skipped incidents_one_active: more than one active incident exists. Resolve extras first.';
    end if;
  end if;

  -- Check that everything the functions touch is present.
  foreach t in array array['services', 'service_dependencies', 'technicians', 'incidents',
                           'incident_services', 'tasks', 'advisories', 'notifications', 'alt_channels'] loop
    if to_regclass('public.' || t) is null then
      missing := missing || t;
    end if;
  end loop;
  if array_length(missing, 1) is not null then
    raise exception 'Missing tables: %. Run supabase/schema.sql and supabase/seed.sql first.', array_to_string(missing, ', ');
  end if;

  missing := '{}';
  foreach c in array required || array['services.restored_by_tasks'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = split_part(c, '.', 1)
                      and column_name = split_part(c, '.', 2)) then
      missing := missing || c;
    end if;
  end loop;
  if array_length(missing, 1) is not null then
    raise exception 'Missing columns: %. The tables do not match supabase/schema.sql.', array_to_string(missing, ', ');
  end if;
end $$;

-- Drop any earlier version first. `create or replace` cannot change a function's
-- return type, so a leftover version (for example from supabase/rpc.sql) would
-- make this script fail. Dropping functions does not touch table data.
drop function if exists simulate_attack();
drop function if exists reset_demo();
drop function if exists update_task_and_recompute(bigint, jsonb);

-- Raises SQLSTATE 'IA409' with message 'INCIDENT_ALREADY_ACTIVE' when an incident
-- is already active. The API maps this to HTTP 409.
create or replace function simulate_attack() returns json
language plpgsql as $$
declare
  v_incident incidents;
  v_count int;
begin
  if exists (select 1 from incidents where status = 'active') then
    raise exception 'INCIDENT_ALREADY_ACTIVE' using errcode = 'IA409';
  end if;

  insert into incidents (title) values ('Simulated cyber attack on core banking') returning * into v_incident;

  -- Fixed preset: name, status, severity. Updates the services and links them to
  -- the incident in one statement (no temporary table, which Supabase roles may
  -- not be allowed to create).
  with preset(name, status, severity) as (values
    ('Core Banking',   'down',     'critical'),
    ('Online Banking', 'down',     'high'),
    ('Mobile App',     'degraded', 'medium'),
    ('Fund Transfer',  'down',     'high'),
    ('Card Payments',  'degraded', 'high')
  ),
  updated as (
    update services s
       set status = p.status, severity = p.severity, restored_by_tasks = false
      from preset p
     where s.name = p.name
    returning s.id
  )
  insert into incident_services (incident_id, service_id)
  select v_incident.id, id from updated;

  -- The preset services come from seed.sql. Without them there is nothing to
  -- simulate, so roll the whole call back (the incident insert included).
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'DEMO_SERVICES_MISSING: run supabase/seed.sql first';
  end if;

  -- Preset tasks: at least one per affected service
  insert into tasks (incident_id, service_id, title)
  select v_incident.id, s.id, t.title
    from (values
      ('Core Banking',   'Isolate affected servers and contain the breach'),
      ('Core Banking',   'Restore core ledger from last clean backup'),
      ('Online Banking', 'Rebuild web portal servers from clean images'),
      ('Mobile App',     'Rotate API keys and re-enable mobile gateway'),
      ('Fund Transfer',  'Reconcile queued transfers and re-enable processing'),
      ('Card Payments',  'Re-establish card authorisation link and verify')
    ) as t(service_name, title)
    join services s on s.name = t.service_name;

  return row_to_json(v_incident);
end;
$$;

create or replace function reset_demo() returns void
language plpgsql as $$
begin
  update services set status = 'operational', severity = null, restored_by_tasks = false
   where true;
  delete from tasks where true;
  delete from advisories where true;
  delete from notifications where true;
  delete from incident_services where true;
  delete from incidents where true;
end;
$$;

-- patch may contain: status, technician_id (null allowed), title.
-- Returns the updated task row as json.
create or replace function update_task_and_recompute(task_id bigint, patch jsonb) returns json
language plpgsql as $$
declare
  v_task tasks;
  v_svc services;
  v_total int;
  v_done int;
  v_in_progress int;
begin
  update tasks t
     set status        = case when patch ? 'status' then patch->>'status' else t.status end,
         technician_id = case when patch ? 'technician_id' then (patch->>'technician_id')::bigint else t.technician_id end,
         title         = case when patch ? 'title' then patch->>'title' else t.title end
   where t.id = task_id
   returning * into v_task;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_svc from services where id = v_task.service_id for update;

  select count(*), count(*) filter (where status = 'done'), count(*) filter (where status = 'in_progress')
    into v_total, v_done, v_in_progress
    from tasks where service_id = v_task.service_id and incident_id = v_task.incident_id;

  if v_total >= 1 and v_done = v_total then
    update services set status = 'operational', severity = null, restored_by_tasks = true
     where id = v_svc.id;
  elsif v_in_progress > 0 then
    update services set status = 'recovering', restored_by_tasks = false where id = v_svc.id;
  elsif v_svc.status = 'operational' and v_svc.restored_by_tasks then
    update services set status = 'recovering', restored_by_tasks = false where id = v_svc.id;
  end if;

  -- Resolve the incident when every affected service is operational.
  if not exists (
    select 1 from incident_services isv join services s on s.id = isv.service_id
     where isv.incident_id = v_task.incident_id and s.status <> 'operational'
  ) then
    update incidents set status = 'resolved', resolved_at = now()
     where id = v_task.incident_id and status = 'active';
  end if;

  return row_to_json(v_task);
end;
$$;

-- Only the backend (service role) may call these functions. The anon and
-- authenticated roles used by browsers cannot.
revoke all on function simulate_attack() from public, anon, authenticated;
revoke all on function reset_demo() from public, anon, authenticated;
revoke all on function update_task_and_recompute(bigint, jsonb) from public, anon, authenticated;
grant execute on function simulate_attack() to service_role;
grant execute on function reset_demo() to service_role;
grant execute on function update_task_and_recompute(bigint, jsonb) to service_role;

-- Ask the Supabase API to reload its schema cache so the functions are found.
notify pgrst, 'reload schema';
