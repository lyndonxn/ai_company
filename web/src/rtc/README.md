# 语音引擎(VoiceEngine)接入

`src/rtc/` 是前端唯一的语音传输层。业务组件(房间页、字幕、波形)只依赖 `types.ts` 里的 `VoiceEngine` 接口,不感知具体供应商;内置 `mock-engine.ts` 保证无外部依赖时全流程可演示。

## 接口速览

```ts
interface VoiceEngine {
  connect(opts: ConnectOptions): Promise<void>;  // 进房并发布麦克风
  startSession(): Promise<void>;                 // 启动智能体(通常产生一句问候)
  stopSession(): Promise<void>;
  disconnect(): Promise<void>;
  setMicEnabled(on: boolean): Promise<void>;     // 开麦瞬间若 AI 在说话 → 打断
  sendUserText(text: string): void;              // 外部文本驱动一轮对话
  interrupt(): void;
  dispose(): void;
  on<K>(event: 'phase'|'subtitle'|'level'|'error', handler): () => void;
}
```

## 事件契约

| 事件 | 载荷 | 语义 |
| --- | --- | --- |
| `phase` | `connecting/listening/thinking/speaking` | 驱动阶段徽标与头像动效 |
| `subtitle` | `{speaker, text, final, interrupted?}` | 未定稿分片传「累计文本」;`final=true` 落定;AI 被打断时 `interrupted=true` |
| `level` | `0..1` | 实时电平,驱动波形;仅 speaking 时应有明显起伏 |
| `error` | `Error` | 非打断类异常,房间页会展示提示条 |

## 接入步骤

1. 新建 `./your-vendor/engine.ts`,实现 `VoiceEngine`(内部用供应商 Web SDK 进房、订阅字幕通道、上报电平)
2. 在 `index.ts` 的 `engineRegistry` 注册实现
3. `.env.local` 设置 `VITE_VOICE_PROVIDER=your-vendor`
4. 会话凭据来自网关 `POST /api/sessions` 返回的 `session`(真实 provider 会附带 `vendor` 扩展字段)
5. 供应商字幕协议与本事件结构不同时,在引擎内部做协议转换,保证对外契约不变

服务端会话提供方(`server/src/providers/`)与本接口成对出现:通常同时接入才能形成完整链路,见根目录 `docs/provider-integration.md`。
