# 供应商接入指南

本项目的第三方能力全部收敛到三个缝口。内置的 `mock` 实现用于离线演示与开发;接入真实供应商时,只需新增实现并注册,业务层零改动。

> 约定:任何供应商的 AppId/密钥只存在于服务端环境变量;`.env` 已被 gitignore,示例见 `.env.example`(值留空)。

## 一、会话提供方(server)

**位置**:`server/src/providers/`
**接口**:`AgentProvider`

```js
export default {
  name: 'your-vendor',
  // 创建会话:分配房间、生成用户/智能体标识与凭据
  async startSession({ scene, sceneConfig }) {
    // 1. 调用供应商 OpenAPI 创建任务(服务端签名,勿在前端暴露密钥)
    // 2. 为用户签发进房凭据(通常由 AppId+AppKey+RoomId+UserId 派生,短期有效)
    return {
      sessionId, roomId, userId, agentId,
      token,            // 前端进房凭据
      provider: this.name,
      expiresAt,        // ISO 时间
      vendor: { /* 前端 rtc 实现需要的连接参数,如 appId */ },
    };
  },
  async stopSession(session) { /* 调用停止接口,幂等 */ },
  async getSession(sessionId) { /* 返回 'active' | 'ended' */ },
};
```

**注册**:`server/src/providers/index.js` 的注册表中加入实现,`.env` 设 `AGENT_PROVIDER=your-vendor`。
**注意**:

- `startSession` 必须幂等处理重复创建(供应商侧通常要求先 stop 再 start)
- 凭据有效期建议 ≤ 24h,过期前支持 `POST /api/sessions/:id/renew`(可自行扩展)
- 场景 JSON 中的 `voice`/`llm` 字段是给你映射供应商参数用的自由区,服务端私有不外发

## 二、前端语音引擎(web)

**位置**:`web/src/rtc/`
**接口**:`VoiceEngine`(`types.ts`)

```ts
// 实现要求:
// 1. connect(): 用会话返回的 vendor 参数进房并发布麦克风
// 2. 产生事件:
//    phase    — connecting | listening | thinking | speaking
//    subtitle — { speaker: 'user'|'agent', text, final }  分片语义见 spec/02
//    level    — 0..1 实时电平,驱动波形条
//    error/network — 异常与网络质量
// 3. sendUserText(): 把外部文本注入对话循环(真实接入下通常经数据通道发给云侧)
// 4. 麦克风关闭时,若智能体正在说话,应触发打断语义(字幕 interrupted)
```

**步骤**:

1. 新建 `web/src/rtc/vendor/engine.ts` 实现 `VoiceEngine`,内部用供应商 Web SDK
2. 在 `web/src/rtc/index.ts` 的工厂函数注册 `VITE_VOICE_PROVIDER=your-vendor`
3. `web/.env.local` 配置 `VITE_VOICE_PROVIDER` 与会话接口返回的 `vendor` 参数消费逻辑
4. 字幕协议:若云侧字幕通道与 mock 不同(如二进制帧),在引擎内部完成协议转换,保证对外事件结构不变

## 三、大脑 LLM / 检索(ai-service)

**位置**:`ai-service/app/providers/`

- **LLM**:设置环境变量即切换到 OpenAI 兼容接口,无需写代码:
  `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`;未设置时使用 `MockPersonaLLM`
- **自定义 Provider**:实现 `app/providers/llm.py` 的 `LLMClient` 协议(`async chat_stream(persona, messages, context) -> AsyncIterator[str]`)
- **检索**:实现 `app/providers/retrieval.py` 的 `Retriever` 协议(建议接向量库),返回片段会作为 `context` 注入 prompt

## 验收清单(接入后)

- [ ] `AGENT_PROVIDER` 切换后,`POST /api/sessions` 返回真实凭据,前端可进房
- [ ] 麦克风说话 → `subtitle(speaker=user)` 事件按分片到达,`final` 语义正确
- [ ] AI 回复阶段 `phase=speaking` 且 `level` 有值(波形动)
- [ ] 挂断后供应商侧任务确已停止(控制台可查),重复发起不报「任务已存在」
- [ ] 断开网络时房间有明确错误提示,不白屏
