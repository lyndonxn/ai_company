/**
 * 接口冒烟:场景列表 → 创建会话 → 查询 → 结束 → 再查询。
 * 用法:先 npm start,再 npm run smoke
 */
const base = process.env.SMOKE_BASE || 'http://127.0.0.1:8790';

async function main() {
  const health = await fetch(`${base}/api/health`).then((r) => r.json());
  assert(health.ok, 'health check');

  const { scenes } = await fetch(`${base}/api/scenes`).then((r) => r.json());
  assert(Array.isArray(scenes) && scenes.length >= 3, 'at least 3 scenes');
  assert(!('systemPrompt' in scenes[0]), 'systemPrompt not exposed');

  const created = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sceneId: scenes[0].id }),
  }).then((r) => r.json());
  const session = created.session;
  assert(session?.sessionId, 'session created');
  for (const key of ['roomId', 'userId', 'agentId', 'token', 'expiresAt']) {
    assert(session[key], `session.${key}`);
  }

  const missing = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sceneId: '__nope__' }),
  });
  assert(missing.status === 404, 'unknown scene → 404');

  const active = await fetch(`${base}/api/sessions/${session.sessionId}`).then((r) => r.json());
  assert(active.session?.status === 'active', 'session active');

  const stopped = await fetch(`${base}/api/sessions/${session.sessionId}`, { method: 'DELETE' }).then((r) => r.json());
  assert(stopped.ok, 'session stopped');

  const ended = await fetch(`${base}/api/sessions/${session.sessionId}`).then((r) => r.json());
  assert(ended.session?.status === 'ended', 'session ended');

  console.log(`smoke ok — ${scenes.length} scenes, provider=${health.provider}`);
}

function assert(cond, label) {
  if (!cond) {
    console.error(`✗ ${label}`);
    process.exit(1);
  }
  console.log(`✓ ${label}`);
}

main().catch((err) => {
  console.error('smoke failed:', err.message);
  process.exit(1);
});
