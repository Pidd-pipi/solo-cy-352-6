import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { logger } from "../../common/logger";
import type { GameSession } from "./session.types";

const DEFAULT_DATA_FILE = resolve(process.cwd(), "data", "sessions.json");

function isGameSession(value: unknown): value is GameSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const session = value as Record<string, unknown>;
  return (
    typeof session.id === "string" &&
    typeof session.title === "string" &&
    typeof session.gameName === "string" &&
    typeof session.startTime === "string" &&
    typeof session.maxPlayers === "number" &&
    typeof session.creator === "string" &&
    Array.isArray(session.participants) &&
    session.participants.every((name) => typeof name === "string") &&
    Array.isArray(session.waitlist) &&
    session.waitlist.every((name) => typeof name === "string")
  );
}

/**
 * 组局数据持久化存储：
 * - 数据保存在 JSON 快照文件中，服务重启后自动恢复；
 * - 每次变更先写临时文件再原子替换，避免写入中断损坏数据；
 * - 通过 SESSIONS_DATA_FILE 指定数据文件路径，设为 "memory" 可关闭持久化。
 */
class SessionStore {
  private readonly sessions: GameSession[] = [];
  private loaded = false;

  private dataFile(): string | null {
    // 惰性解析路径，便于测试在首次访问前注入配置
    const configured = process.env.SESSIONS_DATA_FILE;
    if (configured === "memory") {
      return null;
    }
    return resolve(configured ?? DEFAULT_DATA_FILE);
  }

  private ensureLoaded(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    const file = this.dataFile();
    if (file === null || !existsSync(file)) {
      return;
    }
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, "utf-8"));
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(isGameSession);
        if (valid.length !== parsed.length) {
          logger.error(`数据文件 ${file} 中有 ${parsed.length - valid.length} 条记录格式不符，已跳过`);
        }
        this.sessions.push(...valid);
      }
    } catch {
      // 数据文件损坏时隔离备份，服务从空数据继续启动
      const backup = `${file}.corrupt-${Date.now()}`;
      try {
        renameSync(file, backup);
        logger.error(`数据文件 ${file} 已损坏，已备份为 ${backup} 并以空数据启动`);
      } catch {
        logger.error(`数据文件 ${file} 已损坏且无法备份，以空数据启动`);
      }
    }
  }

  private persist(): void {
    const file = this.dataFile();
    if (file === null) {
      return;
    }
    mkdirSync(dirname(file), { recursive: true });
    const tempFile = `${file}.tmp`;
    writeFileSync(tempFile, JSON.stringify(this.sessions, null, 2));
    renameSync(tempFile, file);
  }

  list(): GameSession[] {
    this.ensureLoaded();
    return this.sessions;
  }

  findById(id: string): GameSession | undefined {
    this.ensureLoaded();
    return this.sessions.find((session) => session.id === id);
  }

  add(session: GameSession): void {
    this.ensureLoaded();
    this.sessions.unshift(session);
    this.persist();
  }

  /** 名单被原地修改（报名/取消/补位）后调用，把最新状态写入磁盘 */
  save(): void {
    this.persist();
  }
}

export const sessionStore = new SessionStore();
