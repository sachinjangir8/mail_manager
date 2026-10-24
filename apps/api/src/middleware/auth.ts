import { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { decryptToken } from "../utils/crypto";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const SESSION_COOKIE_NAME = "reachinbox_session";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionToken = req.signedCookies?.[SESSION_COOKIE_NAME] || req.cookies?.[SESSION_COOKIE_NAME];

  if (!sessionToken) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
    return;
  }

  try {
    const userId = decryptToken(sessionToken);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      res.clearCookie(SESSION_COOKIE_NAME);
      res.status(401).json({
        success: false,
        error: "User session invalid or expired",
        code: "INVALID_SESSION",
      });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(401).json({
      success: false,
      error: "Invalid session token",
      code: "INVALID_SESSION",
    });
  }
}
