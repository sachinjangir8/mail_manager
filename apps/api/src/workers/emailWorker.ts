import { Job, Worker } from "bullmq";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { searchService } from "../integrations/elasticsearch/searchService";
import { slackService } from "../integrations/slack/slackService";
import { mailService } from "../integrations/smtp/mailer";
import { DistributedRateLimiter } from "../modules/rate-limits/rateLimiter";
import { EMAIL_QUEUE_NAME, EmailJobData } from "../queues/emailQueue";
import { createRedisClient, redisConnection } from "../queues/redis";
import { decryptToken } from "../utils/crypto";
import { logger } from "../utils/logger";

const rateLimiter = new DistributedRateLimiter(redisConnection);

/**
 * Worker processor function handling a single scheduled email job
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<any> {
  const { emailId, userId, senderId, recipientEmail, subject, body, delayBetweenEmailsMs, hourlyLimit, campaignId } =
    job.data;

  logger.info({ jobId: job.id, emailId, attempt: job.attemptsMade + 1 }, "Starting email job execution");

  // 1. Pre-send Eligibility Check & Atomic Transition to 'processing'
  // Conditional update ensures only one worker can claim the email
  const updatedEmail = await prisma.$transaction(async (tx) => {
    const current = await tx.scheduledEmail.findUnique({
      where: { id: emailId },
      include: {
        sender: true,
      },
    });

    if (!current) {
      throw new Error(`ScheduledEmail record not found for id ${emailId}`);
    }

    if (current.status === "sent") {
      logger.info({ emailId }, "Email already marked sent; skipping duplicate execution");
      return null;
    }

    if (current.status === "cancelled") {
      logger.info({ emailId }, "Email was cancelled; skipping execution");
      return null;
    }

    // Atomically transition to 'processing' and increment attempts
    return tx.scheduledEmail.update({
      where: { id: emailId },
      data: {
        status: "processing",
        attemptCount: { increment: 1 },
      },
      include: {
        sender: true,
      },
    });
  });

  if (!updatedEmail) {
    return { status: "skipped" };
  }

  const sender = updatedEmail.sender;
  if (!sender || !sender.enabled) {
    await prisma.scheduledEmail.update({
      where: { id: emailId },
      data: { status: "failed", failureReason: "Sender disabled or not configured" },
    });
    throw new Error(`Sender ${senderId} is not active`);
  }

  // 2. Distributed Inter-send Delay Slot Reservation
  const slotReservation = await rateLimiter.reserveSendSlot(senderId, delayBetweenEmailsMs);
  if (slotReservation.waitMs > 0) {
    logger.debug({ senderId, waitMs: slotReservation.waitMs }, "Waiting for inter-send delay spacing slot");
    await new Promise((resolve) => setTimeout(resolve, slotReservation.waitMs));
  }

  // 3. Distributed Hourly Rate Limit Check
  const quota = await rateLimiter.checkAndReserveHourlyQuota(senderId, hourlyLimit);
  if (!quota.allowed) {
    logger.warn(
      {
        senderId,
        hourWindow: quota.hourWindow,
        nextEligibleTime: quota.nextEligibleTime,
        reason: quota.reason,
      },
      "Hourly rate limit reached; rescheduling job and triggering Slack alert"
    );

    // Update DB status to rate_limited with next available time
    await prisma.scheduledEmail.update({
      where: { id: emailId },
      data: {
        status: "rate_limited",
        failureReason: `Hourly quota exceeded (${quota.currentCount}/${quota.maxLimit}). Rescheduled for ${quota.nextEligibleTime.toISOString()}`,
      },
    });

    // Notify Slack asynchronously with deduplication
    slackService
      .sendRateLimitAlert({
        userId,
        senderId,
        senderEmail: sender.email,
        senderName: sender.displayName,
        campaignId,
        configuredLimit: quota.maxLimit,
        hourWindow: quota.hourWindow,
        nextEligibleTime: quota.nextEligibleTime,
      })
      .catch((err) => {
        logger.error({ err }, "Slack rate limit alert execution error");
      });

    // Reschedule in BullMQ for next available slot
    const delayForQuota = Math.max(10000, quota.nextEligibleTime.getTime() - Date.now());
    await job.moveToDelayed(Date.now() + delayForQuota, job.token);

    return {
      status: "rate_limited",
      nextEligibleTime: quota.nextEligibleTime,
    };
  }

  // 4. Decrypt SMTP Credentials
  let smtpConfig: { host: string; port: number; user: string; pass: string } | undefined;
  if (!sender.isEthereal && sender.encryptedSmtpPass) {
    try {
      smtpConfig = {
        host: sender.smtpHost,
        port: sender.smtpPort,
        user: decryptToken(sender.encryptedSmtpUser),
        pass: decryptToken(sender.encryptedSmtpPass),
      };
    } catch (err) {
      logger.error({ err }, "Failed to decrypt sender SMTP credentials");
    }
  }

  // 5. Send Email via Nodemailer Ethereal Transport
  const sendResult = await mailService.sendEmail({
    fromName: sender.displayName,
    fromEmail: sender.email,
    to: recipientEmail,
    subject,
    body,
    smtpConfig,
  });

  if (!sendResult.success) {
    await prisma.scheduledEmail.update({
      where: { id: emailId },
      data: {
        status: "failed",
        failureReason: sendResult.error || "Unknown SMTP delivery failure",
      },
    });
    throw new Error(`SMTP Error: ${sendResult.error}`);
  }

  // 6. Record Successful Send in Database
  const sentTime = new Date();
  await prisma.scheduledEmail.update({
    where: { id: emailId },
    data: {
      status: "sent",
      sentTime,
      etherealPreviewUrl: sendResult.previewUrl || null,
      failureReason: null,
    },
  });

  // 7. Idempotently Index in Elasticsearch
  searchService
    .indexEmail({
      id: emailId,
      userId,
      campaignId,
      senderId,
      senderEmail: sender.email,
      recipientEmail,
      subject,
      status: "sent",
      scheduledTime: updatedEmail.scheduledTime.toISOString(),
      sentTime: sentTime.toISOString(),
      createdAt: updatedEmail.createdAt.toISOString(),
    })
    .catch((err) => {
      logger.warn({ err, emailId }, "Async indexing to Elasticsearch encountered error");
    });

  logger.info(
    { emailId, previewUrl: sendResult.previewUrl },
    "Email job completed successfully"
  );

  return {
    status: "sent",
    messageId: sendResult.messageId,
    previewUrl: sendResult.previewUrl,
  };
}

export function startEmailWorker(): Worker<EmailJobData> {
  const workerRedis = createRedisClient();

  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: workerRedis,
    concurrency: env.WORKER_CONCURRENCY,
    lockDuration: 60000,
    stalledInterval: 30000,
  });

  worker.on("ready", () => {
    logger.info({ concurrency: env.WORKER_CONCURRENCY }, "BullMQ Email Worker ready and listening for jobs");
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, emailId: job.data.emailId }, "BullMQ job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, emailId: job?.data.emailId, err: err.message }, "BullMQ job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "BullMQ worker error");
  });

  return worker;
}
