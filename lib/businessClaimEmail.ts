/** Mask business email for display, e.g. j***@example.com */
export function maskBusinessEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return '***';
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(2, Math.min(local.length - 1, 4)))}@${domain}`;
}

export function normalizeBusinessEmail(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidBusinessEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeBusinessEmail(value));
}

export function generateClaimEmailCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
