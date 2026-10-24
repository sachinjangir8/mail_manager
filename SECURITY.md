# Security Architecture & Policies

## 1. Overview
ReachInbox Email Scheduler is built with defense-in-depth principles:
- Strict multi-tenant isolation at the database layer (every user-facing entity is filtered by `userId`/`tenantId`).
- Secure session management via cryptographic HTTP-only, SameSite cookies.
- Real OAuth 2.0 PKCE / state-validated handshakes for Google and Slack.
- Persistent OAuth tokens encrypted at rest using AES-256-GCM.
- Distributed Redis rate limiting with atomic reservations to prevent race-condition exhaustion.
- Sanitized email payloads and safe HTML rendering on the frontend.

## 2. Secrets Management & OAuth Token Encryption
All external tokens (Google refresh tokens, Slack bot tokens) are never persisted in plaintext.
- **Algorithm**: `AES-256-GCM` with an authenticated 128-bit authentication tag and a unique initialization vector (`IV`) per record.
- **Key Requirement**: `TOKEN_ENCRYPTION_KEY` must be a high-entropy 256-bit (32 bytes) hex string (64 characters).
- **Key Rotation**:
  1. Set `TOKEN_ENCRYPTION_KEY_FALLBACK` or maintain versioned key IDs (`v1:iv:tag:ciphertext`).
  2. Run a migration script that reads with old keys and re-encrypts with the primary key.

## 3. Multi-Tenancy & Authorization Model
- Every repository function requires `userId` / `tenantId` parameter.
- Cross-tenant queries are structurally prevented.
- APIs verify ownership on all Senders, Campaigns, ScheduledEmails, and Integration tokens.
- Queue jobs carry authenticated `tenantId` and re-verify sender ownership before SMTP dispatch.

## 4. Rate Limiting & Protection
- Public authentication endpoints have IP/session-based rate limiters to prevent brute-force attacks.
- Outbound SMTP sending is governed by distributed Redis sliding windows and inter-send delays.
- Maximum payload sizes: 5MB for JSON payloads; 10MB for CSV recipient uploads.

## 5. Reporting Security Vulnerabilities
If you discover a security vulnerability, please report it via private channel to security@reachinbox.ai rather than filing public issues.
