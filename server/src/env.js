import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * 极简 .env 加载:读取服务目录下的 .env(存在才加载)。
 * 规则:已存在的环境变量优先于 .env(不覆盖),与主流 dotenv 行为一致。
 */
function loadDotEnv(filePath = path.resolve(here, '../.env')) {
  if (!fs.existsSync(filePath)) return 0;
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  let count = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
    count += 1;
  }
  return count;
}

export { loadDotEnv };
