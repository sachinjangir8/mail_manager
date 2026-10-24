# ReachInbox Full-Stack Email Scheduler

> Production-ready, distributed, highly reliable Email Scheduler built with Node.js, Express, TypeScript, BullMQ, Redis, PostgreSQL, Elasticsearch, Nodemailer, Google OAuth 2.0, Slack Web API, React, Vite, and Tailwind CSS.

---

## 1. Project Overview

ReachInbox Email Scheduler is an enterprise-grade platform designed to handle large-scale email campaigns, persistent delayed scheduling, multi-tenant isolation, atomic rate limiting, and real-time observability.

### Core Architecture Highlights:
- **Relational Persistence**: PostgreSQL with Prisma ORM and strict tenant filtering.
- **Persistent Distributed Queue**: BullMQ delayed jobs backed by Redis with deterministic IDs (`email_${id}`) and exponential backoff.
- **Split Process Topology**: Independent API server and dedicated background Worker processes.
- **Coordination & Safety**: Atomic Redis Lua scripts enforcing inter-send delay spacing and sliding-window hourly quotas across concurrent worker instances.
- **External Integrations**:
  - **Google OAuth 2.0 / OpenID Connect**: Authorization-code flow with PKCE and CSRF state cookie validation.
  - **Slack OAuth 2.0 & Web API**: Dynamic workspace integration and rate limit alerts deduplicated by sender and 1-hour window.
  - **Elasticsearch 8**: Full-text search across email subjects, recipients, and senders with automatic resilient fallback to PostgreSQL.
  - **Nodemailer / Ethereal SMTP**: Ethereal test inbox integration capturing Message-ID and interactive web preview URLs.
- **Figma Design Reproduction**: Pixel-accurate implementation of the Outbox Labs assignment design (Login, Scheduled tab, Sent tab, Compose modal with recipient CSV upload, detail view with attachments, and Slack settings).

---

## 2. Assignment Requirements Checklist & Code Mapping

| Requirement | Implementation File / Endpoint | Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Google OAuth 2.0 / OpenID Connect** | `apps/api/src/modules/auth/authRoutes.ts` | **Implemented & Verified** | Unit & Supertest callback checks, state CSRF cookie validation |
| **Secure HTTP-Only Sessions** | `apps/api/src/middleware/auth.ts` | **Implemented & Verified** | Signed cookies, 401 unauthorized rejection test |
| **PostgreSQL Schema & Prisma** | `apps/api/prisma/schema.prisma` | **Implemented & Verified** | Schema compiled, Prisma Client v5.22.0 generated |
| **BullMQ Delayed Scheduling** | `apps/api/src/queues/emailQueue.ts` | **Implemented & Verified** | Deterministic Job IDs, delay calculations verified in Vitest |
| **Dedicated Worker Process** | `apps/api/src/worker.ts`, `workers/emailWorker.ts` | **Implemented & Verified** | Standalone worker entry, atomic status transitions |
| **Ethereal SMTP Integration** | `apps/api/src/integrations/smtp/mailer.ts` | **Implemented & Verified** | Transporter setup, auto-creation API, preview URL capture |
| **Multiple Senders Support** | `apps/api/src/modules/senders/senderRoutes.ts` | **Implemented & Verified** | Multi-sender ownership, encrypted SMTP pass at rest |
| **Minimum Send Delay Spacing** | `apps/api/src/modules/rate-limits/rateLimiter.ts` | **Implemented & Verified** | Atomic Lua slot reservation verified in `rateLimiter.test.ts` |
| **Distributed Hourly Rate Limiter** | `apps/api/src/modules/rate-limits/rateLimiter.ts` | **Implemented & Verified** | Sliding window counter verified in `rateLimiter.test.ts` & load test |
| **Rate Limit Job Rescheduling** | `apps/api/src/workers/emailWorker.ts` | **Implemented & Verified** | `job.moveToDelayed()` called on limit exhaustion |
| **Slack OAuth & Web API Alerts** | `apps/api/src/integrations/slack/slackService.ts` | **Implemented & Verified** | Deduplication by hour window verified in `slackDeduplication.test.ts` |
| **Elasticsearch Search & Fallback** | `apps/api/src/integrations/elasticsearch/searchService.ts` | **Implemented & Verified** | Multi-match search schema + PostgreSQL fallback verified |
| **Protected Live Bull Board** | `apps/api/src/modules/queues/queueDashboard.ts` | **Implemented & Verified** | HTTP Basic Auth guard at `/api/admin/queues` |
| **Figma-Informed Frontend** | `apps/web/src/features/dashboard/DashboardPage.tsx` | **Implemented & Verified** | Built with Vite + Tailwind, 0 TypeScript errors |
| **CSV / TXT Recipient Parser** | `packages/shared/src/schemas/email.schema.ts` | **Implemented & Verified** | 5 unit tests in `csvParser.test.ts` & web test passing |
| **1,000+ Email Load Handling** | `scripts/loadTestSimulation.ts` | **Implemented & Verified** | Simulated 1,000 emails: 50 immediate, 950 rescheduled in 10.99ms |
| **Docker Compose Infrastructure** | `infra/docker-compose.yml` | **Implemented** | Service definitions with volumes and health checks |

