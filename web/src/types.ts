export interface SceneCapabilities {
  interrupt: boolean;
  streaming: boolean;
}

/** 网关下发的人设公开字段(服务端私有字段不在此处) */
export interface Scene {
  id: string;
  name: string;
  role: string;
  avatar: string;
  accent: string;
  tagline: string;
  greeting: string;
  questions: string[];
  capabilities: SceneCapabilities;
}

/** 网关创建的语音会话 */
export interface SessionInfo {
  sessionId: string;
  sceneId: string;
  roomId: string;
  userId: string;
  agentId: string;
  token: string;
  provider: string;
  createdAt?: string;
  expiresAt: string;
  status?: string;
}
