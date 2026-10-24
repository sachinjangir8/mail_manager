import { prisma } from "./db/prisma";
import { reconcilePendingJobs } from "./queues/emailQueue";
import { redisConnection } from "./queues/redis";
import { logger } from "./utils/logger";
import { startEmailWorker } from "./workers/emailWorker";

async function main() {
  logger.info("Initializing ReachInbox Dedicated Worker Process...");

  // Run controlled startup reconciliation for pending emails
  await reconcilePendingJobs();

  const worker = startEmailWorker();

  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, "Received termination signal, shutting down worker gracefully...");
    try {
      await worker.close();
      await redisConnection.quit();
      await prisma.$disconnect();
      logger.info("Worker process terminated cleanly");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during worker graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal error starting worker process");
  process.exit(1);
});
