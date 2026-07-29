import type {
  SaveScenePayload,
  Scene,
  SceneContentPayload,
  ScheduleEntry,
  ScheduleEntryPayload,
} from './api-types';

/**
 * Server components reach the API over the compose network; the browser reaches it
 * through the published port. API_URL is not inlined into the client bundle, so it
 * is only ever set on the server and the public URL is the browser's fallback.
 */
const BASE =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** Surfaces the API's own message so validation failures are actionable. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init?: Omit<RequestInit, 'body'> & { body?: unknown },
): Promise<T> {
  const { body, ...rest } = init ?? {};

  let response: Response;
  try {
    response = await fetch(BASE + path, {
      ...rest,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Could not reach the API server');
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, response.status));
  }
  return payload as T;
}

function extractMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const { message } = payload as { message: unknown };
    if (Array.isArray(message)) return message.join(' / ');
    if (typeof message === 'string') return message;
  }
  return `Request failed (HTTP ${status})`;
}

export const api = {
  listScenes: () => request<Scene[]>('/scenes'),
  getScene: (id: number) => request<Scene>(`/scenes/${id}`),
  createScene: (body: SaveScenePayload) =>
    request<Scene>('/scenes', { method: 'POST', body }),
  replaceScene: (id: number, body: SaveScenePayload) =>
    request<Scene>(`/scenes/${id}`, { method: 'PUT', body }),
  deleteScene: (id: number) =>
    request<null>(`/scenes/${id}`, { method: 'DELETE' }),
  pushScene: (id: number) =>
    request<null>(`/scenes/${id}/push`, { method: 'POST' }),
  previewScene: (body: SceneContentPayload) =>
    request<null>('/scenes/preview', { method: 'POST', body }),

  listSchedules: () => request<ScheduleEntry[]>('/schedules'),
  replaceSchedules: (entries: ScheduleEntryPayload[]) =>
    request<ScheduleEntry[]>('/schedules', { method: 'PUT', body: { entries } }),
};
