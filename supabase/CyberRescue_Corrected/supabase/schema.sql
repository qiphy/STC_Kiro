-- Fictional Bank Cyber Recovery MVP. Run in a dedicated Supabase demo project.
create extension if not exists pgcrypto;
create table if not exists services (id uuid primary key default gen_random_uuid(), name text not null unique, description text, criticality integer not null check (criticality between 1 and 5), customer_impact integer not null check (customer_impact between 1 and 5), status text not null default 'operational' check(status in ('operational','degraded','down','recovering')), severity text check(severity in ('low','medium','high','critical')), restored_by_tasks boolean not null default false);
create table if not exists service_dependencies (service_id uuid not null references services(id) on delete cascade, depends_on_id uuid not null references services(id) on delete cascade, primary key(service_id,depends_on_id), check(service_id <> depends_on_id));
create table if not exists technicians (id uuid primary key default gen_random_uuid(), name text not null, role text not null, email text not null unique);
create table if not exists incidents (id uuid primary key default gen_random_uuid(), title text not null, status text not null check(status in ('active','resolved')), started_at timestamptz not null default now(), resolved_at timestamptz);
create unique index if not exists one_active_incident on incidents(status) where status='active';
create table if not exists incident_services (incident_id uuid not null references incidents(id) on delete cascade, service_id uuid not null references services(id) on delete cascade, primary key(incident_id,service_id));
create table if not exists tasks (id uuid primary key default gen_random_uuid(), incident_id uuid references incidents(id) on delete cascade, service_id uuid not null references services(id), title text not null check(length(trim(title)) between 1 and 200), technician_id uuid references technicians(id), status text not null default 'todo' check(status in ('todo','in_progress','done','blocked')));
create table if not exists advisories (id uuid primary key default gen_random_uuid(), incident_id uuid references incidents(id) on delete cascade, title text not null, body text not null, status text not null check(status in ('draft','published')), created_at timestamptz not null default now());
create table if not exists notifications (id uuid primary key default gen_random_uuid(), incident_id uuid references incidents(id) on delete cascade, audience text not null check(audience in ('customers','technicians')), message text not null check(length(trim(message)) between 1 and 500), sent_at timestamptz not null default now());
create table if not exists alt_channels (id uuid primary key default gen_random_uuid(), name text not null, type text not null, contact text not null, verified boolean not null default false);

-- Transactional RPC: fixed, repeatable attack preset. No customer notices are sent.
create or replace function simulate_attack() returns incidents language plpgsql as $$
declare rec incidents%rowtype; affected text[] := array['Core Banking','Online Banking','Mobile App','Fund Transfer','Card Payments']; svc record;
begin
 if exists(select 1 from incidents where status='active') then raise exception using message='Incident already active', errcode='P0001'; end if;
 insert into incidents(title,status) values ('Simulated ransomware disruption - fictional bank','active') returning * into rec;
 for svc in select id,name from services where name=any(affected) loop
  insert into incident_services(incident_id,service_id) values(rec.id,svc.id);
  update services set status=case when name in ('Core Banking','Online Banking') then 'down' else 'degraded' end, severity=case when name in ('Core Banking','Online Banking') then 'critical' when name='Fund Transfer' then 'high' else 'medium' end, restored_by_tasks=false where id=svc.id;
  insert into tasks(incident_id,service_id,title,technician_id,status)
  values(rec.id,svc.id,'Assess and isolate affected '||svc.name||' components',(select id from technicians order by name limit 1),'todo'),
        (rec.id,svc.id,'Validate recovery and restore '||svc.name,(select id from technicians order by name offset 1 limit 1),'todo');
 end loop;
 if (select count(*) from incident_services where incident_id=rec.id) <> 5 then raise exception 'Expected five preset services'; end if;
 return rec;
end $$;

create or replace function reset_demo() returns boolean language plpgsql as $$
begin
 -- No-op if no active incident (per requirement 4.8).
 if not exists(select 1 from incidents where status='active') then return true; end if;
 delete from incidents; -- cascade removes incident-linked tasks, advisories, notifications and joins
 update services set status='operational',severity=null,restored_by_tasks=false;
 return true;
end $$;

create or replace function update_task_and_recompute(p_task_id uuid, p_patch jsonb) returns tasks language plpgsql as $$
declare t tasks%rowtype; total_count integer; done_count integer; active_count integer; previous_restored boolean;
begin
 if p_patch ? 'status' and (jsonb_typeof(p_patch->'status') <> 'string' or p_patch->>'status' not in ('todo','in_progress','done','blocked')) then raise exception 'Invalid task status'; end if;
 if p_patch ? 'technician_id' and p_patch->>'technician_id' is not null and not exists(select 1 from technicians where id=(p_patch->>'technician_id')::uuid) then raise exception 'Invalid technician'; end if;
 update tasks set status=case when p_patch ? 'status' then p_patch->>'status' else status end,
 technician_id=case when p_patch ? 'technician_id' then (p_patch->>'technician_id')::uuid else technician_id end
 where id=p_task_id returning * into t;
 if not found then raise exception 'Task not found'; end if;
 select count(*),count(*) filter(where status='done'),count(*) filter(where status='in_progress') into total_count,done_count,active_count from tasks where incident_id=t.incident_id and service_id=t.service_id;
 select restored_by_tasks into previous_restored from services where id=t.service_id;
 if total_count>0 and done_count=total_count then
  update services set status='operational',severity=null,restored_by_tasks=true where id=t.service_id;
 elsif active_count>0 or previous_restored then
  update services set status='recovering',restored_by_tasks=false where id=t.service_id;
 end if;
 if t.incident_id is not null and not exists(select 1 from incident_services j join services s on s.id=j.service_id where j.incident_id=t.incident_id and s.status<>'operational') then
  update incidents set status='resolved',resolved_at=now() where id=t.incident_id and status='active';
 end if;
 return t;
end $$;
