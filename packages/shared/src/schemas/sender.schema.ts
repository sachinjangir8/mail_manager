import { z } from "zod";
import { isValidEmail } from "./email.schema";

export const CreateSenderSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(100),
  email: z.string().refine(isValidEmail, { message: "Invalid email address" }),
  // SMTP credentials (stored encrypted on server)
  smtpHost: z.string().min(1, "SMTP Host is required").default("smtp.ethereal.email"),
  smtpPort: z.coerce.number().int().default(587),
  smtpUser: z.string().min(1, "SMTP Username is required"),
  smtpPass: z.string().min(1, "SMTP Password is required"),
  isEthereal: z.boolean().default(true),
});

export type CreateSenderInput = z.infer<typeof CreateSenderSchema>;

export const UpdateSenderSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateSenderInput = z.infer<typeof UpdateSenderSchema>;

export const SenderResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  email: z.string().email(),
  smtpHost: z.string(),
  smtpPort: z.number(),
  isEthereal: z.boolean(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SenderResponse = z.infer<typeof SenderResponseSchema>;
