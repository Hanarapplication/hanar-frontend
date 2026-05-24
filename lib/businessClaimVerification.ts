import crypto from 'crypto';

const COOKIE_PREFIX = 'hanar_claim_email_';
const TTL_SECONDS = 15 * 60;

function getSecret(): string {
  const secret =
    process.env.ADMIN_2FA_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  if (!secret) throw new Error('Missing signing secret for claim verification');
  return secret;
}

export function getClaimEmailCookieName(businessId: string): string {
  return `${COOKIE_PREFIX}${businessId}`;
}

export function createClaimEmailCookieValue(
  businessId: string,
  userId: string,
  listingEmail: string
): string {
  const normalizedEmail = listingEmail.trim().toLowerCase();
  const payload = `${businessId}:${userId}:${normalizedEmail}:${Math.floor(Date.now() / 1000)}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`, 'utf8').toString('base64url');
}

export function validateClaimEmailCookie(
  value: string | undefined,
  businessId: string,
  userId: string,
  listingEmail: string
): boolean {
  if (!value) return false;
  const normalizedEmail = listingEmail.trim().toLowerCase();
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 5) return false;
    const [cookieBusinessId, cookieUserId, cookieEmail, tsRaw, sig] = parts;
    if (cookieBusinessId !== businessId || cookieUserId !== userId) return false;
    if (cookieEmail !== normalizedEmail) return false;
    const ts = Number(tsRaw);
    if (!Number.isFinite(ts) || Math.floor(Date.now() / 1000) - ts > TTL_SECONDS) return false;
    const payload = `${cookieBusinessId}:${cookieUserId}:${cookieEmail}:${tsRaw}`;
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function hashClaimCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function getClaimEmailCookieMaxAge(): number {
  return TTL_SECONDS;
}
