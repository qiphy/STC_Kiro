-- Fictional demo data only. No real bank names, customers or credentials.
-- Run after schema.sql. Safe to re-run.
-- Single transaction: any failure leaves no partial rows.

begin;

truncate notifications, advisories, tasks, incident_services, incidents,
  service_dependencies, alt_channels, technicians, services restart identity cascade;

insert into services (id, name, description, criticality, customer_impact) values
  (1, 'Core Database',         'Primary ledger database',                 5, 5),
  (2, 'Core Banking',          'Account and transaction processing',      5, 5),
  (3, 'Online Banking',        'Web banking portal',                      4, 5),
  (4, 'Mobile App',            'Customer mobile banking app',             4, 5),
  (5, 'ATM Network',           'Cash machines and cash deposit',          4, 4),
  (6, 'Card Payments',         'Debit and credit card authorisation',     4, 4),
  (7, 'Fund Transfer',         'Domestic and interbank transfers',        4, 4),
  (8, 'Customer Support Line', 'Phone support and account enquiries',     3, 3);

-- service_id depends on depends_on_id
insert into service_dependencies (service_id, depends_on_id) values
  (2, 1),
  (3, 2),
  (4, 2),
  (5, 2),
  (6, 2),
  (7, 2),
  (8, 2);

insert into technicians (id, name, role, email) values
  (1, 'Aiden Park',    'Database Engineer',       'aiden.park@example.com'),
  (2, 'Mira Santos',   'Application Engineer',    'mira.santos@example.com'),
  (3, 'Luca Ferreira', 'Network Engineer',        'luca.ferreira@example.com'),
  (4, 'Noor Haddad',   'Security Analyst',        'noor.haddad@example.com');

insert into alt_channels (name, type, contact, verified) values
  ('Branch counter service', 'branch',  'Visit any open branch with photo ID', true),
  ('Customer hotline',       'hotline', '1-800-555-0142',                      true),
  ('Partner agent cash-out', 'agent',   'Participating partner agents',        true),
  ('Unconfirmed chat number','chat',    '555-0000',                            false);

select setval(pg_get_serial_sequence('services', 'id'),    (select max(id) from services));
select setval(pg_get_serial_sequence('technicians', 'id'), (select max(id) from technicians));

commit;
