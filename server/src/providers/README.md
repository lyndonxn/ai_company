# 会话提供方(AgentProvider)接口

会话提供方负责「一次语音对话」的生命周期:分配房间与身份、签发进房凭据、停止会话。业务路由(`../routes/sessions.js`)只依赖下面这组函数,不关心具体供应商。

## 接口契约

每个 provider 是一个导出默认对象:

| 函数 | 入参 | 返回 | 说明 |
| --- | --- | --- | --- |
| `name` | — | `string` | 注册名,与 `AGENT_PROVIDER` 环境变量对应 |
| `startSession({ scene })` | 完整场景配置(含私有字段) | `{sessionId, roomId, userId, agentId, token, provider, expiresAt, ...}` | 创建云端会话并返回前端进房所需凭据;额外字段会被原样透传给前端 `vendor` 消费 |
| `stopSession({ sessionId })` | 会话 ID | `{ok, reason?}` | 停止云端任务;必须幂等(重复调用不报错) |
| `getSession(sessionId)` | 会话 ID | record 或 `null` | 返回会话记录,`status ∈ active/ended/expired` |

## 实现要求

1. **密钥只在服务端**:签名与 OpenAPI 调用都在本目录完成,前端只拿到短期凭据。
2. **幂等**:同一会话重复 stop 必须安全;start 遇到供应商侧「任务已存在」时,先停止旧任务再创建。
3. **凭据短效**:建议 ≤ 24h,并在 `expiresAt` 中返回过期时间。
4. **错误语义**:供应商错误抛出 `Error`,由路由统一转成 502;业务校验错误(场景不存在等)由路由层处理,provider 不重复校验。

## 注册步骤

1. 新建 `your-vendor.js`,导出默认对象实现上表契约
2. 在 `index.js` 的 `registry` 中加入 `['your-vendor']: yourVendor`
3. `.env` 设置 `AGENT_PROVIDER=your-vendor`,重启服务
4. 用 `npm run smoke` 验证场景列表与会话创建/结束全链路

配套的前端语音引擎接入见 `web/src/rtc/README.md` 与根目录 `docs/provider-integration.md`。
