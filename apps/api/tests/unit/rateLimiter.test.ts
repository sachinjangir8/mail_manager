import RedisMock from "ioredis-mock";
import { describe, expect, it } from "vitest";
import { DistributedRateLimiter } from "../../src/modules/rate-limits/rateLimiter";

describe("Distributed Rate Limiter Unit Tests", () => {
  const mockRedis: any = new RedisMock();
  const rateLimiter = new DistributedRateLimiter(mockRedis);

  it("calculates UTC hour window correctly", () => {
    const testDate = new Date("2026-10-24T14:25:30.123Z");
    const { hourWindow, secondsUntilNextWindow } = rateLimiter.getHourWindow(testDate);

    expect(hourWindow).toBe("2026-10-24T14:00:00.000Z");
    // From 14:25:30 to 15:00:00 is 34 minutes and 30 seconds = 2070 seconds
    expect(secondsUntilNextWindow).toBe(2070);
  });

  it("reserves inter-send delay spacing without overlaps", async () => {
    const senderId = "test_sender_delay_1";
    const minDelayMs = 2000;

    const slot1 = await rateLimiter.reserveSendSlot(senderId, minDelayMs);
    expect(slot1.waitMs).toBe(0); // first send can go immediately

    const slot2 = await rateLimiter.reserveSendSlot(senderId, minDelayMs);
    expect(slot2.scheduledSendTimeMs).toBeGreaterThanOrEqual(slot1.scheduledSendTimeMs + minDelayMs);
  });

  it("enforces hourly limit and calculates next eligible time", async () => {
    const senderId = "test_sender_limit_1";
    const limit = 3;

    // Call 1
    const res1 = await rateLimiter.checkAndReserveHourlyQuota(senderId, limit);
    expect(res1.allowed).toBe(true);

    // Call 2
    const res2 = await rateLimiter.checkAndReserveHourlyQuota(senderId, limit);
    expect(res2.allowed).toBe(true);

    // Call 3
    const res3 = await rateLimiter.checkAndReserveHourlyQuota(senderId, limit);
    expect(res3.allowed).toBe(true);

    // Call 4 (exceeds limit)
    const res4 = await rateLimiter.checkAndReserveHourlyQuota(senderId, limit);
    expect(res4.allowed).toBe(false);
    expect(res4.reason).toBe("SENDER_HOURLY_LIMIT_EXCEEDED");
    expect(res4.nextEligibleTime.getTime()).toBeGreaterThan(Date.now());
  });
});
