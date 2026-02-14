/**
 * Attempts to open a URL in an external browser (Safari on iOS WebView).
 * Tries window.open first; if blocked, falls back to location.href.
 * Clipboard copy is a last resort.
 * @param url - Full URL to open (e.g. https://hanar.net/dashboard/account)
 * @returns true if an attempt was made to open/copy
 */
export function openExternalBrowser(url: string): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Try window.open (may open in external browser on iOS WebView)
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (w != null) {
    return true;
  }

  // 2. Fallback: navigate current window (helps escape WebView if popup blocked)
  try {
    window.location.href = url;
    return true;
  } catch {
    // 3. Tertiary: copy to clipboard
    try {
      navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }
}
