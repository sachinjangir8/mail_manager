import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/authRoutes";
import { docsRouter } from "./modules/docs/swaggerDocs";
import { emailRouter } from "./modules/emails/emailRoutes";
import { healthRouter } from "./modules/health/healthRoutes";
import { setupQueueDashboard } from "./modules/queues/queueDashboard";
import { senderRouter } from "./modules/senders/senderRoutes";
import { slackRouter } from "./modules/slack/slackRoutes";

export function createApp(): Express {
  const app = express();

  // 1. Security Headers via Helmet (with CSP exceptions for Swagger and Bull Board)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. CORS configuration for frontend (supports any local dev port 5173, 5174, etc.)
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) return callback(null, true);
        if (
          requestOrigin === env.FRONTEND_URL ||
          /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin)
        ) {
          return callback(null, true);
        }
        return callback(new Error(`Not allowed by CORS: ${requestOrigin}`));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );

  // 3. Request parsing & Cookie parser
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser(env.SESSION_SECRET));

  // 4. Rate Limiting for Public Auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many authentication requests, please try again later" },
  });

  // 5. Route Mounting
  app.use("/api", healthRouter);
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/senders", senderRouter);
  app.use("/api/emails", emailRouter);
  app.use("/api/integrations/slack", slackRouter);

  // 6. BullMQ Bull Board Dashboard
  app.use("/api/admin/queues", setupQueueDashboard());

  // 7. Swagger Documentation UI
  app.use("/api/docs", docsRouter);

  // 8. Central Error Handler
  app.use(errorHandler);

  return app;
}
