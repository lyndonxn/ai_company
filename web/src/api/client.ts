import type { Scene, SessionInfo } from '@/types';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { 'content-type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError(0, '网络异常,请确认服务已启动');
  }
  if (!res.ok) {
    let message = `请求失败(${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* 非 JSON 响应,保留默认文案 */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export function fetchScenes() {
  return request<{ scenes: Scene[] }>('/api/scenes');
}

export function startSession(sceneId: string) {
  return request<{ session: SessionInfo }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ sceneId }),
  });
}

export function getSession(sessionId: string) {
  return request<{ session: SessionInfo }>(`/api/sessions/${sessionId}`);
}

export function stopSession(sessionId: string) {
  return request<{ ok: boolean }>(`/api/sessions/${sessionId}`, { method: 'DELETE' });
}
