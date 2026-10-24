import Redis from "ioredis";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: "SENDER_HOURLY_LIMIT_EXCEEDED" | "GLOBAL_HOURLY_LIMIT_EXCEEDED" | "REDIS_UNAVAILABLE";
  currentCount: number;
  maxLimit: number;
  retryAfterMs: number;
  nextEligibleTime: Date;
  hourWindow: string;
}

export interface SendSlotReservation {
  scheduledSendTimeMs: number;
  waitMs: number;
}

// Lua script to atomically reserve next send timestamp with minimum delay spacing
// KEYS[1]: "delay:sender:" .. senderId
// ARGV[1]: nowMs
// ARGV[2]: minDelayMs
// ARGV[3]: keyTtlSeconds
const RESERVE_SLOT_LUA = `
local key = KEYS[1]
local nowMs = tonumber(ARGV[1])
local minDelayMs = tonumber(ARGV[2])
local ttlSec = tonumber(ARGV[3])

local lastScheduledMs = redis.call("GET", key)
local nextSlotMs = nowMs

if lastScheduledMs then
  lastScheduledMs = tonumber(lastScheduledMs)
  if lastScheduledMs + minDelayMs > nowMs then
    nextSlotMs = lastScheduledMs + minDelayMs
  end
end

redis.call("SET", key, nextSlotMs, "EX", ttlSec)
return nextSlotMs
`;

// Lua script to atomically check and increment hourly rate limits
// KEYS[1]: sender rate limit key
// KEYS[2]: global rate limit key
// ARGV[1]: maxSenderLimit
// ARGV[2]: maxGlobalLimit
// ARGV[3]: windowTtlSec
const CHECK_HOURLY_LIMIT_LUA = `
local senderKey = KEYS[1]
local globalKey = KEYS[2]
local maxSender = tonumber(ARGV[1])
local maxGlobal = tonumber(ARGV[2])
local ttlSec = tonumber(ARGV[3])

-- Check sender limit
local senderCount = tonumber(redis.call("GET", senderKey) or "0")
if senderCount >= maxSender then
  local senderTtl = redis.call("TTL", senderKey)
  if senderTtl < 0 then senderTtl = ttlSec end
  return { 0, senderCount, maxSender, senderTtl, "SENDER" }
end

-- Check global limit
local globalCount = tonumber(redis.call("GET", globalKey) or "0")
if globalCount >= maxGlobal then
  local globalTtl = redis.call("TTL", globalKey)
  if globalTtl < 0 then globalTtl = ttlSec end
  return { 0, globalCount, maxGlobal, globalTtl, "GLOBAL" }
end

-- Increment both atomically
local newSender = redis.call("INCR", senderKey)
if newSender == 1 then
  redis.call("EXPIRE", senderKey, ttlSec)
end

local newGlobal = redis.call("INCR", globalKey)
if newGlobal == 1 then
  redis.call("EXPIRE", globalKey, ttlSec)
end

local remTtl = redis.call("TTL", senderKey)
return { 1, newSender, maxSender, remTtl, "OK" }
`;

export class DistributedRateLimiter {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  /**
   * Generates the UTC hour window string e.g. "2026-10-24T14:00:00.000Z"
   */
  public getHourWindow(date: Date = new Date()): { hourWindow: string; secondsUntilNextWindow: number } {
    const d = new Date(date);
    d.setUTCMinutes(0, 0, 0);
    const hourWindow = d.toISOString();

    const nextHour = new Date(d);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    const secondsUntilNextWindow = Math.max(1, Math.ceil((nextHour.getTime() - date.getTime()) / 1000));

    return { hourWindow, secondsUntilNextWindow };
  }

  /**
   * Atomically reserves a send slot spaced by minDelayMs across all worker instances.
   */
  public async reserveSendSlot(senderId: string, minDelayMs: number): Promise<SendSlotReservation> {
    const nowMs = Date.now();
    const effectiveMinDelay = Math.max(env.MIN_SEND_DELAY_MS, minDelayMs);
    const ttlSec = Math.max(120, Math.ceil((effectiveMinDelay * 10) / 1000));

    try {
      const slotMsResult = await this.redis.eval(
        RESERVE_SLOT_LUA,
        1,
        `delay:sender:${senderId}`,
        nowMs.toString(),
        effectiveMinDelay.toString(),
        ttlSec.toString()
      );

      const scheduledSendTimeMs = Number(slotMsResult);
      const waitMs = Math.max(0, scheduledSendTimeMs - nowMs);

      return {
        scheduledSendTimeMs,
        waitMs,
      };
    } catch (err: unknown) {
      logger.warn({ err }, "Redis delay reservation unavailable; applying local fallback delay");
      return {
        scheduledSendTimeMs: nowMs,
        waitMs: effectiveMinDelay,
      };
    }
  }

  /**
   * Atomically checks and reserves hourly quota.
   */
  public async checkAndReserveHourlyQuota(
    senderId: string,
    customSenderLimit?: number
  ): Promise<RateLimitCheckResult> {
    const now = new Date();
    const { hourWindow, secondsUntilNextWindow } = this.getHourWindow(now);
    const senderLimit = customSenderLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const globalLimit = env.MAX_EMAILS_PER_HOUR_GLOBAL;
    const ttl = Math.max(secondsUntilNextWindow, 60);

    const senderKey = `rate:hourly:sender:${senderId}:${hourWindow}`;
    const globalKey = `rate:hourly:global:${hourWindow}`;

    try {
      const result = (await this.redis.eval(
        CHECK_HOURLY_LIMIT_LUA,
        2,
        senderKey,
        globalKey,
        senderLimit.toString(),
        globalLimit.toString(),
        ttl.toString()
      )) as [number, number, number, number, string];

      const [allowedNum, currentCount, maxLimit, remTtlSeconds, statusStr] = result;
      const allowed = allowedNum === 1;

      if (!allowed) {
        const retryAfterMs = Math.max(env.RATE_LIMIT_RETRY_SECONDS * 1000, remTtlSeconds * 1000);
        const nextEligibleTime = new Date(Date.now() + retryAfterMs);
        const reason =
          statusStr === "GLOBAL" ? "GLOBAL_HOURLY_LIMIT_EXCEEDED" : "SENDER_HOURLY_LIMIT_EXCEEDED";

        return {
          allowed: false,
          reason,
          currentCount,
          maxLimit,
          retryAfterMs,
          nextEligibleTime,
          hourWindow,
        };
      }

      return {
        allowed: true,
        currentCount,
        maxLimit,
        retryAfterMs: 0,
        nextEligibleTime: now,
        hourWindow,
      };
    } catch (err: unknown) {
      logger.error({ err }, "Redis rate limit check failed");
      // In case Redis is down, fail open or safely bounded with a backoff rather than infinite sends
      return {
        allowed: true, // Allow with logging if redis temporarily disconnected
        currentCount: 1,
        maxLimit: senderLimit,
        retryAfterMs: 0,
        nextEligibleTime: now,
        hourWindow,
      };
    }
  }
}
