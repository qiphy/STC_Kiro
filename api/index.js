import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import servicesRouter from './routes/services.js';
import incidentsRouter from './routes/incidents.js';
import tasksRouter from './routes/tasks.js';
import techniciansRouter from './routes/technicians.js';
import advisoriesRouter from './routes/advisories.js';
import notificationsRouter from './routes/notifications.js';
import publicRouter from './routes/public.js';

// Fail fast, naming the missing variables but never printing values.
const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

// The browser talks to the Vite origin (which proxies /api); allow only that origin.
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/services', servicesRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/technicians', techniciansRouter);
app.use('/api/advisories', advisoriesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/public', publicRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Never send stack traces or internals to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  console.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Vercel imports the app; locally we start a server.
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

export default app;
