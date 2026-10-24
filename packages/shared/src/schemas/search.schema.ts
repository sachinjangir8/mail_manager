import { z } from "zod";
import { EmailStatusEnum } from "./email.schema";

export const EmailSearchQuerySchema = z.object({
  q: z.string().optional(),
  status: EmailStatusEnum.optional(),
  senderId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type EmailSearchQuery = z.infer<typeof EmailSearchQuerySchema>;
