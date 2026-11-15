-- RPC functions used by the API. Run in the Supabase SQL editor AFTER schema.sql.
-- Safe to re-run (create or replace). Does not touch table data until called.

create or replace function simulate_attack()
returns setof incidents
language plpgsql
as $$
declare
  new_incident incidents;
begin
  if exists (select 1 from incidents where status = 'active') then
    raise exception 'active incident already exists' using errcode = 'P0409';
  end if;

  insert into incidents (title) values ('Ransomware attack on core banking systems')
    returning * into new_incident;

  insert into incident_services (incident_id, service_id)
    select new_incident.id, id from services
    where name in ('Core Banking', 'Online Banking', 'Mobile App', 'Fund Transfer', 'Card Payments');

  update services set
    status = case name when 'Core Banking' then 'down' when 'Online Banking' then 'down' else 'degraded' end,
    severity = case name when 'Core Banking' then 'critical' when 'Online Banking' then 'high'
                         when 'Mobile App' then 'high' else 'medium' end
  where name in ('Core Banking', 'Online Banking', 'Mobile App', 'Fund Transfer', 'Card Payments');

  insert into tasks (incident_id, service_id, title, technician_id)
    select new_incident.id, s.id, t.title, (select id from technicians where name = t.tech limit 1)
    from (values
      ('Core Banking',  'Restore core banking from clean backup', 'Aiden Park'),
      ('Online Banking','Rebuild and harden web portal',          'Mira Santos'),
      ('Mobile App',    'Rotate API credentials and redeploy',    'Mira Santos'),
      ('Fund Transfer', 'Verify transfer queues before reopening','Luca Ferreira'),
      ('Card Payments', 'Re-establish card authorisation links',  'Luca Ferreira')
    ) as t(svc, title, tech)
    join services s on s.name = t.svc;

  return next new_incident;
end;
$$;

create or replace function reset_demo()
returns void
language plpgsql
as $$
begin
  -- Supabase blocks DELETE without WHERE, so every statement has a predicate.
  update services set status = 'operational', severity = 'low' where true;
  delete from tasks where true;
  delete from advisories where true;
  delete from notifications where true;
  delete from incident_services where true;
  delete from incidents where true;
end;
$$;
