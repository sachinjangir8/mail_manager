import { z } from "zod";

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  googleId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const GoogleAuthCallbackQuerySchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().min(1, "State token is required"),
});

export type GoogleAuthCallbackQuery = z.infer<typeof GoogleAuthCallbackQuerySchema>;
