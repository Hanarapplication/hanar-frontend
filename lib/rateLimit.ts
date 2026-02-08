type RateState = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateState = new Map<string, RateState>();

export const getClientIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
};

export const isRateLimited = async (key: string) => {
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

const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX = 5;
const registerState = new Map<string, RateState>();

export const isRegistrationRateLimited = (key: string): boolean => {
  const now = Date.now();
  const entry = registerState.get(key);
  if (!entry || entry.resetAt <= now) {
    registerState.set(key, { count: 1, resetAt: now + REGISTER_WINDOW_MS });
    return false;
  }
  if (entry.count >= REGISTER_MAX) return true;
  entry.count += 1;
  return false;
};
