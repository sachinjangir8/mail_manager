import { CreateSenderSchema, UpdateSenderSchema } from "@reachinbox/shared";
import { Request, Response, Router } from "express";
import nodemailer from "nodemailer";
import { prisma } from "../../db/prisma";
import { requireAuth } from "../../middleware/auth";
import { encryptToken } from "../../utils/crypto";
import { logger } from "../../utils/logger";

export const senderRouter = Router();

senderRouter.use(requireAuth);

/**
 * Lists senders owned by the authenticated user
 */
senderRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const senders = await prisma.emailSender.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const sanitized = senders.map((s) => ({
    id: s.id,
    userId: s.userId,
    displayName: s.displayName,
    email: s.email,
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    isEthereal: s.isEthereal,
    enabled: s.enabled,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  res.status(200).json({ success: true, senders: sanitized });
});

/**
 * Creates a new sender (supports manual SMTP config or automatic Ethereal generation)
 */
senderRouter.post("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { autoGenerateEthereal, displayName, email } = req.body;

  let host = req.body.smtpHost || "smtp.ethereal.email";
  let port = Number(req.body.smtpPort) || 587;
  let user = req.body.smtpUser;
  let pass = req.body.smtpPass;
  let senderEmail = email;
  let senderName = displayName || "Email Sender";

  if (autoGenerateEthereal) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      host = testAccount.smtp.host;
      port = testAccount.smtp.port;
      user = testAccount.user;
      pass = testAccount.pass;
      senderEmail = testAccount.user;
      senderName = displayName || `Ethereal Test Sender (${testAccount.user.split("@")[0]})`;
    } catch (err) {
      logger.error({ err }, "Failed to auto-generate Ethereal account");
      res.status(500).json({ success: false, error: "Failed to generate Ethereal SMTP account" });
      return;
    }
  } else {
    const validated = CreateSenderSchema.parse(req.body);
    host = validated.smtpHost;
    port = validated.smtpPort;
    user = validated.smtpUser;
    pass = validated.smtpPass;
    senderEmail = validated.email;
    senderName = validated.displayName;
  }

  const newSender = await prisma.emailSender.create({
    data: {
      userId,
      displayName: senderName,
      email: senderEmail,
      smtpHost: host,
      smtpPort: port,
      encryptedSmtpUser: encryptToken(user),
      encryptedSmtpPass: encryptToken(pass),
      isEthereal: host.includes("ethereal"),
      enabled: true,
    },
  });

  res.status(201).json({
    success: true,
    sender: {
      id: newSender.id,
      userId: newSender.userId,
      displayName: newSender.displayName,
      email: newSender.email,
      smtpHost: newSender.smtpHost,
      smtpPort: newSender.smtpPort,
      isEthereal: newSender.isEthereal,
      enabled: newSender.enabled,
      createdAt: newSender.createdAt.toISOString(),
      updatedAt: newSender.updatedAt.toISOString(),
    },
  });
});

/**
 * Updates sender display name or enabled status
 */
senderRouter.patch("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const validated = UpdateSenderSchema.parse(req.body);

  const sender = await prisma.emailSender.findFirst({
    where: { id, userId },
  });

  if (!sender) {
    res.status(404).json({ success: false, error: "Sender not found or unauthorized" });
    return;
  }

  const updated = await prisma.emailSender.update({
    where: { id },
    data: validated,
  });

  res.status(200).json({
    success: true,
    sender: {
      id: updated.id,
      userId: updated.userId,
      displayName: updated.displayName,
      email: updated.email,
      smtpHost: updated.smtpHost,
      smtpPort: updated.smtpPort,
      isEthereal: updated.isEthereal,
      enabled: updated.enabled,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

/**
 * Deletes sender
 */
senderRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params.id as string;

  const sender = await prisma.emailSender.findFirst({
    where: { id, userId },
  });

  if (!sender) {
    res.status(404).json({ success: false, error: "Sender not found or unauthorized" });
    return;
  }

  await prisma.emailSender.delete({ where: { id } });

  res.status(200).json({ success: true, message: "Sender deleted successfully" });
});
