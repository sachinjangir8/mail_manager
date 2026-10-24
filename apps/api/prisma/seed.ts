import { PrismaClient } from "@prisma/client";
import { encryptToken } from "../src/utils/crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with default Oliver Brown profile matching Figma...");

  const user = await prisma.user.upsert({
    where: { email: "oliver.brown@domain.io" },
    create: {
      googleId: "google_sub_oliver_brown_12345",
      email: "oliver.brown@domain.io",
      name: "Oliver Brown",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces",
    },
    update: {},
  });

  const sender = await prisma.emailSender.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      userId: user.id,
      displayName: "Oliver Brown",
      email: "oliver.brown@domain.io",
      smtpHost: "smtp.ethereal.email",
      smtpPort: 587,
      encryptedSmtpUser: encryptToken("ethereal_seed_user"),
      encryptedSmtpPass: encryptToken("ethereal_seed_pass"),
      isEthereal: true,
      enabled: true,
    },
    update: {},
  });

  const campaign = await prisma.emailCampaign.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      userId: user.id,
      subject: "Meeting follow-up - Scheduled",
      body: "<p>Hi John, just wanted to follow up on our meeting yesterday and see if you had any questions regarding the proposal.</p>",
      startTime: new Date(Date.now() + 3600000), // 1 hour in future
      delayBetweenSendsMs: 5000,
      hourlyLimit: 20,
      status: "scheduled",
    },
    update: {},
  });

  // Scheduled Email 1
  await prisma.scheduledEmail.upsert({
    where: { idempotencyKey: "seed_email_1" },
    create: {
      userId: user.id,
      campaignId: campaign.id,
      senderId: sender.id,
      recipientEmail: "john.smith@example.com",
      subject: "Meeting follow-up - Scheduled",
      body: "<p>Hi John, just wanted to follow up on our meeting yesterday.</p>",
      scheduledTime: new Date(Date.now() + 3600000),
      status: "scheduled",
      idempotencyKey: "seed_email_1",
    },
    update: {},
  });

  // Scheduled Email 2
  await prisma.scheduledEmail.upsert({
    where: { idempotencyKey: "seed_email_2" },
    create: {
      userId: user.id,
      campaignId: campaign.id,
      senderId: sender.id,
      recipientEmail: "olive@example.com",
      subject: "Persist, great to meet you - you'll love it!",
      body: "<p>Hi Olive, just wanted to follow up on our recent conversation.</p>",
      scheduledTime: new Date(Date.now() + 7200000),
      status: "scheduled",
      idempotencyKey: "seed_email_2",
    },
    update: {},
  });

  // Sent Email 1
  await prisma.scheduledEmail.upsert({
    where: { idempotencyKey: "seed_email_sent_1" },
    create: {
      userId: user.id,
      campaignId: campaign.id,
      senderId: sender.id,
      recipientEmail: "sarah.wilcox@example.com",
      subject: "Re: Project Update",
      body: "<p>Thanks for the update, Sarah. Looks good!</p>",
      scheduledTime: new Date(Date.now() - 3600000),
      sentTime: new Date(Date.now() - 3590000),
      status: "sent",
      etherealPreviewUrl: "https://ethereal.email/message/seed_1",
      idempotencyKey: "seed_email_sent_1",
    },
    update: {},
  });

  // Sent Email 2
  await prisma.scheduledEmail.upsert({
    where: { idempotencyKey: "seed_email_sent_2" },
    create: {
      userId: user.id,
      campaignId: campaign.id,
      senderId: sender.id,
      recipientEmail: "support@example.com",
      subject: "Issue with login",
      body: "<p>I am having trouble logging in to the dashboard with my credentials.</p>",
      scheduledTime: new Date(Date.now() - 7200000),
      sentTime: new Date(Date.now() - 7190000),
      status: "sent",
      etherealPreviewUrl: "https://ethereal.email/message/seed_2",
      idempotencyKey: "seed_email_sent_2",
    },
    update: {},
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
