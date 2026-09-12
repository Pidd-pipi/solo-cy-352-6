import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { SessionService } from "./session.service";
import type { CreateSessionInput } from "./session.types";

const service = new SessionService();

export function listSessions(_request: Request, response: Response) {
  response.json({ sessions: service.listSessions() });
}

export function createSession(request: Request, response: Response, next: NextFunction) {
  if (!ensureValid(request, response)) {
    return;
  }
  const input: CreateSessionInput = {
    title: String(request.body.title).trim(),
    gameName: String(request.body.gameName).trim(),
    location: typeof request.body.location === "string" ? request.body.location.trim() : "",
    startTime: String(request.body.startTime).trim(),
    maxPlayers: Number(request.body.maxPlayers),
    creator: String(request.body.creator).trim(),
  };
  response.status(201).json({ session: service.createSession(input) });
}

export function joinSession(request: Request, response: Response, next: NextFunction) {
  if (!ensureValid(request, response)) {
    return;
  }
  try {
    const player = String(request.body.player).trim();
    const result = service.joinSession(String(request.params.id), player);
    response.json(result);
  } catch (error) {
    next(error);
  }
}

export function leaveSession(request: Request, response: Response, next: NextFunction) {
  if (!ensureValid(request, response)) {
    return;
  }
  try {
    const player = String(request.body.player).trim();
    const result = service.leaveSession(String(request.params.id), player);
    response.json(result);
  } catch (error) {
    next(error);
  }
}

function ensureValid(request: Request, response: Response): boolean {
  const errors = validationResult(request);
  if (errors.isEmpty()) {
    return true;
  }
  const first = errors.array()[0];
  response.status(400).json({ message: first.msg, errors: errors.array() });
  return false;
}
