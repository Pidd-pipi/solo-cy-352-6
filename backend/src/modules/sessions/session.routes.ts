import { Router } from "express";
import { body } from "express-validator";
import {
  createSession,
  joinSession,
  leaveSession,
  listSessions,
} from "./session.controller";

export const sessionRouter = Router();

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
    body("startTime").isString().trim().notEmpty().withMessage("开局时间不能为空")
      .isLength({ max: 40 }).withMessage("开局时间格式不正确"),
    body("maxPlayers").isInt({ min: 2, max: 20 }).withMessage("人数上限需为 2-20 的整数"),
    body("creator").isString().trim().notEmpty().withMessage("发起人昵称不能为空")
      .isLength({ max: 24 }).withMessage("发起人昵称不能超过 24 个字符"),
  ],
  createSession,
);

sessionRouter.post("/sessions/:id/join", [playerValidation], joinSession);
sessionRouter.post("/sessions/:id/leave", [playerValidation], leaveSession);
