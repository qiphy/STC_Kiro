-- CYBERRESCUE AI: ALL-STATUS DEMO DATA
-- Compatible with CyberRescue_Corrected/supabase/schema.sql
-- WARNING: DELETES existing demo data in the listed tables. Use a dedicated demo project.
-- Run schema.sql first, then run this script in Supabase SQL Editor.
-- All names, incidents, contact details, and notifications are fictional.
BEGIN;
TRUNCATE TABLE notifications, advisories, tasks, incident_services, incidents,
  service_dependencies, alt_channels, technicians, services CASCADE;

INSERT INTO services(name,description,criticality,customer_impact,status,severity,restored_by_tasks) VALUES
 ('Online Banking','Browser-based banking portal',5,5,'down','critical',false),
 ('Mobile App','Customer mobile banking access',5,5,'degraded','high',false),
 ('ATM Network','ATM withdrawals and balance enquiries',4,4,'operational',NULL,true),
 ('Card Payments','Debit and card transaction processing',5,5,'recovering','high',false),
 ('Core Banking','Accounts and transaction processing engine',5,5,'down','critical',false),
 ('Fund Transfer','Domestic transfer processing',5,5,'degraded','medium',false),
 ('Customer Support Line','Customer assistance service',3,4,'operational',NULL,false),
 ('Database Service','Primary banking data service',5,5,'recovering','low',false);

INSERT INTO service_dependencies(service_id,depends_on_id)
SELECT a.id,b.id FROM (VALUES
 ('Core Banking','Database Service'),('Mobile App','Core Banking'),('Online Banking','Core Banking'),
 ('Fund Transfer','Core Banking'),('Card Payments','Core Banking'),('ATM Network','Core Banking'),
 ('Customer Support Line','Database Service'),('Mobile App','Database Service'),('Online Banking','Database Service')
) e(a,b) JOIN services a ON a.name=e.a JOIN services b ON b.name=e.b;

INSERT INTO technicians(name,role,email) VALUES
 ('Aina Rahman','Incident Response Lead','aina.rahman@example.com'),
 ('Daniel Lim','Infrastructure Recovery Engineer','daniel.lim@example.com'),
 ('Priya Nair','Database Recovery Specialist','priya.nair@example.com'),
 ('Hafiz Omar','Application Recovery Engineer','hafiz.omar@example.com');

INSERT INTO alt_channels(name,type,contact,verified) VALUES
 ('Demo Customer Hotline','hotline','+1 202-555-0101',true),
 ('Demo Support Portal','website','https://support.example.com',true),
 ('Demo Customer Assistance','email','help@example.com',true),
 ('Unverified Third-Party Link','website','https://unverified.example.net',false);

-- Exactly one active incident, plus a historical resolved incident.
INSERT INTO incidents(title,status,started_at,resolved_at) VALUES
 ('Demo cyberattack: banking service disruption','active',now()-interval '3 hours',NULL),
 ('Historical demo: ATM service interruption','resolved',now()-interval '14 days',now()-interval '13 days');

INSERT INTO incident_services(incident_id,service_id)
SELECT i.id,s.id FROM (VALUES
 ('Demo cyberattack: banking service disruption','Online Banking'),
 ('Demo cyberattack: banking service disruption','Mobile App'),
 ('Demo cyberattack: banking service disruption','Card Payments'),
 ('Demo cyberattack: banking service disruption','Core Banking'),
 ('Demo cyberattack: banking service disruption','Fund Transfer'),
 ('Demo cyberattack: banking service disruption','Database Service'),
 ('Historical demo: ATM service interruption','ATM Network')
) x(incident_title,service_name)
JOIN incidents i ON i.title=x.incident_title JOIN services s ON s.name=x.service_name;

