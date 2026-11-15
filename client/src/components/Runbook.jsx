const GENERIC = [
  'Isolate the affected component to contain the issue.',
  'Confirm a recent clean backup or known-good version exists.',
  'Restore the service from the verified backup or version.',
  'Test the service end to end with a small set of checks.',
  'Monitor logs and alerts for a stable period.',
  'Re-enable normal traffic and notify the incident lead.',
];

const RUNBOOKS = {
  'Core Database': [
    'Isolate the database from the network and stop write traffic.',
    'Verify the latest clean backup and its integrity checks.',
    'Restore the database from the verified backup to a clean instance.',
    'Test data consistency and run read/write sanity queries.',
    'Monitor replication, query latency and error logs.',
    'Re-enable application connections in stages.',
  ],
  'Core Banking': [
    'Isolate the core banking application servers from external access.',
    'Verify the last known-good application build and configuration backup.',
    'Restore the application and its configuration.',
    'Test account lookups and a sample of posting transactions.',
    'Monitor transaction queues and error rates.',
    'Re-enable dependent channels once checks pass.',
  ],
  'Online Banking': [
    'Take the web front end offline behind a maintenance page.',
    'Verify the clean web build and session store backups.',
    'Redeploy the verified build and reset active sessions.',
    'Test sign-in, balance view and a test transfer.',
    'Monitor login failures and response times.',
    'Remove the maintenance page and re-enable access.',
  ],
  'Mobile App': [
    'Disable affected API endpoints used by the mobile app.',
    'Verify the backend release and configuration are clean.',
    'Restore the backend services the app depends on.',
    'Test sign-in and key flows on a test device.',
    'Monitor crash reports and API error rates.',
    'Re-enable the endpoints and confirm app availability.',
  ],
  'ATM Network': [
    'Isolate the ATM switch from the wider network.',
    'Verify the clean switch software image and configuration backup.',
    'Restore the switch and reconnect a pilot group of ATMs.',
    'Test a withdrawal and a balance enquiry on the pilot group.',
    'Monitor terminal heartbeat and transaction declines.',
    'Reconnect remaining ATMs in batches.',
  ],
  'Card Payments': [
    'Pause card authorisation routing to the affected system.',
    'Verify the payment gateway backup and key custody status.',
    'Restore the payment gateway and authorisation services.',
    'Test a small set of test-card authorisations.',
    'Monitor approval rates and settlement queues.',
    'Re-enable card authorisation routing.',
  ],
  'Fund Transfer': [
    'Pause outgoing transfers and hold the queue.',
    'Verify the transfer service backup and queue state.',
    'Restore the transfer service and reconcile pending items.',
    'Test an internal transfer and review the audit trail.',
    'Monitor queue depth and failed transfers.',
    'Release held transfers and re-enable new requests.',
  ],
  'Customer Support Line': [
    'Switch callers to the backup contact route or recorded message.',
    'Verify the telephony and CRM system backups.',
    'Restore the telephony and CRM services.',
    'Test inbound calls and customer record lookup.',
    'Monitor call queues and agent system errors.',
    'Switch calls back to the main line.',
  ],
};

export default function Runbook({ service }) {
  const steps = RUNBOOKS[service] || GENERIC;
  return (
    <details className="runbook">
      <summary>Runbook: {service}</summary>
      <ol>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="runbook-note">General guidance only. Follow your incident lead's instructions.</p>
    </details>
  );
}
