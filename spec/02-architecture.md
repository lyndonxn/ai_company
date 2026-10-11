# 02 架构

## 总览

```
┌─────────────┐   HTTP/JSON    ┌─────────────┐    HTTP/SSE    ┌──────────────┐
│   web (5173) │ ─────────────▶ │ server(8790) │               │ ai-service   │
│  React SPA   │                │  Express 网关 │               │  (8900)      │
│              │                │              │ ◀─────────────│  FastAPI     │
│  rtc 引擎抽象 │ ◀────mock 事件──┤  providers 缝口│   (真实接入后: │  人设大脑      │
└─────────────┘                 └─────────────┘    信令/媒体由    └──────────────┘
                                     │              供应商云侧完成)
                              scenes/*.json
```

三个可插拔缝口(provider seam),所有第三方依赖只允许落在这里:

| 缝口 | 位置 | 内置实现 | 接入目标 |
| --- | --- | --- | --- |
| 语音引擎 VoiceEngine | `web/src/rtc/` | `mock-engine.ts` | 真实时效语音传输(进房、发布/订阅、信令事件) |
| 会话提供方 AgentProvider | `server/src/providers/` | `mock.js` | 会话编排云服务(创建/停止会话、下发光标与字幕通道) |
| 大脑 LLM / 检索 Retriever | `ai-service/app/providers/` | `MockPersonaLLM` / `KeywordRetriever` | OpenAI 兼容接口、向量库 |

## server — 网关

- `GET /api/scenes`:返回人设公开字段(id/name/role/avatar/accent/tagline/greeting/questions/capabilities);`systemPrompt`、`voice`、`llm` 为服务端私有,不下发
- `POST /api/sessions` `{sceneId}` → `{sessionId, roomId, userId, agentId, token, expiresAt, provider}`;token 为 HMAC 签名的开发态凭据(真实接入后由 provider 决定)
- `DELETE /api/sessions/:id` → 结束会话
- `GET /api/sessions/:id` → 会话状态(心跳用)
- `GET /api/health`

会话状态保存在内存(单实例);provider 注册表由环境变量 `AGENT_PROVIDER`(默认 `mock`)选择。

## ai-service — 大脑

- `GET /api/personas`、`GET /api/health`
- `POST /api/chat`:`{personaId, messages:[{role, content}], stream?}`;`stream=true` 时以 SSE 返回 `data: {"delta": "..."}`,终止帧 `data: [DONE]`;否则一次性 JSON
- LLM 缝口:环境变量 `LLM_BASE_URL` 未设置时用 `MockPersonaLLM`(按人设模板合成回复);设置后走 OpenAI 兼容接口(`LLM_API_KEY`、`LLM_MODEL` 可配)
- 检索缝口:`KeywordRetriever` 对 `ai-service/data/knowledge/*.md` 做关键词打分;命中片段注入 prompt 上下文

## web — 前端

- 路由:`/`(首页画廊)、`/room/:sessionId`(语音房间)
- 状态(Redux Toolkit):
  - `session`:人设列表、当前会话、连接状态
  - `conversation`:字幕历史、AI 阶段、打断标记
  - `devices`:麦克风开关、字幕开关、演示输入
- VoiceEngine 接口(`web/src/rtc/types.ts`):

```ts
interface VoiceEngine {
  connect(opts: ConnectOptions): Promise<void>;   // 进房
  startSession(): Promise<void>;                  // 开始对话(问候)
  stopSession(): Promise<void>;
  disconnect(): Promise<void>;
  setMicEnabled(on: boolean): Promise<void>;
  sendUserText(text: string): void;               // 演示通道:驱动一轮对话
  dispose(): void;
  on<E extends keyof EngineEvents>(event: E, cb: EngineEvents[E]): void;
}
// EngineEvents: phase | subtitle | level | error | network
```

- MockEngine 事件流(每轮):`listening(2s)` → 用户字幕逐字上屏 → `thinking(0.8~1.2s)` → 调 ai-service `/chat`(SSE)→ `speaking`(AI 字幕随流上屏,波形随合成电平起伏)→ `listening`
- 麦克风开关在 AI 说话时触发打断:中止当前流,最后一条 AI 字幕打「已打断」标记

## 端口与代理

| 服务 | 端口 | 说明 |
| --- | --- | --- |
| web dev | 5173 | Vite;`/api` 代理到 8790 |
| server | 8790 | Express |
| ai-service | 8900 | FastAPI;mock 引擎经它取回复 |

## 字幕与打断语义

- 字幕分片携带 `final` 标记;同一说话人的未定稿分片替换上一条,`final=true` 落定
- 打断(AI 侧):未落定的最后一条 AI 字幕标记 `interrupted` 并停止后续分片
- 每条字幕归属 `speaker`:`user` 或 `agent`
