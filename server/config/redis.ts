import Redis from "ioredis";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL || "";

// If no REDIS_URL is configured, we operate in no-op mode — every call is a
// graceful no-op that falls through to the MySQL / in-memory fallback.
const isConfigured = Boolean(REDIS_URL);

class NoopRedis {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(_key: string): Promise<string | null> { return null; }
  async set(..._args: any[]): Promise<"OK"> { return "OK"; }
  async setex(_key: string, _ttl: number, _value: string): Promise<"OK"> { return "OK"; }
  async del(..._keys: string[]): Promise<number> { return 0; }
  async incr(_key: string): Promise<number> { return 0; }
  async pexpire(_key: string, _ms: number): Promise<number> { return 0; }
  async pttl(_key: string): Promise<number> { return 0; }
  async incrbyfloat(_key: string, _increment: number): Promise<string> { return "0"; }
  async ping(): Promise<string> { return "PONG"; }
  get status(): string { return "disabled"; }
}

let redisClient: Redis | NoopRedis;

if (isConfigured) {
  const client = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 5) return null; // Stop retrying after 5 failures — fall through to in-memory
      return Math.min(times * 200, 2000);
    },
  });

  client.on("connect", () => logger.info("Redis connected"));
  client.on("ready", () => logger.info("Redis ready"));
  client.on("error", (err) => logger.warn("Redis error (non-fatal)", { message: err.message }));
  client.on("close", () => logger.warn("Redis connection closed"));

  client.connect().catch((err) => logger.warn("Redis initial connect failed, falling back to in-memory", { message: err.message }));

  redisClient = client;
} else {
  logger.info("REDIS_URL not set — Redis disabled, using in-memory fallbacks");
  redisClient = new NoopRedis();
}

export const redis = redisClient as Redis;
export const redisEnabled = isConfigured;

/**
 * Safe Redis GET — returns null instead of throwing on connection errors.
 */
export const safeGet = async (key: string): Promise<string | null> => {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
};

/**
 * Safe Redis SETEX — silently swallows connection errors.
 */
export const safeSetex = async (key: string, ttlSeconds: number, value: string): Promise<void> => {
  try {
    await redis.setex(key, ttlSeconds, value);
  } catch {
    // Non-fatal
  }
};

/**
 * Safe Redis DEL — silently swallows connection errors.
 */
export const safeDel = async (...keys: string[]): Promise<void> => {
  try {
    if (keys.length) await redis.del(...keys);
  } catch {
    // Non-fatal
  }
};

/**
 * Safe Redis INCR + PEXPIRE — sliding window rate limit counter.
 * Returns { allowed, retryAfterMs } without ever throwing.
 */
export const consumeRedisRateBucket = async (
  key: string,
  limit: number,
  windowMs: number
): Promise<{ count: number; ttlMs: number; allowed: boolean; retryAfterMs: number } | null> => {
  try {
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      // First hit in this window — set the expiry
      await redis.pexpire(redisKey, windowMs);
    }
    const ttl = await redis.pttl(redisKey);
    const ttlMs = ttl > 0 ? ttl : windowMs;
    return { count, ttlMs, allowed: count <= limit, retryAfterMs: ttlMs };
  } catch {
    return null; // Signal to caller: fall back to in-memory
  }
};
