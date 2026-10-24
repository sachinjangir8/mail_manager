import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { searchService } from "./integrations/elasticsearch/searchService";
import { reconcilePendingJobs } from "./queues/emailQueue";
import { redisConnection } from "./queues/redis";
import { logger } from "./utils/logger";

async function bootstrap() {
  logger.info({ nodeEnv: env.NODE_ENV, port: env.API_PORT }, "Bootstrapping ReachInbox Email Scheduler API...");

  // Initialize Elasticsearch index if available
  await searchService.initIndex().catch((err) => {
    logger.warn({ err }, "Elasticsearch index initialization deferred");
  });

  // Reconcile pending jobs on startup
  await reconcilePendingJobs().catch((err) => {
    logger.warn({ err }, "Initial job reconciliation deferred");
  });

  const app = createApp();
  const server = http.createServer(app);

  const port = Number(process.env.PORT) || env.API_PORT;

  server.listen(port, "0.0.0.0", () => {
    logger.info(`ReachInbox API running at http://localhost:${port}`);
    logger.info(`Swagger OpenAPI Documentation: http://localhost:${port}/api/docs`);
    logger.info(`BullMQ Queue Dashboard: http://localhost:${port}/api/admin/queues`);
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, "Received shutdown signal; closing HTTP server and connections...");
    server.close(async () => {
      try {
        await redisConnection.quit();
        await prisma.$disconnect();
        logger.info("API server and connections closed cleanly");
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error during API shutdown");
        process.exit(1);
      }
    });
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "Failed to start API server");
  process.exit(1);
});
