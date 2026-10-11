import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDotEnv } from './env.js';

// 支持服务目录下 .env 文件(已存在的环境变量优先)
loadDotEnv();

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 8790),
  scenesDir: path.resolve(here, '../scenes'),
  agentProvider: process.env.AGENT_PROVIDER || 'mock',
  mockSigningSecret: process.env.MOCK_SIGNING_SECRET || 'dev-only-secret-change-me',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 24),
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

export const isDevSecret = !process.env.MOCK_SIGNING_SECRET;
