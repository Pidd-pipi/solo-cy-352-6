export type SessionStatus = "open" | "full";

export interface GameSession {
  id: string;
  title: string;
  gameName: string;
  location: string;
  startTime: string;
  maxPlayers: number;
  creator: string;
  createdAt: string;
  participants: string[];
  waitlist: string[];
}

export interface GameSessionView extends GameSession {
  participantCount: number;
  waitlistCount: number;
  status: SessionStatus;
}

export interface CreateSessionInput {
  title: string;
  gameName: string;
  location?: string;
  startTime: string;
  maxPlayers: number;
  creator: string;
}

export interface JoinSessionResult {
  session: GameSessionView;
  placement: "confirmed" | "waitlisted";
}

export interface LeaveSessionResult {
  session: GameSessionView;
  removed: "confirmed" | "waitlisted";
  promoted: string | null;
}
