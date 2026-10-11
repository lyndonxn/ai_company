import { config } from '../config.js';
import mockProvider from './mock.js';

/**
 * 会话提供方注册表。
 * 新增供应商:在本目录新建实现(接口见 ./README.md),注册到下表,
 * 并设置环境变量 AGENT_PROVIDER=<name> 生效。
 */
const registry = {
  [mockProvider.name]: mockProvider,
};

export function getAgentProvider() {
  const provider = registry[config.agentProvider];
  if (!provider) {
    throw new Error(`未知的 AGENT_PROVIDER: ${config.agentProvider},可用: ${Object.keys(registry).join(', ')}`);
  }
  return provider;
}
