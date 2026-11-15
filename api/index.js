import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import servicesRouter from '../server/routes/services.js';
import techniciansRouter from '../server/routes/technicians.js';
import incidentsRouter from '../server/routes/incidents.js';
import tasksRouter from '../server/routes/tasks.js';
import advisoriesRouter from '../server/routes/advisories.js';
import notificationsRouter from '../server/routes/notifications.js';
import publicRouter from '../server/routes/public.js';

const app = express();

// The browser talks to the Vite origin (which proxies /api); allow only that origin.
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Each router defines its own full path under /api (e.g. /services, /incidents/active).
app.use('/api', servicesRouter);
app.use('/api', techniciansRouter);
app.use('/api', incidentsRouter);
app.use('/api', tasksRouter);
app.use('/api', advisoriesRouter);
app.use('/api', notificationsRouter);
app.use('/api', publicRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Never send stack traces or internals to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  // Log diagnostics server-side only. Never log keys or request headers.
  console.error(err.message);
  if (err.code || err.details || err.hint) {
    console.error({ code: err.code, details: err.details, hint: err.hint });
  }
  if (process.env.NODE_ENV !== 'production' && err.stack) console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Vercel imports the app; locally we start a server.
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

export default app;
