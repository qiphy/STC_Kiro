import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();

// The Vite dev server proxies /api, so CORS is only needed for local dev tools.
if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Routes are mounted here as they are built (see .kiro/steering/structure.md):
// app.use('/api/services', servicesRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Never send stack traces or internals to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Vercel imports the app; locally we start a server.
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

export default app;
