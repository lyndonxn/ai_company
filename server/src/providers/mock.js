import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

/**
 * Mock 会话提供方:完全离线可用的开发实现。
 * 真实供应商接入方式见 ./README.md,实现同一组函数并在 index.js 注册即可。
 */

const sessions = new Map();

function b64url(input) {
  return Buffer.from(JSON.stringify(input)).toString('base64url');
}

/** 开发态凭据:payload + HMAC 签名,24h 有效 */
function mintToken(payload) {
  const body = b64url(payload);
  const sig = createHmac('sha256', config.mockSigningSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return false;
  const expected = createHmac('sha256', config.mockSigningSecret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function shortId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export default {
  name: 'mock',

  async startSession({ scene }) {
    const now = Date.now();
    const expiresAt = new Date(now + config.sessionTtlHours * 3600 * 1000);
    const record = {
      sessionId: `sess_${randomUUID()}`,
      sceneId: scene.id,
      roomId: shortId('room'),
      userId: shortId('user'),
      agentId: shortId('agent'),
      provider: this.name,
      createdAt: new Date(now).toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'active',
    };
    record.token = mintToken({
      roomId: record.roomId,
      userId: record.userId,
      exp: Math.floor(expiresAt.getTime() / 1000),
    });
    sessions.set(record.sessionId, record);
    return record;
  },

  async stopSession({ sessionId }) {
    const record = sessions.get(sessionId);
    if (!record) return { ok: false, reason: 'not_found' };
    record.status = 'ended';
    record.endedAt = new Date().toISOString();
    return { ok: true };
  },

  async getSession(sessionId) {
    const record = sessions.get(sessionId);
    if (!record) return null;
    if (record.status === 'active' && new Date(record.expiresAt).getTime() < Date.now()) {
      record.status = 'expired';
    }
    return record;
  },

  /** 供演示/排障使用:校验开发态凭据 */
  verifyToken,
};
