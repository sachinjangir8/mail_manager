import { z } from "zod";

export const SlackStatusResponseSchema = z.object({
  connected: z.boolean(),
  workspaceName: z.string().nullable().optional(),
  channelId: z.string().nullable().optional(),
  channelName: z.string().nullable().optional(),
  connectedAt: z.string().nullable().optional(),
});

export type SlackStatusResponse = z.infer<typeof SlackStatusResponseSchema>;

export const SlackConnectUrlResponseSchema = z.object({
  url: z.string().url(),
});

export const SlackCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
