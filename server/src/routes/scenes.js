import { Router } from 'express';
import { listPublicScenes } from '../scenes.js';

export const scenesRouter = Router();

/** 人设公开列表(服务端私有字段已在投影层剥离) */
scenesRouter.get('/', (_req, res) => {
  res.json({ scenes: listPublicScenes() });
});