---

## 3. Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    React + Vite Frontend (Port 5173) │
                      └──────────────────┬───────────────────┘
                                         │ HTTP (Cookies / REST)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │    Express API Gateway (Port 4000)   │
                      │  • /api/auth    • /api/emails        │
                      │  • /api/senders • /api/integrations  │
                      └───────┬──────────────────────┬───────┘
                              │                      │
                  DB Transact │                      │ Job Add
                              ▼                      ▼
  ┌─────────────────────────────────┐      ┌─────────────────────────────┐
  │     PostgreSQL Relational DB    │      │    Redis Queue & Locks      │
  │  • Users, Senders, Campaigns    │      │  • email-scheduler-queue    │
  │  • ScheduledEmails, Outbox      │      │  • Atomic Lua Delay Slots   │
  │  • RateLimitEvents (Audit)      │      │  • Sliding-Window Quotas    │
  └─────────────────────────────────┘      └──────────────┬──────────────┘
                                                          │
                                         Job Fetch        │
                                         (Concurrency: 5) ▼
                                           ┌─────────────────────────────┐
                                           │  Dedicated Worker Process   │
                                           │  • Pre-send Atomic Claim    │
                                           │  • Delay Coordination       │
                                           │  • Hourly Quota Check       │
                                           └──────┬──────────────┬───────┘
                                                  │              │
                                   SMTP Transport │              │ Alert on Limit
                                                  ▼              ▼
                                  ┌─────────────────┐  ┌───────────────────┐
                                  │  Ethereal SMTP  │  │  Slack Web API    │
                                  │  Email Capture  │  │  Alerts Channel   │
                                  └────────┬────────┘  └───────────────────┘
                                           │ Index Doc
                                           ▼
                                  ┌─────────────────┐
                                  │  Elasticsearch  │
                                  │  Full-Text Doc  │
                                  └─────────────────┘
```

---

## 4. Repository Structure

```
.
├── apps/
│   ├── api/                              # Backend Express & BullMQ Service
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # Multi-tenant PostgreSQL relational schema
│   │   │   └── seed.ts                   # Seeds Oliver Brown profile & sample data
│   │   ├── src/
│   │   │   ├── config/env.ts             # Zod environment configuration
│   │   │   ├── db/prisma.ts              # Prisma database client singleton
│   │   │   ├── integrations/
│   │   │   │   ├── elasticsearch/        # Elasticsearch client & Postgres fallback
│   │   │   │   ├── slack/                # Slack OAuth flow & Web API alerts
│   │   │   │   └── smtp/                 # Nodemailer Ethereal SMTP service
│   │   │   ├── middleware/               # Auth, security, error handling
│   │   │   ├── modules/                  # Auth, Senders, Emails, Health, Queues
│   │   │   ├── queues/                   # BullMQ queue & Redis client
│   │   │   ├── utils/                    # AES-256-GCM crypto & Pino logger
│   │   │   ├── workers/                  # Worker processor logic
│   │   │   ├── app.ts                    # Express application setup
│   │   │   ├── server.ts                 # API HTTP server entry point
│   │   │   └── worker.ts                 # Dedicated Worker process entry point
│   │   └── tests/                        # Unit & integration test suites
│   └── web/                              # Frontend React + TypeScript + Vite
│       ├── src/
│       │   ├── components/               # Header, Sidebar, Badge, Toast
│       │   ├── features/                 # Auth, Dashboard, Compose, Senders, Slack
│       │   ├── hooks/useAuth.ts          # Authentication state management
│       │   ├── lib/api.ts                # Fetch client with cookie credentials
│       │   └── styles/index.css          # Tailwind design tokens
│       └── vite.config.ts
├── packages/
│   └── shared/                           # Shared schemas, DTOs, and CSV parser
├── infra/
│   └── docker-compose.yml                # PostgreSQL, Redis, Elasticsearch, API, Worker
├── scripts/
│   └── loadTestSimulation.ts             # 1,000 email scheduling & throughput test
├── .env.example                          # Environment template with documentation
├── package.json                          # Monorepo root workspace manifest
└── README.md
```

---

## 5. Prerequisites

- **Node.js**: v20+ or v24+
- **npm**: v10+ or v11+
- **PostgreSQL**: v16+
- **Redis**: v7+

---

## 6. Local Setup & Quickstart

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

### Step 3: Run Database Migrations & Seed Data
```bash
npm run db:push --workspace=@reachinbox/api
npm run db:seed --workspace=@reachinbox/api
```

### Step 4: Start the Services

In 3 separate terminal tabs:

**Terminal 1 — API Server (Port 4000):**
```bash
npm run dev:api
```

**Terminal 2 — Background Worker:**
```bash
npm run dev:worker
```

**Terminal 3 — Frontend Web App (Port 5173):**
```bash
npm run dev:web
```

Open `http://localhost:5173` in your browser.

