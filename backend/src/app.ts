import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { AppError } from "./common/errors";
import { logger } from "./common/logger";
import { overviewRouter } from "./modules/overview/overview.routes";
import { sessionRouter } from "./modules/sessions/session.routes";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => response.json({ status: "ok" }));
app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
app.use("/", overviewRouter);
app.use("/", sessionRouter);
app.use("/api", overviewRouter);
app.use("/api", sessionRouter);

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }
  logger.error(error instanceof Error ? error.message : String(error));
  response.status(500).json({ message: "服务器内部错误" });
});
