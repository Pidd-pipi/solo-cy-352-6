import type { GameSession } from "./session.types";

/**
 * 组局数据保存在内存中，服务运行期间保留，重启后清空。
 */
class SessionStore {
  private readonly sessions: GameSession[] = [];

  list(): GameSession[] {
    return this.sessions;
  }

  findById(id: string): GameSession | undefined {
    return this.sessions.find((session) => session.id === id);
  }

  add(session: GameSession): void {
    this.sessions.unshift(session);
  }
}

export const sessionStore = new SessionStore();
