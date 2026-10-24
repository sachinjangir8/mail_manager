import { Router } from "express";
import swaggerUi from "swagger-ui-express";

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "ReachInbox Full-Stack Email Scheduler API",
    version: "1.0.0",
    description:
      "Production-oriented Email Scheduler API featuring BullMQ delayed persistence, distributed rate limiting, Google OAuth 2.0, Slack Web API alerts, and Elasticsearch full-text search.",
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local development server",
    },
  ],
  paths: {
    "/api/health": {
      get: {
        summary: "Liveness health check",
        responses: {
          200: { description: "Service is live" },
        },
      },
    },
    "/api/ready": {
      get: {
        summary: "Readiness health check verifying DB, Redis, and Elasticsearch",
        responses: {
          200: { description: "Dependencies ready" },
          503: { description: "Degraded readiness" },
        },
      },
    },
    "/api/auth/google": {
      get: {
        summary: "Initiate Google OAuth 2.0 authorization code flow",
        responses: {
          302: { description: "Redirect to Google authorization endpoint" },
        },
      },
    },
    "/api/auth/google/callback": {
      get: {
        summary: "Google OAuth 2.0 callback handling code exchange and session establishment",
        responses: {
          302: { description: "Redirect to frontend dashboard" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        summary: "Retrieve authenticated user profile",
        responses: {
          200: { description: "User profile" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        summary: "Log out user and invalidate session cookie",
        responses: {
          200: { description: "Logged out successfully" },
        },
      },
    },
    "/api/senders": {
      get: {
        summary: "List email senders for authenticated user",
        responses: {
          200: { description: "List of senders" },
        },
      },
      post: {
        summary: "Create a new sender or auto-generate Ethereal account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  displayName: { type: "string" },
                  email: { type: "string", format: "email" },
                  autoGenerateEthereal: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Sender created" },
        },
      },
    },
    "/api/emails/schedule": {
      post: {
        summary: "Schedule a campaign with delayed BullMQ jobs and recipient parsing",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["senderId", "subject", "body", "recipients", "scheduledAt"],
                properties: {
                  senderId: { type: "string", format: "uuid" },
                  subject: { type: "string" },
                  body: { type: "string" },
                  recipients: {
                    type: "array",
                    items: { type: "string", format: "email" },
                  },
                  scheduledAt: { type: "string", format: "date-time" },
                  delayBetweenEmailsMs: { type: "integer", default: 5000 },
                  hourlyLimit: { type: "integer", default: 20 },
                  idempotencyKey: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Campaign scheduled successfully" },
        },
      },
    },
    "/api/emails/scheduled": {
      get: {
        summary: "List scheduled pending/queued emails",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: { description: "Paginated scheduled emails" },
        },
      },
    },
    "/api/emails/sent": {
      get: {
        summary: "List sent or failed emails",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: { description: "Paginated sent emails" },
        },
      },
    },
    "/api/emails/search": {
      get: {
        summary: "Search emails using Elasticsearch with Postgres fallback",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: { description: "Search results" },
        },
      },
    },
    "/api/integrations/slack/status": {
      get: {
        summary: "Check Slack integration status",
        responses: {
          200: { description: "Slack connection status" },
        },
      },
    },
    "/api/queue/summary": {
      get: {
        summary: "Get BullMQ queue metrics",
        responses: {
          200: { description: "Queue counts" },
        },
      },
    },
  },
};

export const docsRouter = Router();
docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(openApiSpec));
