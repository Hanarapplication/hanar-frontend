import crypto from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';

const TWO_FA_COOKIE = 'admin_2fa_verified';
const PIN_COOKIE = 'admin_pin_verified';
const TWO_FA_TTL_SECONDS = 8 * 60 * 60;

function get2faSecret(): string {
  const secret = process.env.ADMIN_2FA_SECRET || '';
  if (!secret) {
    throw new Error('Missing ADMIN_2FA_SECRET');
  }
  return secret;
}

export function getTwoFactorCookieName(): string {
  return TWO_FA_COOKIE;
}

export function getPinCookieName(): string {
  return PIN_COOKIE;
}

export function normalizeTotpCode(raw: unknown): string {
  return String(raw ?? '').replace(/\s+/g, '').trim();
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const normalized = normalizeTotpCode(code);
  if (!/^\d{6}$/.test(normalized)) return false;
  const result = verifySync({
    strategy: 'totp',
    secret,
    token: normalized,
    epochTolerance: 1,
  });
  return Boolean(result?.valid);
}

export function generateTotpSecret(email: string): { secret: string; otpauth: string } {
  const secret = generateSecret();
  const otpauth = generateURI({
    strategy: 'totp',
    issuer: 'Hanar Admin',
    label: email,
    secret,
  });
  return { secret, otpauth };
}

export function createTwoFactorCookieValue(userId: string, email: string): string {
  const payload = `${userId}:${email.toLowerCase()}:${Math.floor(Date.now() / 1000)}`;
  const sig = crypto
    .createHmac('sha256', get2faSecret())
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${sig}`, 'utf8').toString('base64url');
}

export function validateTwoFactorCookie(value: string | undefined, userId: string, email: string): boolean {
  if (!value) return false;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const [cookieUserId, cookieEmail, tsRaw, sig] = decoded.split(':');
    if (!cookieUserId || !cookieEmail || !tsRaw || !sig) return false;
    if (cookieUserId !== userId) return false;
    if (cookieEmail !== email.toLowerCase()) return false;
    const ts = Number(tsRaw);
    if (!Number.isFinite(ts)) return false;
    if (Math.floor(Date.now() / 1000) - ts > TWO_FA_TTL_SECONDS) return false;

    const payload = `${cookieUserId}:${cookieEmail}:${tsRaw}`;
    const expected = crypto
      .createHmac('sha256', get2faSecret())
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function getTwoFactorCookieMaxAge(): number {
  return TWO_FA_TTL_SECONDS;
}

export function createPinCookieValue(userId: string, email: string): string {
  const payload = `pin:${userId}:${email.toLowerCase()}:${Math.floor(Date.now() / 1000)}`;
  const sig = crypto
    .createHmac('sha256', get2faSecret())
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${sig}`, 'utf8').toString('base64url');
}

export function validatePinCookie(value: string | undefined, userId: string, email: string): boolean {
  if (!value) return false;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const [kind, cookieUserId, cookieEmail, tsRaw, sig] = decoded.split(':');
    if (kind !== 'pin' || !cookieUserId || !cookieEmail || !tsRaw || !sig) return false;
    if (cookieUserId !== userId) return false;
    if (cookieEmail !== email.toLowerCase()) return false;
    const ts = Number(tsRaw);
    if (!Number.isFinite(ts)) return false;
    if (Math.floor(Date.now() / 1000) - ts > TWO_FA_TTL_SECONDS) return false;

    const payload = `${kind}:${cookieUserId}:${cookieEmail}:${tsRaw}`;
    const expected = crypto
      .createHmac('sha256', get2faSecret())
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
