import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load environment variables from repository root .env or apps/api/.env
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().default("postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  SESSION_SECRET: z.string().min(16).default("dev_session_secret_min_16_chars_long_1234"),
  TOKEN_ENCRYPTION_KEY: z.string().length(64).default("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),

  // Google OAuth (Optional in dev, required in production)
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_CALLBACK_URL: z.string().default("http://localhost:4000/api/auth/google/callback"),

  // Slack OAuth (Optional in dev)
  SLACK_CLIENT_ID: z.string().optional().default(""),
  SLACK_CLIENT_SECRET: z.string().optional().default(""),
  SLACK_CALLBACK_URL: z.string().default("http://localhost:4000/api/integrations/slack/callback"),
  SLACK_SCOPES: z.string().default("chat:write,chat:write.public,channels:read,groups:read"),
  SLACK_DEFAULT_CHANNEL_ID: z.string().optional().default(""),

  // Nodemailer / Ethereal SMTP
  ETHEREAL_SMTP_HOST: z.string().default("smtp.ethereal.email"),
  ETHEREAL_SMTP_PORT: z.coerce.number().int().default(587),
  ETHEREAL_SMTP_USER: z.string().optional().default(""),
  ETHEREAL_SMTP_PASS: z.string().optional().default(""),

  // BullMQ Worker Spacing & Concurrency
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  MIN_SEND_DELAY_MS: z.coerce.number().int().min(100).default(2000),
  DEFAULT_SEND_DELAY_MS: z.coerce.number().int().min(100).default(5000),
  MAX_SEND_DELAY_MS: z.coerce.number().int().default(60000),

  // Rate Limiting
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().min(1).default(20),
  MAX_EMAILS_PER_HOUR_GLOBAL: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(60).default(3600),
  RATE_LIMIT_RETRY_SECONDS: z.coerce.number().int().min(10).default(300),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().default("http://localhost:9200"),
  ELASTICSEARCH_INDEX: z.string().default("reachinbox_emails"),

  // Bull Board Admin Protection
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default("admin123"),
});

export const env = EnvSchema.parse(process.env);
