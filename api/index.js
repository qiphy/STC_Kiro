import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import servicesRouter from './routes/services.js';
import techniciansRouter from './routes/technicians.js';
import incidentsRouter from './routes/incidents.js';

const app = express();

// The Vite dev server proxies /api, so CORS is only needed for local dev tools.
if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Each router defines its own full path under /api (e.g. /services, /incidents/active).
app.use('/api', servicesRouter);
app.use('/api', techniciansRouter);
app.use('/api', incidentsRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Never send stack traces or internals to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Invalid request body' });
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
