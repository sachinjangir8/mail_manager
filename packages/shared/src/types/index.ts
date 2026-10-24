import { EmailStatus } from "../schemas/email.schema";

export interface ScheduledEmailDto {
  id: string;
  userId: string;
  campaignId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: EmailStatus;
  jobId: string | null;
  attemptCount: number;
  sentAt: string | null;
  failureReason: string | null;
  etherealPreviewUrl: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CampaignSummaryDto {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenSendsMs: number;
  hourlyLimit: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QueueSummaryDto {
  waiting: number;
  delayed: number;
  active: number;
  completed: number;
  failed: number;
  paused: boolean;
}
