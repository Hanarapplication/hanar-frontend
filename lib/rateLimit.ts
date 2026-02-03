import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type RateState = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateState = new Map<string, RateState>();

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashLimiter = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, '1 m'),
      analytics: true,
    })
  : null;

export const getClientIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
};

export const isRateLimited = async (key: string) => {
  if (upstashLimiter) {
    const result = await upstashLimiter.limit(key);
    return !result.success;
  }

  const now = Date.now();
  const entry = rateState.get(key);
  if (!entry || entry.resetAt <= now) {
    rateState.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
};
