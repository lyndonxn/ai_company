import type {
  ConnectOptions,
  EngineEventHandler,
  EngineEvents,
  VoiceEngine,
} from './types';

type Listener<K extends keyof EngineEvents> = Set<EngineEventHandler<K>>;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const USER_TYPE_DELAY = 85; // 用户字幕逐字间隔
const AGENT_TYPE_DELAY = 55; // 本地问候语逐字间隔
const THINKING_MIN = 700;
const THINKING_JITTER = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Mock 语音引擎:完全离线可运行的演示实现。
 *
 * 事件流(每轮):
 *   listening → 用户字幕逐字上屏(final)
 *   → thinking(随机 0.7~1.2s)→ 调大脑服务 SSE
 *   → speaking(AI 字幕随流上屏,电平起伏)→ listening
 * 打断语义:AI 说话时开麦或调用 interrupt() → 中止流、字幕标记 interrupted、回到聆听。
 */
export class MockVoiceEngine implements VoiceEngine {
  private listeners: { [K in keyof EngineEvents]: Listener<K> } = {
    phase: new Set(),
    subtitle: new Set(),
    level: new Set(),
    error: new Set(),
  };

  private options: ConnectOptions | null = null;

  private connected = false;


  private currentPhase: EngineEvents['phase'] = 'connecting';

  /** 单调递增的轮次令牌:过期轮次的所有异步回调直接丢弃 */
  private turnSeq = 0;

  /** AI 当前正在流出的文本(interrupt 时用于落定字幕) */
  private speakingPartial = '';

  private levelTimer: ReturnType<typeof setInterval> | null = null;

  private abort: AbortController | null = null;

  private history: ChatMessage[] = [];

  on<K extends keyof EngineEvents>(event: K, handler: EngineEventHandler<K>): () => void {
    this.listeners[event].add(handler);
    return () => this.listeners[event].delete(handler);
  }

  private emit<K extends keyof EngineEvents>(event: K, payload: EngineEvents[K]) {
    for (const handler of this.listeners[event]) {
      try {
        (handler as EngineEventHandler<K>)(payload);
      } catch (err) {
        console.error('[mock-engine] listener error', err);
      }
    }
  }

  private setPhase(phase: EngineEvents['phase']) {
    this.currentPhase = phase;
    this.emit('phase', phase);
    if (phase === 'speaking') this.startLevelLoop();
    else this.stopLevelLoop();
  }

  private startLevelLoop() {
    this.stopLevelLoop();
    const startedAt = Date.now();
    this.levelTimer = setInterval(() => {
      const t = (Date.now() - startedAt) / 1000;
      const level = 0.32 + 0.5 * Math.abs(Math.sin(t * 3.1)) + Math.random() * 0.12;
      this.emit('level', Math.min(1, level));
    }, 90);
  }

  private stopLevelLoop() {
    if (this.levelTimer) {
      clearInterval(this.levelTimer);
      this.levelTimer = null;
    }
    this.emit('level', 0.05);
  }

  async connect(options: ConnectOptions): Promise<void> {
    this.options = options;
    this.history = [];
    this.setPhase('connecting');
    // 模拟进房耗时(真实引擎:joinRoom + 发布麦克风)
    await sleep(500 + Math.random() * 300);
    this.connected = true;
  }

  async startSession(): Promise<void> {
    if (!this.options) throw new Error('engine not connected');
    const { greeting } = this.options.scene;
    this.history.push({ role: 'assistant', content: greeting });
    await this.streamLocalText(greeting);
  }

  async stopSession(): Promise<void> {
    this.abortTurn(false);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.abortTurn(false);
  }

  async setMicEnabled(on: boolean): Promise<void> {
    // mock 语义:开麦即「用户插话」——若 AI 正在说话则打断
    if (on && this.currentPhase === 'speaking') {
      this.abortTurn(true);
    }
  }

