import { Queue, QueueEvents } from "bullmq";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";
import { redisConnection } from "./redis";

export const EMAIL_QUEUE_NAME = "email-scheduler-queue";

export interface EmailJobData {
  emailId: string;
  userId: string;
  campaignId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledTime: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep completed jobs for 24h for Bull Board inspection
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failed jobs for 7 days
      count: 5000,
    },
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
});

/**
 * Calculates delay in milliseconds from now until scheduled UTC date
 */
export function calculateJobDelayMs(scheduledTimeUtc: string | Date): number {
  const targetMs = new Date(scheduledTimeUtc).getTime();
  const nowMs = Date.now();
  return Math.max(0, targetMs - nowMs);
}

/**
 * Dispatches a delayed job to BullMQ with a deterministic Job ID
 */
export async function scheduleEmailJob(jobData: EmailJobData): Promise<string> {
  const deterministicJobId = `email_${jobData.emailId}`;
  const delayMs = calculateJobDelayMs(jobData.scheduledTime);

  const job = await emailQueue.add(
    "send-scheduled-email",
    jobData,
    {
      jobId: deterministicJobId,
      delay: delayMs,
    }
  );

  return job.id!;
}

/**
 * Controlled Startup Recovery:
 * Checks database for scheduled/queued emails that might be missing from BullMQ
 * without using cron.
 */
export async function reconcilePendingJobs(): Promise<{ checked: number; reQueued: number }> {
  try {
    const pendingEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: { in: ["scheduled", "queued", "rate_limited"] },
      },
      take: 200,
      include: {
        campaign: { select: { delayBetweenSendsMs: true, hourlyLimit: true } },
      },
    });

    let reQueued = 0;
    for (const email of pendingEmails) {
      const jobId = `email_${email.id}`;
      const existingJob = await emailQueue.getJob(jobId);

      // If job doesn't exist in Redis or was removed, re-add idempotently
      if (!existingJob) {
        await scheduleEmailJob({
          emailId: email.id,
          userId: email.userId,
          campaignId: email.campaignId,
          senderId: email.senderId,
          recipientEmail: email.recipientEmail,
          subject: email.subject,
          body: email.body,
          scheduledTime: email.scheduledTime.toISOString(),
          delayBetweenEmailsMs: email.campaign?.delayBetweenSendsMs || env.DEFAULT_SEND_DELAY_MS,
          hourlyLimit: email.campaign?.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER,
        });

        await prisma.scheduledEmail.update({
          where: { id: email.id },
          data: { bullMqJobId: jobId, status: "scheduled" },
        });

        reQueued++;
      }
    }

    if (reQueued > 0) {
      logger.info({ checked: pendingEmails.length, reQueued }, "Controlled recovery restored missing queue jobs");
    }

    return { checked: pendingEmails.length, reQueued };
  } catch (err: unknown) {
    logger.warn({ err }, "Could not run startup queue reconciliation (Redis or DB might be warming up)");
    return { checked: 0, reQueued: 0 };
  }
}
