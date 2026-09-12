import { API_BASE_URL } from "../constants/app";
import type {
  CreateSessionPayload,
  GameSession,
  JoinSessionResponse,
  LeaveSessionResponse,
  OverviewResponse,
} from "../types";

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new Error(body.message ?? `请求失败：${response.status}`);
  }
  return body;
}

export async function fetchOverview(): Promise<OverviewResponse> {
  const response = await fetch(`${API_BASE_URL}/overview`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Overview request failed: ${response.status}`);
  }

  return response.json() as Promise<OverviewResponse>;
}

export async function fetchSessions(): Promise<GameSession[]> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    headers: { Accept: "application/json" },
  });
  const body = await parseResponse<{ sessions: GameSession[] }>(response);
  return body.sessions;
}

export async function createSession(payload: CreateSessionPayload): Promise<GameSession> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse<{ session: GameSession }>(response);
  return body.session;
}

export async function joinSession(id: string, player: string): Promise<JoinSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/${id}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ player }),
  });
  return parseResponse<JoinSessionResponse>(response);
}

export async function leaveSession(id: string, player: string): Promise<LeaveSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/${id}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ player }),
  });
  return parseResponse<LeaveSessionResponse>(response);
}