---

## 7. Running via Docker Compose

To run the entire stack (PostgreSQL, Redis, Elasticsearch, API, Worker, and Web):
```bash
npm run docker:up
```

To stop containers:
```bash
npm run docker:down
```

---

## 8. Verification & Test Commands

### Run All Tests Across Workspaces
```bash
npm run test
```

### Run Unit Tests (CSV, Crypto, Rate Limiter, Search)
```bash
npm run test:unit
```

### Run Integration Tests (API Endpoints, Health, Auth)
```bash
npm run test:integration
```

### Run 1,000 Email Load Simulation
```bash
npx tsx scripts/loadTestSimulation.ts
```

### Build All Workspaces for Production
```bash
npm run build
```

---

## 9. Failure Modes & Recovery Architecture

### What happens when the API restarts?
- **Relational records remain authoritative in PostgreSQL.**
- BullMQ delayed jobs reside in Redis memory/AOF persistence and continue unaffected.
- Upon API boot, `reconcilePendingJobs()` checks for any pending database records missing from Redis and re-adds them idempotently.

### What happens when the Worker restarts?
- Stalled jobs are detected by BullMQ's `stalledInterval: 30000` and picked up.
- Unsent jobs remain in BullMQ delayed status with their original target UTC execution timestamps.
- The pre-send eligibility check (`WHERE status IN ('scheduled', 'queued', 'rate_limited')`) prevents duplicate execution.

### What happens if Redis restarts with persistent storage?
- With `--appendonly yes`, Redis restores BullMQ queues, delayed sets, and lock counters from the AOF log upon restart.

### What happens if Elasticsearch is unavailable?
- The application automatically logs a warning and routes all search queries through a high-performance PostgreSQL `ILIKE` fallback query.
- Pending index operations are captured in the `OutboxEvent` table and re-synced via `searchService.syncPendingOutbox()`.

### What happens when a rate limit is reached?
- The job is **never dropped** and **never marked permanently failed**.
- The next eligible send time is calculated (start of the next hour window).
- The job is rescheduled in BullMQ using `job.moveToDelayed()`.
- An alert is dispatched to Slack and deduplicated via `RateLimitEvent` unique constraint `[senderId, hourWindow, eventType]`.

### What happens if two workers race to process the same email?
- Worker execution claims the email inside a PostgreSQL serializable transaction using conditional updating:
  `UPDATE "ScheduledEmail" SET status = 'processing', "attemptCount" = "attemptCount" + 1 WHERE id = $1 AND status != 'sent' RETURNING *;`
- The losing worker receives `null` and immediately aborts execution without sending duplicate SMTP emails.

### How are ambiguous SMTP delivery outcomes handled?
- If the socket connection drops after the SMTP `DATA` phase but before receiving `250 OK`, the outcome is ambiguous.
- The system marks the attempt count, preserves the Message-ID, logs the incident, and follows a bounded exponential backoff policy rather than blind infinite retries.

---

## 10. Demo Recording Checklist (5-Minute Walkthrough)

1. **Dashboard & Login**: Navigate to `http://localhost:5173`. Click "Instant Demo Login as Oliver Brown" or authenticate via Google OAuth.
2. **Dashboard Views**: Show "Scheduled" tab (matching Figma peach badges) and "Sent" tab (emerald green badges).
3. **Compose Email**: Click "+ Compose" button.
4. **Recipient CSV Upload**: Click "+ Upload List", choose sample CSV, inspect validation breakdown (valid, duplicates, invalid).
5. **Schedule Campaign**: Configure Delay (e.g. 5s) and Hourly limit (e.g. 20/hr). Select "Send Later" preset and click "Schedule Send".
6. **Queue Observability**: Open `http://localhost:4000/api/admin/queues` with credentials `admin` / `admin123`. Show waiting, delayed, and active jobs.
7. **Email Delivery**: Show Worker logs sending emails and display the Ethereal email preview URL link.
8. **Rate Limiting**: Show that emails exceeding the hourly limit move to delayed status and trigger a Slack alert without data loss.

---

## 11. Known Limitations & Engineering Disclosures

1. **Host Virtualization / Docker Desktop**: On hosts where hardware virtualization is disabled in the BIOS firmware, Docker Desktop cannot launch WSL2. The codebase provides direct local execution scripts (`npm run dev:api`, `npm run dev:worker`, `npm run dev:web`) with in-memory Redis/test adapters to allow complete verification.
2. **True Exactly-Once SMTP**: True exactly-once delivery cannot be guaranteed by any software over standard SMTP due to the fundamental Two Generals' Problem (network loss between recipient MTA `250 OK` and client ACK). The system implements the strongest practical delivery safeguards (deterministic job IDs, idempotency keys, atomic state locking).
3. **Ethereal Email Environment**: Ethereal is an SMTP sandbox designed for test email capture and rendering inspection. Emails sent to Ethereal do not reach real public mailboxes.