  sendUserText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !this.connected) return;
    if (this.currentPhase !== 'listening') return;
    void this.runTurn(trimmed);
  }

  interrupt() {
    if (this.currentPhase === 'speaking') {
      this.abortTurn(true);
    }
  }

  dispose() {
    this.abortTurn(false);
    this.connected = false;
  }

  // ---------- 内部实现 ----------

  private abortTurn(markInterrupted: boolean) {
    this.turnSeq += 1;
    const wasSpeaking = this.currentPhase === 'speaking';
    this.abort?.abort();
    this.abort = null;
    this.stopLevelLoop();
    if (wasSpeaking && markInterrupted && this.speakingPartial) {
      this.emit('subtitle', {
        speaker: 'agent',
        text: this.speakingPartial,
        final: true,
        interrupted: true,
      });
    }
    this.speakingPartial = '';
    if (wasSpeaking) {
      this.setPhase('listening');
    }
  }

  private async streamLocalText(text: string) {
    const seq = ++this.turnSeq;
    this.abort = new AbortController();
    this.speakingPartial = '';
    this.setPhase('speaking');
    for (const ch of text) {
      if (seq !== this.turnSeq) return;
      this.speakingPartial += ch;
      this.emit('subtitle', { speaker: 'agent', text: this.speakingPartial, final: false });
      await sleep(AGENT_TYPE_DELAY);
    }
    if (seq !== this.turnSeq) return;
    this.emit('subtitle', { speaker: 'agent', text: this.speakingPartial, final: true });
    this.speakingPartial = '';
    this.setPhase('listening');
  }

  private async runTurn(userText: string) {
    const options = this.options;
    if (!options) return;
    const seq = ++this.turnSeq;

    // 1. 用户字幕逐字上屏
    this.abort = new AbortController();
    let userPartial = '';
    for (const ch of userText) {
      if (seq !== this.turnSeq) return;
      userPartial += ch;
      this.emit('subtitle', { speaker: 'user', text: userPartial, final: false });
      await sleep(USER_TYPE_DELAY);
    }
    if (seq !== this.turnSeq) return;
    this.emit('subtitle', { speaker: 'user', text: userText, final: true });
    this.history.push({ role: 'user', content: userText });

    // 2. 思考
    this.setPhase('thinking');
    await sleep(THINKING_MIN + Math.random() * THINKING_JITTER);
    if (seq !== this.turnSeq) return;

    // 3. 大脑流式回复
    this.setPhase('speaking');
    this.speakingPartial = '';
    this.abort = new AbortController();
    let agentPartial = '';
    try {
      const res = await fetch(`${options.brainBase}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: this.abort.signal,
        body: JSON.stringify({
          personaId: options.scene.id,
          messages: this.history.slice(-10),
          stream: true,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`大脑服务不可用(${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;
      while (!done && seq === this.turnSeq) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(data) as { delta?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.delta) {
              agentPartial += parsed.delta;
              this.speakingPartial = agentPartial;
              this.emit('subtitle', { speaker: 'agent', text: agentPartial, final: false });
            }
          } catch {
            /* 跳过无法解析的帧 */
          }
        }
      }
      if (seq !== this.turnSeq) return;
      if (!agentPartial) agentPartial = '……我没接上话,再说一次好吗?';
      this.emit('subtitle', { speaker: 'agent', text: agentPartial, final: true });
      this.history.push({ role: 'assistant', content: agentPartial });
    } catch (err) {
      if (seq !== this.turnSeq) return; // 已被打断/结束,字幕由 abortTurn 统一落定
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      if (aborted) {
        this.emit('subtitle', {
          speaker: 'agent',
          text: agentPartial,
          final: true,
          interrupted: true,
        });
      } else {
        console.error('[mock-engine] turn failed', err);
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
        const fallback = '抱歉,我这边网络开小差了,稍后再试一次好吗?';
        this.emit('subtitle', { speaker: 'agent', text: fallback, final: true });
        this.history.push({ role: 'assistant', content: fallback });
      }
    } finally {
      if (seq === this.turnSeq) {
        this.abort = null;
        this.speakingPartial = '';
        this.setPhase('listening');
      }
    }
  }
}
