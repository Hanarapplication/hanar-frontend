/** After opening Phone/Mail, block duplicate navigations (common in mobile WebViews when dismissing the sheet). */
const COOLDOWN_MS = 2500;

let blockedUntil = 0;
let openTimer: ReturnType<typeof setTimeout> | null = null;

function extendContactBlock(extraMs = COOLDOWN_MS) {
  blockedUntil = Date.now() + extraMs;
}

function isContactScheme(url: string): boolean {
  const h = url.trim().toLowerCase();
  return h.startsWith('tel:') || h.startsWith('mailto:');
}

export function buildTelHref(phone: string | null | undefined): string {
  const raw = String(phone ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  return `tel:${digits || raw}`;
}

export function buildMailtoHref(email: string | null | undefined): string {
  const raw = String(email ?? '').trim();
  return raw ? `mailto:${raw}` : '';
}

/**
 * Opens tel:/mailto: once per user action. Ignores re-entrancy while the dialer/composer
 * sheet is open or right after it is dismissed (tap-to-cancel on WebView).
 */
export function openContactUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const href = url.trim();
  if (!href || !isContactScheme(href)) return;

  const now = Date.now();
  if (now < blockedUntil) return;

  extendContactBlock();

  if (openTimer) clearTimeout(openTimer);
  openTimer = setTimeout(() => {
    openTimer = null;
    try {
      window.location.assign(href);
    } catch {
      window.location.href = href;
    }
    extendContactBlock();
  }, 16);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      extendContactBlock();
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', () => {
    extendContactBlock();
  });
}
