import { z } from "zod";

/**
 * Strict RFC 5322 compatible email validation regex
 */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const normalized = normalizeEmail(email);
  if (normalized.length > 254) return false;
  return EMAIL_REGEX.test(normalized);
}

export interface RecipientParseResult {
  valid: string[];
  duplicates: string[];
  invalid: string[];
  totalRaw: number;
}

/**
 * Robust CSV and Plain Text Recipient Parser
 * - Handles header rows (e.g. "email", "recipient_email", "Email Address")
 * - Handles quoted fields ("john@example.com")
 * - Handles commas, semicolons, tabs, and newlines
 * - Deduplicates while preserving first occurrence
 * - Categorizes valid, duplicate, and invalid entries
 */
export function parseRecipientsContent(content: string): RecipientParseResult {
  if (!content || typeof content !== "string") {
    return { valid: [], duplicates: [], invalid: [], totalRaw: 0 };
  }

  // Remove UTF-8 BOM if present
  const cleanContent = content.replace(/^\uFEFF/, "");
  const lines = cleanContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const rawEntries: string[] = [];

  // Check if first line contains a header like "email"
  let startIndex = 0;
  if (lines.length > 0) {
    const firstLineLower = lines[0].toLowerCase();
    const tokens = firstLineLower.split(/[,;\t]/).map((t) => t.trim().replace(/^["']|["']$/g, ""));
    const emailHeaderIndex = tokens.findIndex((t) => t === "email" || t === "recipient" || t === "email address" || t === "mail");
    
    if (emailHeaderIndex !== -1) {
      startIndex = 1; // skip header line
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        // Split with care for quoted CSV fields
        const cols = row.split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ""));
        if (cols[emailHeaderIndex]) {
          rawEntries.push(cols[emailHeaderIndex]);
        }
      }
    }
  }

  // If no header detected or empty from header, check if data has tabular non-email columns
  if (rawEntries.length === 0 && lines.length > 0) {
    // Check if rows have multiple delimited columns
    const sampleRows = lines.slice(0, Math.min(lines.length, 10)).map((l) =>
      l.split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ""))
    );

    // Only treat as multi-column table if:
    // 1) There are multiple lines
    // 2) The number of columns is > 1
    // 3) Exactly one column has emails while other columns are NOT emails (e.g. names, IDs)
    let detectedColIndex = -1;
    if (lines.length > 1 && sampleRows[0].length > 1) {
      const numCols = sampleRows[0].length;
      const colEmailCounts = new Array(numCols).fill(0);
      for (const row of sampleRows) {
        row.forEach((cell, idx) => {
          if (idx < numCols && cell && isValidEmail(cell)) {
            colEmailCounts[idx]++;
          }
        });
      }

      // If one column has all emails and other columns have none or few
      const colsWithEmails = colEmailCounts.filter((cnt) => cnt > 0).length;
      if (colsWithEmails === 1) {
        detectedColIndex = colEmailCounts.findIndex((cnt) => cnt > 0);
      }
    }

    if (detectedColIndex !== -1) {
      // Tabular multi-column CSV without header: pick detected email column
      for (const line of lines) {
        const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ""));
        if (cols[detectedColIndex]) {
          rawEntries.push(cols[detectedColIndex]);
        }
      }
    } else {
      // Freeform comma-separated, semicolon-separated, tab, or newline list of emails
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(/[,;\t\s]+/).map((p) => p.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        for (const part of parts) {
          rawEntries.push(part);
        }
      }
    }
  }

  const seen = new Set<string>();
  const valid: string[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];

  for (const raw of rawEntries) {
    const normalized = normalizeEmail(raw);
    if (!isValidEmail(normalized)) {
      invalid.push(raw);
    } else if (seen.has(normalized)) {
      duplicates.push(normalized);
    } else {
      seen.add(normalized);
      valid.push(normalized);
    }
  }

  return {
    valid,
    duplicates,
    invalid,
    totalRaw: rawEntries.length,
  };
}

export const ScheduleEmailsSchema = z.object({
  senderId: z.string().uuid("Invalid sender ID"),
  subject: z.string().min(1, "Subject is required").max(255, "Subject cannot exceed 255 characters"),
  body: z.string().min(1, "Email body is required"),
  recipients: z
    .array(z.string().refine(isValidEmail, { message: "Invalid email address" }))
    .min(1, "At least one recipient is required"),
  scheduledAt: z
    .string()
    .datetime({ message: "scheduledAt must be an ISO 8601 UTC date string" })
    .refine((val) => new Date(val).getTime() >= Date.now() - 60000, {
      message: "Scheduled time cannot be significantly in the past",
    }),
  delayBetweenEmailsMs: z.coerce.number().int().min(1000, "Minimum delay between sends is 1,000ms").default(5000),
  hourlyLimit: z.coerce.number().int().min(1, "Hourly limit must be at least 1").max(1000, "Hourly limit cannot exceed 1000").default(20),
  idempotencyKey: z.string().max(128).optional(),
});

export type ScheduleEmailsInput = z.infer<typeof ScheduleEmailsSchema>;

export const EmailStatusEnum = z.enum(["scheduled", "queued", "processing", "sent", "failed", "rate_limited", "cancelled"]);
export type EmailStatus = z.infer<typeof EmailStatusEnum>;
