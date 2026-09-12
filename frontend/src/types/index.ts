export interface FeatureItem {
  id: number;
  title: string;
  description: string;
  status: string;
  metric: string;
}

export interface KpiItem {
  label: string;
  value: string;
  trend: string;
  tone: string;
}

export interface OperationRecord {
  key: string;
  name: string;
  owner: string;
  status: string;
  metric: string;
  priority: string;
}

export interface OverviewResponse {
  appName: string;
  appCode: string;
  description: string;
  features: FeatureItem[];
  kpis: KpiItem[];
  records: OperationRecord[];
}

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
  participantCount: number;
  waitlistCount: number;
  status: SessionStatus;
}

export interface CreateSessionPayload {
  title: string;
  gameName: string;
  location?: string;
  startTime: string;
  maxPlayers: number;
  creator: string;
}

export interface JoinSessionResponse {
  session: GameSession;
  placement: "confirmed" | "waitlisted";
}

export interface LeaveSessionResponse {
  session: GameSession;
  removed: "confirmed" | "waitlisted";
  promoted: string | null;
}
