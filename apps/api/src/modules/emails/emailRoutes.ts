import { EmailSearchQuerySchema, ScheduleEmailsSchema, parseRecipientsContent } from "@reachinbox/shared";
import { Request, Response, Router } from "express";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { searchService } from "../../integrations/elasticsearch/searchService";
import { requireAuth } from "../../middleware/auth";
import { emailQueue, scheduleEmailJob } from "../../queues/emailQueue";
import { generateIdempotencyKey } from "../../utils/crypto";
import { logger } from "../../utils/logger";

export const emailRouter = Router();

emailRouter.use(requireAuth);

/**
 * Schedules emails for a campaign with transactional persistence and BullMQ delayed jobs
 */
emailRouter.post("/schedule", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const validated = ScheduleEmailsSchema.parse(req.body);

  // 1. Verify Sender Ownership
  const sender = await prisma.emailSender.findFirst({
    where: { id: validated.senderId, userId },
  });

  if (!sender) {
    res.status(404).json({ success: false, error: "Sender not found or not owned by user" });
    return;
  }

  // 2. Normalize and Deduplicate Recipients
  const rawRecipientList = validated.recipients;
  const parseResult = parseRecipientsContent(rawRecipientList.join("\n"));

  if (parseResult.valid.length === 0) {
    res.status(400).json({
      success: false,
      error: "No valid recipient email addresses provided",
      rejected: parseResult.invalid,
      duplicates: parseResult.duplicates,
    });
    return;
  }

  // 3. Campaign Idempotency Protection
  const idempotencyKey =
    validated.idempotencyKey ||
    generateIdempotencyKey([
      userId,
      validated.senderId,
      validated.subject,
      validated.scheduledAt,
      parseResult.valid.join(","),
    ]);

  // Check if campaign with same idempotency key already exists
  const existingCampaign = await prisma.emailCampaign.findUnique({
    where: {
      userId_idempotencyKey: {
        userId,
        idempotencyKey,
      },
    },
    include: {
      emails: { select: { id: true, recipientEmail: true, status: true, scheduledTime: true } },
    },
  });

  if (existingCampaign) {
    logger.info({ campaignId: existingCampaign.id, idempotencyKey }, "Duplicate campaign submission detected; returning existing records");
    res.status(200).json({
      success: true,
      message: "Campaign already scheduled (idempotent response)",
      campaign: {
        id: existingCampaign.id,
        status: existingCampaign.status,
        totalRecipients: existingCampaign.emails.length,
        scheduledAt: existingCampaign.startTime.toISOString(),
      },
      acceptedRecipients: existingCampaign.emails.map((e) => e.recipientEmail),
      rejectedRecipients: parseResult.invalid,
      duplicateRecipients: parseResult.duplicates,
    });
    return;
  }

  // 4. Calculate Scheduled Times per Recipient
  const startMs = new Date(validated.scheduledAt).getTime();
  const delayMs = Math.max(env.MIN_SEND_DELAY_MS, validated.delayBetweenEmailsMs);

  const emailItemsToCreate = parseResult.valid.map((recipientEmail, index) => {
    // Space the initial scheduled timestamp according to delayBetweenEmailsMs
    const emailScheduledTime = new Date(startMs + index * delayMs);
    const emailIdempotencyKey = generateIdempotencyKey([idempotencyKey, recipientEmail, index.toString()]);

    return {
      recipientEmail,
      scheduledTime: emailScheduledTime,
      idempotencyKey: emailIdempotencyKey,
    };
  });

  // 5. Transactional Persistence: Campaign, ScheduledEmails, and OutboxEvents
  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.emailCampaign.create({
      data: {
        userId,
        subject: validated.subject,
        body: validated.body,
        startTime: new Date(validated.scheduledAt),
        delayBetweenSendsMs: delayMs,
        hourlyLimit: validated.hourlyLimit,
        idempotencyKey,
        status: "scheduled",
      },
    });

    const createdEmails = await Promise.all(
      emailItemsToCreate.map((item) =>
        tx.scheduledEmail.create({
          data: {
            userId,
            campaignId: campaign.id,
            senderId: validated.senderId,
            recipientEmail: item.recipientEmail,
            subject: validated.subject,
            body: validated.body,
            scheduledTime: item.scheduledTime,
            status: "scheduled",
            idempotencyKey: item.idempotencyKey,
          },
        })
      )
    );

    // Create durable outbox records to guarantee queue delivery
    await Promise.all(
      createdEmails.map((email) =>
        tx.outboxEvent.create({
          data: {
            aggregateType: "EMAIL_SCHEDULE",
            aggregateId: email.id,
            eventType: "SCHEDULE_JOB",
            payload: JSON.stringify({
              emailId: email.id,
              userId: email.userId,
              campaignId: campaign.id,
              senderId: email.senderId,
              recipientEmail: email.recipientEmail,
              subject: email.subject,
              body: email.body,
              scheduledTime: email.scheduledTime.toISOString(),
              delayBetweenEmailsMs: delayMs,
              hourlyLimit: validated.hourlyLimit,
            }),
            status: "PENDING",
          },
        })
      )
    );

    return { campaign, createdEmails };
  });

  // 6. Dispatch BullMQ Delayed Jobs to Redis
  const jobDispatches = await Promise.allSettled(
    result.createdEmails.map(async (email) => {
      const jobId = await scheduleEmailJob({
        emailId: email.id,
        userId: email.userId,
        campaignId: result.campaign.id,
        senderId: email.senderId,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        scheduledTime: email.scheduledTime.toISOString(),
        delayBetweenEmailsMs: delayMs,
        hourlyLimit: validated.hourlyLimit,
      });

      // Update email with BullMQ job ID
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { bullMqJobId: jobId },
      });

      // Mark outbox record as processed
      await prisma.outboxEvent.updateMany({
        where: { aggregateId: email.id, aggregateType: "EMAIL_SCHEDULE" },
        data: { status: "PROCESSED", processedAt: new Date() },
      });

      return jobId;
    })
  );

  const queuedCount = jobDispatches.filter((p) => p.status === "fulfilled").length;

  logger.info(
    {
      campaignId: result.campaign.id,
      totalRecipients: parseResult.valid.length,
      queuedCount,
    },
    "Campaign scheduled and dispatched to BullMQ"
  );

  res.status(201).json({
    success: true,
    campaignId: result.campaign.id,
    totalScheduled: result.createdEmails.length,
    acceptedRecipients: parseResult.valid,
    rejectedRecipients: parseResult.invalid,
    duplicateRecipients: parseResult.duplicates,
    startTime: result.campaign.startTime.toISOString(),
    delayBetweenSendsMs: delayMs,
    hourlyLimit: validated.hourlyLimit,
  });
});

