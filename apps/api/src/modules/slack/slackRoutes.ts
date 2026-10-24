import crypto from "crypto";
import { Request, Response, Router } from "express";
import { env } from "../../config/env";
import { slackService } from "../../integrations/slack/slackService";
import { requireAuth } from "../../middleware/auth";
import { logger } from "../../utils/logger";

export const slackRouter = Router();

const SLACK_STATE_COOKIE = "slack_oauth_state";

/**
 * Returns current Slack integration status for authenticated user
 */
slackRouter.get("/status", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const status = await slackService.getStatus(userId);
  res.status(200).json({ success: true, ...status });
});

/**
 * Initiates Slack OAuth flow
 */
slackRouter.get("/connect", requireAuth, (req: Request, res: Response) => {
  const state = crypto.randomBytes(24).toString("hex");

  res.cookie(SLACK_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  if (!env.SLACK_CLIENT_ID || env.SLACK_CLIENT_ID === "your_slack_client_id") {
    logger.warn("SLACK_CLIENT_ID not configured; redirecting to frontend with setup notice");
    res.redirect(`${env.FRONTEND_URL}/settings?warning=slack_credentials_missing`);
    return;
  }

  const authUrl = slackService.getAuthorizationUrl(state);
  res.redirect(authUrl);
});

/**
 * Slack OAuth callback
 */
slackRouter.get("/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const storedState = req.cookies?.[SLACK_STATE_COOKIE];

  res.clearCookie(SLACK_STATE_COOKIE);

  if (error) {
    logger.error({ error }, "Slack OAuth rejected");
    res.redirect(`${env.FRONTEND_URL}/settings?error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!state || !storedState || state !== storedState) {
    logger.warn({ state, storedState }, "Slack OAuth state mismatch (possible CSRF)");
    res.redirect(`${env.FRONTEND_URL}/settings?error=csrf_state_mismatch`);
    return;
  }

  if (!code || typeof code !== "string") {
    res.redirect(`${env.FRONTEND_URL}/settings?error=missing_code`);
    return;
  }

  try {
    // Determine userId from session
    const sessionToken = req.signedCookies?.["reachinbox_session"] || req.cookies?.["reachinbox_session"];
    if (!sessionToken) {
      res.redirect(`${env.FRONTEND_URL}/login?error=session_expired`);
      return;
    }

    const { decryptToken } = await import("../../utils/crypto");
    const userId = decryptToken(sessionToken);

    await slackService.exchangeCode(code, userId);

    logger.info({ userId }, "Slack workspace connected via OAuth");
    res.redirect(`${env.FRONTEND_URL}/settings?slack=connected`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "Slack OAuth token exchange failed");
    res.redirect(`${env.FRONTEND_URL}/settings?error=${encodeURIComponent(msg)}`);
  }
});

/**
 * Disconnects Slack
 */
slackRouter.post("/disconnect", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  await slackService.disconnect(userId);
  res.status(200).json({ success: true, message: "Slack disconnected successfully" });
});
