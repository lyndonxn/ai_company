import type { Scene, SessionInfo } from '@/types';

/** 会话阶段:连接中 → 聆听/思考/说话 循环 */
export type AgentPhase = 'connecting' | 'listening' | 'thinking' | 'speaking';

export interface SubtitlePayload {
  speaker: 'user' | 'agent';
  /** 未定稿分片传「当前累计文本」,定稿传完整文本 + final=true */
  text: string;
  final: boolean;
  /** AI 侧被打断时为 true(未说完的话) */
  interrupted?: boolean;
}

export interface EngineEvents {
  phase: AgentPhase;
  subtitle: SubtitlePayload;
  /** 0..1 实时电平,驱动波形 */
  level: number;
  error: Error;
}

export interface ConnectOptions {
  session: SessionInfo;
  scene: Scene;
  /** 大脑服务基础地址(mock 引擎经此取流式回复) */
  brainBase: string;
}

export type EngineEventHandler<K extends keyof EngineEvents> = (payload: EngineEvents[K]) => void;

/**
 * 语音引擎统一接口 —— 仓库内置 mock 实现(离线可演示)。
 * 接入真实语音供应商时,实现此接口并在 rtc/index.ts 注册,业务层零改动。
 * 接入指南:src/rtc/README.md 与根目录 docs/provider-integration.md
 */
export interface VoiceEngine {
  /** 建立连接(真实引擎:进房、发布麦克风) */
  connect(options: ConnectOptions): Promise<void>;
  /** 开始对话(真实引擎:启动云侧智能体,通常带来一句问候) */
  startSession(): Promise<void>;
  /** 结束对话(真实引擎:停止云侧智能体) */
  stopSession(): Promise<void>;
  /** 断开连接并释放资源 */
  disconnect(): Promise<void>;
  /** 麦克风开关;开启瞬间若 AI 正在说话,应触发打断语义 */
  setMicEnabled(on: boolean): Promise<void>;
  /** 外部文本驱动一轮对话(演示通道;真实接入通常经数据通道下发) */
  sendUserText(text: string): void;
  /** 立即打断 AI 当前说话 */
  interrupt(): void;
  dispose(): void;
  on<K extends keyof EngineEvents>(event: K, handler: EngineEventHandler<K>): () => void;
}
