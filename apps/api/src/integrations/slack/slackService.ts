import { WebClient } from "@slack/web-api";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { decryptToken, encryptToken } from "../../utils/crypto";
import { logger } from "../../utils/logger";

export interface SendRateLimitAlertParams {
  userId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  campaignId?: string;
  configuredLimit: number;
  hourWindow: string;
  nextEligibleTime: Date;
}

export class SlackService {
  /**
   * Generates the Slack OAuth authorization URL with state
   */
  public getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: env.SLACK_SCOPES,
      redirect_uri: env.SLACK_CALLBACK_URL,
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for access token via Slack Web API
   */
  public async exchangeCode(code: string, userId: string): Promise<void> {
    const client = new WebClient();
    const response = await client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_CALLBACK_URL,
    });

    if (!response.ok || !response.access_token) {
      throw new Error(`Slack OAuth failed: ${response.error || "No access token"}`);
    }

    const encryptedAccessToken = encryptToken(response.access_token as string);
    const encryptedRefreshToken = response.refresh_token
      ? encryptToken(response.refresh_token as string)
      : null;

    const workspaceName = response.team?.name || null;
    const channelId = response.incoming_webhook?.channel_id || env.SLACK_DEFAULT_CHANNEL_ID || null;
    const channelName = response.incoming_webhook?.channel || null;
    const scopes = response.scope || env.SLACK_SCOPES;
    const expiresAt = response.expires_in
      ? new Date(Date.now() + Number(response.expires_in) * 1000)
      : null;

    await prisma.oAuthIntegration.upsert({
      where: {
        userId_provider: {
          userId,
          provider: "slack",
        },
      },
      create: {
        userId,
        provider: "slack",
        encryptedAccessToken,
        encryptedRefreshToken,
        scopes,
        workspaceName,
        channelId,
        channelName,
        expiresAt,
        status: "connected",
      },
      update: {
        encryptedAccessToken,
        encryptedRefreshToken,
        scopes,
        workspaceName,
        channelId: channelId || undefined,
        channelName: channelName || undefined,
        expiresAt,
        status: "connected",
      },
    });

    logger.info({ userId, workspaceName }, "Slack integration connected successfully");
  }

  /**
   * Disconnects Slack integration
   */
  public async disconnect(userId: string): Promise<void> {
    await prisma.oAuthIntegration.updateMany({
      where: { userId, provider: "slack" },
      data: { status: "disconnected" },
    });
    logger.info({ userId }, "Slack integration disconnected");
  }

  /**
   * Gets integration status for user
   */
  public async getStatus(userId: string) {
    const integration = await prisma.oAuthIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: "slack",
        },
      },
    });

    if (!integration || integration.status !== "connected") {
      return {
        connected: false,
        workspaceName: null,
        channelId: null,
        channelName: null,
        connectedAt: null,
      };
    }

    return {
      connected: true,
      workspaceName: integration.workspaceName,
      channelId: integration.channelId,
      channelName: integration.channelName,
      connectedAt: integration.updatedAt.toISOString(),
    };
  }

  /**
   * Sends an hourly rate limit alert to Slack with strict deduplication
   */
  public async sendRateLimitAlert(params: SendRateLimitAlertParams): Promise<boolean> {
    const {
      userId,
      senderId,
      senderEmail,
      senderName,
      campaignId,
      configuredLimit,
      hourWindow,
      nextEligibleTime,
    } = params;

    // 1. Deduplication check in Database
    const existingEvent = await prisma.rateLimitEvent.findUnique({
      where: {
        senderId_hourWindow_eventType: {
          senderId,
          hourWindow,
          eventType: "HOURLY_LIMIT_REACHED",
        },
      },
    });

    if (existingEvent && existingEvent.notificationState === "SENT") {
      logger.info({ senderId, hourWindow }, "Slack rate limit alert already sent for this window; skipping duplicate");
      return true;
    }

    // Record or update event
    const event = await prisma.rateLimitEvent.upsert({
      where: {
        senderId_hourWindow_eventType: {
          senderId,
          hourWindow,
          eventType: "HOURLY_LIMIT_REACHED",
        },
      },
      create: {
        senderId,
        userId,
        hourWindow,
        eventType: "HOURLY_LIMIT_REACHED",
        notificationState: "PENDING",
        nextEligibleTime,
      },
      update: {
        nextEligibleTime,
      },
    });

    // 2. Fetch user's Slack integration
    const integration = await prisma.oAuthIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: "slack",
        },
      },
    });

    if (!integration || integration.status !== "connected" || !integration.encryptedAccessToken) {
      logger.info({ userId }, "Slack integration not connected; alert marked as SKIPPED");
      await prisma.rateLimitEvent.update({
        where: { id: event.id },
        data: { notificationState: "SKIPPED" },
      });
      return false;
    }

    try {
      const accessToken = decryptToken(integration.encryptedAccessToken);
      const slackClient = new WebClient(accessToken);

      // Resolve channel: integration channel or default channel
      const channel = integration.channelId || env.SLACK_DEFAULT_CHANNEL_ID;
      if (!channel) {
        logger.warn({ userId }, "No Slack channel configured for notification");
        return false;
      }

      const formattedNextTime = nextEligibleTime.toUTCString();
      const messageText = `⚠️ *ReachInbox Hourly Rate Limit Reached*\n• *Sender:* ${senderName} (${senderEmail})\n• *Configured Limit:* ${configuredLimit} emails/hour\n• *Hour Window:* ${hourWindow}\n• *Next Eligible Send Time:* ${formattedNextTime}${
        campaignId ? `\n• *Campaign ID:* ${campaignId}` : ""
      }\n_Subsequent emails have been automatically rescheduled for the next available window._`;

      await slackClient.chat.postMessage({
        channel,
        text: messageText,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "⚠️ ReachInbox Hourly Rate Limit Alert",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Sender:*\n${senderName} (${senderEmail})` },
              { type: "mrkdwn", text: `*Configured Limit:*\n${configuredLimit} emails / hr` },
              { type: "mrkdwn", text: `*Hour Window:*\n${hourWindow}` },
              { type: "mrkdwn", text: `*Next Eligible Time:*\n${formattedNextTime}` },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Remaining emails are paused and safely rescheduled in BullMQ without loss.",
              },
            ],
          },
        ],
      });

      await prisma.rateLimitEvent.update({
        where: { id: event.id },
        data: { notificationState: "SENT" },
      });

      logger.info({ senderId, channel }, "Slack rate limit alert successfully posted");
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err, userId }, "Failed to send Slack alert");
      await prisma.rateLimitEvent.update({
        where: { id: event.id },
        data: { notificationState: "FAILED" },
      });
      return false;
    }
  }
}

export const slackService = new SlackService();
