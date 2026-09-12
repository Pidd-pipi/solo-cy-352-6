import { randomUUID } from "crypto";
import { AppError } from "../../common/errors";
import { sessionStore } from "./session.store";
import type {
  CreateSessionInput,
  GameSession,
  GameSessionView,
  JoinSessionResult,
  LeaveSessionResult,
} from "./session.types";

function toView(session: GameSession): GameSessionView {
  return {
    ...session,
    participants: [...session.participants],
    waitlist: [...session.waitlist],
    participantCount: session.participants.length,
    waitlistCount: session.waitlist.length,
    status: session.participants.length >= session.maxPlayers ? "full" : "open",
  };
}

export class SessionService {
  listSessions(): GameSessionView[] {
    return sessionStore.list().map(toView);
  }

  createSession(input: CreateSessionInput): GameSessionView {
    const session: GameSession = {
      id: randomUUID(),
      title: input.title,
      gameName: input.gameName,
      location: input.location ?? "",
      startTime: input.startTime,
      maxPlayers: input.maxPlayers,
      creator: input.creator,
      createdAt: new Date().toISOString(),
      participants: [],
      waitlist: [],
    };
    sessionStore.add(session);
    return toView(session);
  }

  joinSession(id: string, player: string): JoinSessionResult {
    const session = this.mustFind(id);
    if (session.participants.includes(player) || session.waitlist.includes(player)) {
      throw new AppError(409, `玩家「${player}」已报名，不能重复报名`);
    }

    let placement: JoinSessionResult["placement"];
    if (session.participants.length < session.maxPlayers) {
      session.participants.push(player);
      placement = "confirmed";
    } else {
      session.waitlist.push(player);
      placement = "waitlisted";
    }
    return { session: toView(session), placement };
  }

  leaveSession(id: string, player: string): LeaveSessionResult {
    const session = this.mustFind(id);

    const participantIndex = session.participants.indexOf(player);
    if (participantIndex >= 0) {
      session.participants.splice(participantIndex, 1);
      // 正式名单出现空位时，按候补先后顺序自动补位
      const promoted = session.waitlist.shift() ?? null;
      if (promoted !== null) {
        session.participants.push(promoted);
      }
      return { session: toView(session), removed: "confirmed", promoted };
    }

    const waitlistIndex = session.waitlist.indexOf(player);
    if (waitlistIndex >= 0) {
      session.waitlist.splice(waitlistIndex, 1);
      return { session: toView(session), removed: "waitlisted", promoted: null };
    }

    throw new AppError(404, `玩家「${player}」不在该组局的报名名单中`);
  }

  private mustFind(id: string): GameSession {
    const session = sessionStore.findById(id);
    if (!session) {
      throw new AppError(404, "组局不存在");
    }
    return session;
  }
}
