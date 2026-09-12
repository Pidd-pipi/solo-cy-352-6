import { Router } from "express";
import { body } from "express-validator";
import {
  createSession,
  joinSession,
  leaveSession,
  listSessions,
} from "./session.controller";

export const sessionRouter = Router();

/**
 * 解析开局时间：接受 ISO 8601（日期与时间之间允许用空格分隔）。
 * 无法解析时返回 NaN。
 */
function parseStartTime(value: unknown): number {
  if (typeof value !== "string") {
    return Number.NaN;
  }
  return Date.parse(value.trim().replace(/\s+/, "T"));
}

const startTimeValidation = body("startTime")
  .isString()
  .withMessage("开局时间必须是字符串")
  .trim()
  .notEmpty()
  .withMessage("开局时间不能为空")
  .custom((value) => !Number.isNaN(parseStartTime(value)))
  .withMessage("开局时间必须是合法的日期时间")
  .custom((value) => parseStartTime(value) >= Date.now())
  .withMessage("开局时间不能早于当前时刻");

const playerValidation = body("player")
  .isString()
  .withMessage("玩家昵称必须是字符串")
  .trim()
  .notEmpty()
  .withMessage("玩家昵称不能为空")
  .isLength({ max: 24 })
  .withMessage("玩家昵称不能超过 24 个字符");

sessionRouter.get("/sessions", listSessions);

sessionRouter.post(
  "/sessions",
  [
    body("title").isString().trim().notEmpty().withMessage("组局标题不能为空")
      .isLength({ max: 60 }).withMessage("组局标题不能超过 60 个字符"),
    body("gameName").isString().trim().notEmpty().withMessage("桌游名称不能为空")
      .isLength({ max: 60 }).withMessage("桌游名称不能超过 60 个字符"),
    body("location").optional({ values: "falsy" }).isString().trim()
      .isLength({ max: 60 }).withMessage("地点不能超过 60 个字符"),
    startTimeValidation,
    body("maxPlayers").isInt({ min: 2, max: 20 }).withMessage("人数上限需为 2-20 的整数"),
    body("creator").isString().trim().notEmpty().withMessage("发起人昵称不能为空")
      .isLength({ max: 24 }).withMessage("发起人昵称不能超过 24 个字符"),
  ],
  createSession,
);

sessionRouter.post("/sessions/:id/join", [playerValidation], joinSession);
sessionRouter.post("/sessions/:id/leave", [playerValidation], leaveSession);
