-- BASELINE ONLY: exactly 8 services (7 specified plus Database Service), no incidents/tasks/notices.
-- Transaction ensures all-or-nothing loading. Intended for dedicated demo project.
begin;
truncate table notifications,advisories,tasks,incident_services,incidents,service_dependencies,alt_channels,technicians,services cascade;
insert into services(name,description,criticality,customer_impact,status,severity,restored_by_tasks) values
('Online Banking','Browser-based banking portal',5,5,'operational',null,false),
('Mobile App','Customer mobile banking access',5,5,'operational',null,false),
('ATM Network','ATM withdrawals and balance enquiries',4,4,'operational',null,false),
('Card Payments','Debit and card transaction processing',5,5,'operational',null,false),
('Core Banking','Accounts and transaction processing engine',5,5,'operational',null,false),
('Fund Transfer','Domestic transfer processing',5,5,'operational',null,false),
('Customer Support Line','Customer assistance service',3,4,'operational',null,false),
('Database Service','Primary banking data service',5,5,'operational',null,false);
insert into service_dependencies(service_id,depends_on_id)
select a.id,b.id from (values
('Core Banking','Database Service'),('Mobile App','Core Banking'),('Online Banking','Core Banking'),
('Fund Transfer','Core Banking'),('Card Payments','Core Banking'),('ATM Network','Core Banking'),
('Customer Support Line','Database Service'),('Mobile App','Database Service'),('Online Banking','Database Service')) as e(a,b)
join services a on a.name=e.a join services b on b.name=e.b;
insert into technicians(name,role,email) values
('Aina Rahman','Incident Response Lead','aina.rahman@example.com'),
('Daniel Lim','Infrastructure Recovery Engineer','daniel.lim@example.com'),
('Priya Nair','Database Recovery Specialist','priya.nair@example.com'),
('Hafiz Omar','Application Recovery Engineer','hafiz.omar@example.com');
insert into alt_channels(name,type,contact,verified) values
('Demo Customer Hotline','hotline','+1 202-555-0101',true),
('Demo Support Portal','website','https://support.example.com',true),
('Demo Customer Assistance','email','help@example.com',true),
('Unverified Third-Party Link','website','https://unverified.example.net',false);
-- The unverified channel is intentionally present to test public filtering; never show it publicly.
commit;
