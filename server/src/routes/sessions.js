import { Router } from 'express';
import { getScene } from '../scenes.js';
import { getAgentProvider } from '../providers/index.js';

export const sessionsRouter = Router();

sessionsRouter.post('/', async (req, res) => {
  const { sceneId } = req.body || {};
  if (!sceneId) {
    return res.status(400).json({ error: 'sceneId 不能为空' });
  }
  const scene = getScene(sceneId);
  if (!scene) {
    return res.status(404).json({ error: `场景不存在: ${sceneId}` });
  }
  try {
    const provider = getAgentProvider();
    const session = await provider.startSession({ scene });
    return res.status(201).json({ session });
  } catch (err) {
    console.error('[sessions] start failed:', err.message);
    return res.status(502).json({ error: `会话创建失败: ${err.message}` });
  }
});

sessionsRouter.get('/:id', async (req, res) => {
  const provider = getAgentProvider();
  const record = await provider.getSession(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '会话不存在' });
  }
  return res.json({ session: record });
});

sessionsRouter.delete('/:id', async (req, res) => {
  try {
    const provider = getAgentProvider();
    const result = await provider.stopSession({ sessionId: req.params.id });
    if (!result.ok && result.reason === 'not_found') {
      return res.status(404).json({ error: '会话不存在' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[sessions] stop failed:', err.message);
    return res.status(502).json({ error: `会话停止失败: ${err.message}` });
  }
});
