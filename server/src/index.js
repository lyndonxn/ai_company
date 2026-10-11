import express from 'express';
import cors from 'cors';
import { config, isDevSecret } from './config.js';
import { listPublicScenes } from './scenes.js';
import { scenesRouter } from './routes/scenes.js';
import { sessionsRouter } from './routes/sessions.js';
import { getAgentProvider } from './providers/index.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ai-company-server',
    provider: config.agentProvider,
    scenes: 'loaded',
    uptime: process.uptime(),
  });
});

app.use('/api/scenes', scenesRouter);
app.use('/api/sessions', sessionsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] unhandled:', err.message);
  res.status(500).json({ error: 'internal error' });
});

app.listen(config.port, '0.0.0.0', () => {
  const provider = getAgentProvider();
  console.log(`[ai-company-server] listening on http://0.0.0.0:${config.port}`);
  console.log(`[ai-company-server] agent provider: ${provider.name}`);
  console.log(`[ai-company-server] scenes: ${listPublicScenes().map((s) => s.id).join(', ')}`);
  if (provider.name === 'mock' && isDevSecret) {
    console.warn('[ai-company-server] MOCK_SIGNING_SECRET 未设置,使用开发默认值(勿用于生产)');
  }
});