/**
 * Lists scheduled (pending, queued, or rate_limited) emails for the user
 */
emailRouter.get("/scheduled", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const where = {
    userId,
    status: { in: ["scheduled", "queued", "rate_limited", "processing"] },
  };

  const [total, records] = await Promise.all([
    prisma.scheduledEmail.count({ where }),
    prisma.scheduledEmail.findMany({
      where,
      orderBy: { scheduledTime: "asc" },
      skip,
      take: limit,
      include: {
        sender: { select: { email: true, displayName: true } },
      },
    }),
  ]);

  const items = records.map((r) => ({
    id: r.id,
    userId: r.userId,
    campaignId: r.campaignId,
    senderId: r.senderId,
    senderEmail: r.sender.email,
    senderName: r.sender.displayName,
    recipientEmail: r.recipientEmail,
    subject: r.subject,
    body: r.body,
    scheduledAt: r.scheduledTime.toISOString(),
    status: r.status,
    jobId: r.bullMqJobId,
    attemptCount: r.attemptCount,
    sentAt: r.sentTime ? r.sentTime.toISOString() : null,
    failureReason: r.failureReason,
    etherealPreviewUrl: r.etherealPreviewUrl,
    idempotencyKey: r.idempotencyKey,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  res.status(200).json({
    success: true,
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

/**
 * Lists sent and failed emails for the user
 */
emailRouter.get("/sent", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const where = {
    userId,
    status: { in: ["sent", "failed"] },
  };

  const [total, records] = await Promise.all([
    prisma.scheduledEmail.count({ where }),
    prisma.scheduledEmail.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      include: {
        sender: { select: { email: true, displayName: true } },
      },
    }),
  ]);

  const items = records.map((r) => ({
    id: r.id,
    userId: r.userId,
    campaignId: r.campaignId,
    senderId: r.senderId,
    senderEmail: r.sender.email,
    senderName: r.sender.displayName,
    recipientEmail: r.recipientEmail,
    subject: r.subject,
    body: r.body,
    scheduledAt: r.scheduledTime.toISOString(),
    status: r.status,
    jobId: r.bullMqJobId,
    attemptCount: r.attemptCount,
    sentAt: r.sentTime ? r.sentTime.toISOString() : null,
    failureReason: r.failureReason,
    etherealPreviewUrl: r.etherealPreviewUrl,
    idempotencyKey: r.idempotencyKey,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  res.status(200).json({
    success: true,
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

/**
 * Search emails via Elasticsearch (with fallback)
 */
emailRouter.get("/search", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const validated = EmailSearchQuerySchema.parse(req.query);

  const searchResult = await searchService.searchEmails({
    userId,
    query: validated.q,
    status: validated.status,
    senderId: validated.senderId,
    campaignId: validated.campaignId,
    startDate: validated.startDate,
    endDate: validated.endDate,
    page: validated.page,
    limit: validated.limit,
  });

  res.status(200).json({ success: true, ...searchResult });
});

/**
 * Gets details of a single email record
 */
emailRouter.get("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params.id as string;

  const email = await prisma.scheduledEmail.findFirst({
    where: { id, userId },
    include: {
      sender: { select: { email: true, displayName: true } },
      campaign: true,
    },
  });

  if (!email) {
    res.status(404).json({ success: false, error: "Email record not found" });
    return;
  }

  res.status(200).json({
    success: true,
    email: {
      id: email.id,
      userId: email.userId,
      campaignId: email.campaignId,
      senderId: email.senderId,
      senderEmail: email.sender?.email || "",
      senderName: email.sender?.displayName || "",
      recipientEmail: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      scheduledAt: email.scheduledTime.toISOString(),
      status: email.status,
      jobId: email.bullMqJobId,
      attemptCount: email.attemptCount,
      sentAt: email.sentTime ? email.sentTime.toISOString() : null,
      failureReason: email.failureReason,
      etherealPreviewUrl: email.etherealPreviewUrl,
      idempotencyKey: email.idempotencyKey,
      createdAt: email.createdAt.toISOString(),
      updatedAt: email.updatedAt.toISOString(),
    },
  });
});

/**
 * Cancels a campaign and pending scheduled emails
 */
emailRouter.post("/campaigns/:id/cancel", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params.id as string;

  const campaign = await prisma.emailCampaign.findFirst({
    where: { id, userId },
  });

  if (!campaign) {
    res.status(404).json({ success: false, error: "Campaign not found" });
    return;
  }

  // Find all pending emails
  const pendingEmails = await prisma.scheduledEmail.findMany({
    where: {
      campaignId: id,
      userId,
      status: { in: ["scheduled", "queued", "rate_limited"] },
    },
  });

  // Remove jobs from BullMQ
  for (const email of pendingEmails) {
    if (email.bullMqJobId) {
      try {
        const job = await emailQueue.getJob(email.bullMqJobId);
        if (job) await job.remove();
      } catch (err) {
        logger.warn({ err, jobId: email.bullMqJobId }, "Could not remove job during cancellation");
      }
    }
  }

  // Update DB status to cancelled
  await prisma.scheduledEmail.updateMany({
    where: {
      campaignId: id,
      userId,
      status: { in: ["scheduled", "queued", "rate_limited"] },
    },
    data: { status: "cancelled" },
  });

  await prisma.emailCampaign.update({
    where: { id },
    data: { status: "cancelled" },
  });

  res.status(200).json({
    success: true,
    message: "Campaign cancelled successfully",
    cancelledCount: pendingEmails.length,
  });
});

/**
 * Queue metrics summary
 */
emailRouter.get("/queue/summary", async (req: Request, res: Response) => {
  try {
    const [waiting, delayed, active, completed, failed, isPaused] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getActiveCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
      emailQueue.isPaused(),
    ]);

    res.status(200).json({
      success: true,
      queue: {
        waiting,
        delayed,
        active,
        completed,
        failed,
        paused: isPaused,
      },
    });
  } catch (err: unknown) {
    logger.warn({ err }, "Could not fetch BullMQ queue metrics");
    res.status(200).json({
      success: true,
      queue: {
        waiting: 0,
        delayed: 0,
        active: 0,
        completed: 0,
        failed: 0,
        paused: false,
      },
    });
  }
});
