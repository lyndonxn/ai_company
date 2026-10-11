import { MockVoiceEngine } from './mock-engine';
import type { VoiceEngine } from './types';

export type { AgentPhase, ConnectOptions, EngineEvents, SubtitlePayload, VoiceEngine } from './types';

/**
 * 语音引擎注册表。接入真实供应商时:
 *   1. 新建 ./your-vendor/engine.ts 实现 VoiceEngine
 *   2. 在此处注册 { 'your-vendor': createYourVendorEngine }
 *   3. web/.env.local 设置 VITE_VOICE_PROVIDER=your-vendor
 */
export const engineRegistry: Record<string, () => VoiceEngine> = {
  mock: () => new MockVoiceEngine(),
};

export function createVoiceEngine(name?: string): VoiceEngine {
  const provider = name || import.meta.env.VITE_VOICE_PROVIDER || 'mock';
  const factory = engineRegistry[provider];
  if (!factory) {
    throw new Error(`未知的语音提供方: ${provider},可用: ${Object.keys(engineRegistry).join(', ')}`);
  }
  return factory();
}
