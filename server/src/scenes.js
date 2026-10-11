import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/** 服务端私有字段:永不下发给前端 */
const PRIVATE_FIELDS = ['systemPrompt', 'llm', 'voice'];

function loadScenes() {
  const scenes = new Map();
  if (!fs.existsSync(config.scenesDir)) return scenes;
  for (const file of fs.readdirSync(config.scenesDir)) {
    if (!file.endsWith('.json')) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(config.scenesDir, file), 'utf-8'));
    if (!raw.id) throw new Error(`场景配置缺少 id: ${file}`);
    scenes.set(raw.id, raw);
  }
  return scenes;
}

export const scenes = loadScenes();

/** 对外投影:剥离服务端私有字段 */
export function publicScene(scene) {
  const out = {};
  for (const [key, value] of Object.entries(scene)) {
    if (!PRIVATE_FIELDS.includes(key)) out[key] = value;
  }
  return out;
}

export function listPublicScenes() {
  return [...scenes.values()].map(publicScene);
}

export function getScene(id) {
  return scenes.get(id) || null;
}
