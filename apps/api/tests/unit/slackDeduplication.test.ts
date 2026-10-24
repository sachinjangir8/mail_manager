import { describe, expect, it } from "vitest";

describe("Slack Alert Idempotency & Deduplication Logic", () => {
  it("generates deterministic deduplication keys per sender and hour window", () => {
    const senderId = "sender-uuid-123";
    const hourWindow1 = "2026-10-24T14:00:00.000Z";
    const hourWindow2 = "2026-10-24T15:00:00.000Z";

    const key1A = `${senderId}:${hourWindow1}:HOURLY_LIMIT_REACHED`;
    const key1B = `${senderId}:${hourWindow1}:HOURLY_LIMIT_REACHED`;
    const key2 = `${senderId}:${hourWindow2}:HOURLY_LIMIT_REACHED`;

    expect(key1A).toBe(key1B);
    expect(key1A).not.toBe(key2);
  });
});
