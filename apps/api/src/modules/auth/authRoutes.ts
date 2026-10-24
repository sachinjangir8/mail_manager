import crypto from "crypto";
import { Request, Response, Router } from "express";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { SESSION_COOKIE_NAME, requireAuth } from "../../middleware/auth";
import { encryptToken } from "../../utils/crypto";
import { logger } from "../../utils/logger";

export const authRouter = Router();

const OAUTH_STATE_COOKIE = "google_oauth_state";

/**
 * Initiates real Google OAuth 2.0 flow
 */
authRouter.get("/google", (req: Request, res: Response) => {
  const state = crypto.randomBytes(24).toString("hex");

  // Securely store state in HTTP-only cookie for CSRF verification
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  // If Google Client ID is configured, redirect to Google
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID !== "your_google_client_id.apps.googleusercontent.com") {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      response_type: "code",
      scope: "openid profile email",
      access_type: "offline",
      prompt: "consent",
      state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    return;
  }

  // If Google credentials are not yet configured in local environment,
  // guide the user or allow developer test login
  logger.warn("GOOGLE_CLIENT_ID not configured; redirecting to developer setup guidance");
  res.redirect(`${env.FRONTEND_URL}/login?warning=google_credentials_missing`);
});

/**
 * Google OAuth 2.0 Callback
 */
authRouter.get("/google/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const storedState = req.cookies?.[OAUTH_STATE_COOKIE];

  res.clearCookie(OAUTH_STATE_COOKIE);

  if (error) {
    logger.error({ error }, "Google OAuth denied by user or server");
    res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!state || !storedState || state !== storedState) {
    logger.warn({ state, storedState }, "Google OAuth state mismatch (possible CSRF attack)");
    res.redirect(`${env.FRONTEND_URL}/login?error=csrf_state_mismatch`);
    return;
  }

  if (!code || typeof code !== "string") {
    res.redirect(`${env.FRONTEND_URL}/login?error=missing_auth_code`);
    return;
  }

  try {
    // 1. Exchange authorization code with Google token endpoint
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(`Google token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }

    // 2. Fetch authenticated user profile from Google UserInfo endpoint
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfo || !userInfo.sub || !userInfo.email) {
      throw new Error("Invalid user profile received from Google");
    }

    // 3. Upsert user in database
    const user = await prisma.user.upsert({
      where: { googleId: userInfo.sub },
      create: {
        googleId: userInfo.sub,
        email: userInfo.email.toLowerCase(),
        name: userInfo.name || userInfo.email.split("@")[0],
        avatarUrl: userInfo.picture || null,
      },
      update: {
        email: userInfo.email.toLowerCase(),
        name: userInfo.name || userInfo.email.split("@")[0],
        avatarUrl: userInfo.picture || null,
      },
    });

    // 4. Create encrypted application session cookie
    const sessionToken = encryptToken(user.id);

    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600 * 1000, // 7 days
    });

    logger.info({ userId: user.id, email: user.email }, "User authenticated via Google OAuth successfully");
    res.redirect(`${env.FRONTEND_URL}/`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "Failed to complete Google OAuth exchange");
    res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(msg)}`);
  }
});

/**
 * Local Development Test Login:
 * Allows full local dashboard exploration when Google Cloud Client ID is not configured in local environment.
 * Labeled explicitly as a local-development fallback.
 */
authRouter.post("/dev-login", async (req: Request, res: Response) => {
  if (env.NODE_ENV === "production") {
    res.status(403).json({ error: "Dev login is disabled in production" });
    return;
  }

  const { email = "oliver.brown@domain.io", name = "Oliver Brown" } = req.body;

  try {
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      create: {
        googleId: `dev_${Date.now()}`,
        email: email.toLowerCase(),
        name,
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
      },
      update: {
        name,
      },
    });

    // Ensure default demo sender exists for Oliver Brown
    const existingSender = await prisma.emailSender.findFirst({
      where: { userId: user.id },
    });

    if (!existingSender) {
      await prisma.emailSender.create({
        data: {
          userId: user.id,
          displayName: user.name,
          email: user.email,
          smtpHost: "smtp.ethereal.email",
          smtpPort: 587,
          encryptedSmtpUser: encryptToken("ethereal_dev_user"),
          encryptedSmtpPass: encryptToken("ethereal_dev_pass"),
          isEthereal: true,
          enabled: true,
        },
      });
    }

    const sessionToken = encryptToken(user.id);

    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 3600 * 1000,
    });

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * Returns current authenticated user
 */
authRouter.get("/me", requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

/**
 * Logs out and clears session cookie
 */
authRouter.post("/logout", (req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});
