# 供应商接入指南

本项目的第三方能力全部收敛到缝口。内置的 `mock` 实现用于离线演示与开发;接入真实供应商时,只需新增实现并注册,业务层零改动。

> 约定:任何供应商的 AppId/密钥只存在于服务端环境变量;`.env` 已被 gitignore,示例见各服务 `.env.example`(值留空)。两个服务启动时都会自动加载自己目录下的 `.env`(已存在的环境变量优先)。

## 架构形态

项目支持两种会话形态,可并存:

```
形态 A(mock 演示,当前默认):
  浏览器 ──HTTP──▶ server(会话网关)          浏览器 mock 引擎 ──HTTP/SSE──▶ ai-service(大脑)

形态 B(接入真实供应商后,与课程工作流一致):
  浏览器 ──HTTP──▶ server(会话网关/信令)
  浏览器 ◀──实时音视频/字幕/指令── 会话编排云服务(ASR→文本)
                                        │ callback POST(需公网可达,开发态用 ngrok)
                                        ▼
                              ai-service /api/callback
                              (检索知识库 → 组装 Prompt → 流式生成)
                                        │ SSE 文本流
                                        ▼
                                  云服务 TTS 播流 ◀──返回──┘
```

## 一、会话提供方(server)

**位置**:`server/src/providers/`
**接口**:`AgentProvider`

```js
export default {
  name: 'your-vendor',
  // 创建会话:分配房间、生成用户/智能体标识与凭据
  async startSession({ scene, sceneConfig }) {
    // 1. 调用供应商 OpenAPI 创建会话任务(服务端签名,勿在前端暴露密钥)
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
// 5. 引擎内需处理:自动订阅远端音频、浏览器自动播放失败兜底(提示用户点击恢复)
```

**步骤**:

1. 新建 `web/src/rtc/vendor/engine.ts` 实现 `VoiceEngine`,内部用供应商 Web SDK
2. 在 `web/src/rtc/index.ts` 的工厂函数注册 `VITE_VOICE_PROVIDER=your-vendor`
3. `web/.env.local` 配置 `VITE_VOICE_PROVIDER` 与会话接口返回的 `vendor` 参数消费逻辑
4. 字幕/状态协议:云侧字幕通道(含流控字段:轮次 ID、分片序号、时间戳)与 mock 事件结构不同时,在引擎内部完成协议转换,保证对外事件结构不变

## 三、大脑服务(ai-service)

### 3.1 LLM 缝口

- **OpenAI 兼容接口**(零代码):设置环境变量即切换:
  `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`;未设置时使用 `MockPersonaLLM`
- **生成参数**:`LLM_TEMPERATURE`(默认 `0.3`,严谨且有对话感;设 `0` 为极度严谨)、`LLM_MAX_TOKENS`(可选)
- **自定义 Provider**:实现 `app/providers/llm.py` 的 `LLMClient` 协议(`async chat_stream(persona, messages, context) -> AsyncIterator[str]`)

### 3.2 知识库缝口(推荐托管方式)

知识检索支持两级:

1. **本地检索**(默认):`ai-service/data/knowledge/*.md` 关键词匹配,适合离线演示
2. **托管知识服务**(生产推荐):设置 `KB_BASE_URL` 即启用,优先于本地检索

`KB_BASE_URL` 的 HTTP 契约(托管知识服务的 API 不一致时,包一层薄适配即可):

```
POST {KB_BASE_URL}
Headers: Authorization: Bearer {KB_API_KEY}   # 配置了才带
Body:    {"query": "用户问题", "top_k": 3}
Resp:    {"chunks": [{"content": "命中文本", "score": 0.87}, ...]}
```

失败降级:托管知识服务不可用时,检索返回空串,对话照常进行(无知识注入)。

### 3.3 云端回调端点(`/api/callback`)

接入真实供应商后,会话编排云服务会把 ASR 文本**回调**到本服务。已内置端点:

```
POST /api/callback
Body(两种形态均可):
  {"messages": [{"role": "user", "content": "..."}], "personaId": "xiaochuan"}
  {"text": "用户说的话", "roomId": "...", "roundId": 1, "sequence": 0}
Resp:SSE,帧 data: {"content": "..."},终止帧 data: [DONE]
```

- 请求字段解析集中在 `app/callback.py` 的 `extract_request`,响应帧格式集中在 `sse_frame` —— 与具体云服务联调时只对齐这两处
- 元数据(roomId/roundId/sequence 等)经响应头 `X-Callback-Meta` 原样透传

### 3.4 公网暴露(回调必须)

云服务回调要求本服务公网可达。开发态用内网穿透:

```bash
ngrok config add-authtoken <你的TOKEN>
ngrok http 8900
# 把得到的公网地址配置到供应商控制台的回调地址/第三方模型配置里
```

生产态:部署到公网服务器或容器平台(见 spec/02 的部署项)。

> ⚠️ 接入回调模式后,大脑服务就在通话链路上了:**重启 ai-service 前先挂断房间**,否则当前会话的回复会失败。

## 验收清单(接入后)

- [ ] `AGENT_PROVIDER` 切换后,`POST /api/sessions` 返回真实凭据,前端可进房
- [ ] 麦克风说话 → `subtitle(speaker=user)` 事件按分片到达,`final` 语义正确
- [ ] AI 回复阶段 `phase=speaking` 且 `level` 有值(波形动)
- [ ] 云端回调 → `/api/callback` 返回 SSE `content` 帧,云端能流式合成语音
- [ ] 挂断后供应商侧任务确已停止(控制台可查),重复发起不报「任务已存在」
- [ ] 断开网络时房间有明确错误提示,不白屏
