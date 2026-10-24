import { Request, Response, Router } from "express";
import { prisma } from "../../db/prisma";
import { searchService } from "../../integrations/elasticsearch/searchService";
import { redisConnection } from "../../queues/redis";

export const healthRouter = Router();

healthRouter.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get("/ready", async (req: Request, res: Response) => {
  const checks: Record<string, boolean> = {
    database: false,
    redis: false,
    elasticsearch: false,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    const ping = await redisConnection.ping();
    checks.redis = ping === "PONG";
  } catch {
    checks.redis = false;
  }

  try {
    checks.elasticsearch = await searchService.initIndex();
  } catch {
    checks.elasticsearch = false;
  }

  // System is ready if database is up
  const isReady = checks.database;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  });
});