-- All four task statuses are represented. Keep at least one unfinished task
-- for each non-operational service so the dashboard remains a useful demo.
INSERT INTO tasks(incident_id,service_id,title,technician_id,status)
SELECT i.id,s.id,x.title,t.id,x.task_status FROM (VALUES
 ('Online Banking','Investigate online banking outage','Aina Rahman','in_progress'),
 ('Online Banking','Restore web banking access','Hafiz Omar','blocked'),
 ('Mobile App','Assess mobile application errors','Hafiz Omar','done'),
 ('Mobile App','Validate customer login flow','Daniel Lim','todo'),
 ('Card Payments','Isolate impacted payment components','Daniel Lim','done'),
 ('Card Payments','Restore payment processing','Hafiz Omar','in_progress'),
 ('Core Banking','Assess core transaction engine','Aina Rahman','blocked'),
 ('Core Banking','Validate core transaction recovery','Daniel Lim','todo'),
 ('Fund Transfer','Check transfer service dependencies','Aina Rahman','done'),
 ('Fund Transfer','Confirm transfer service stability','Hafiz Omar','todo'),
 ('Database Service','Recover primary database nodes','Priya Nair','in_progress'),
 ('Database Service','Verify database integrity','Priya Nair','todo')
) x(service_name,title,technician_name,task_status)
JOIN incidents i ON i.title='Demo cyberattack: banking service disruption'
JOIN services s ON s.name=x.service_name
JOIN technicians t ON t.name=x.technician_name;

INSERT INTO tasks(incident_id,service_id,title,technician_id,status)
SELECT i.id,s.id,'Validate restored ATM connectivity',t.id,'done'
FROM incidents i JOIN services s ON s.name='ATM Network'
JOIN technicians t ON t.name='Daniel Lim'
WHERE i.title='Historical demo: ATM service interruption';

-- Published and draft customer advisories. The public page should only show published ones.
INSERT INTO advisories(incident_id,title,body,status,created_at)
SELECT i.id,x.title,x.body,x.advisory_status,now()-x.age FROM (VALUES
 ('Banking service disruption','We are investigating an interruption to selected banking services. Please use verified bank support channels and never share your OTP.','published',interval '2 hours'),
 ('Recovery progress update','Our teams are working to restore affected services. Some payment and mobile banking features may remain limited.','published',interval '45 minutes'),
 ('Internal review: next customer update','Draft message pending approval. Do not publish until recovery details are verified.','draft',interval '10 minutes')
) x(title,body,advisory_status,age)
JOIN incidents i ON i.title='Demo cyberattack: banking service disruption';

-- Notifications are logged as simulated records only: no email/SMS is sent.
INSERT INTO notifications(incident_id,audience,message,sent_at)
SELECT i.id,x.audience,x.message,now()-x.age FROM (VALUES
 ('technicians','Demo alert: recovery incident opened. Review assigned tasks.',interval '2 hours 50 minutes'),
 ('customers','Demo notice: some banking services are temporarily unavailable. Use verified support channels.',interval '2 hours'),
 ('technicians','Demo update: payment and database recovery is in progress.',interval '35 minutes')
) x(audience,message,age)
JOIN incidents i ON i.title='Demo cyberattack: banking service disruption';
COMMIT;

-- Validation: expect 8 services, 2 incidents, 13 tasks, 3 advisories, 3 notifications.
SELECT 'services' AS item, status, count(*) AS total FROM services GROUP BY status ORDER BY status;
SELECT 'severity' AS item, coalesce(severity,'none') AS status, count(*) AS total FROM services GROUP BY severity ORDER BY status;
SELECT 'tasks' AS item, status, count(*) AS total FROM tasks GROUP BY status ORDER BY status;
SELECT 'incidents' AS item, status, count(*) AS total FROM incidents GROUP BY status ORDER BY status;
SELECT 'advisories' AS item, status, count(*) AS total FROM advisories GROUP BY status ORDER BY status;
SELECT 'notifications' AS item, audience AS status, count(*) AS total FROM notifications GROUP BY audience ORDER BY audience;
