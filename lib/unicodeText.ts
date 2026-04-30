/**
 * Unicode-safe helpers for user generated text.
 * - Preserve emoji and non-Latin scripts.
 * - Remove only invisible control chars that can break rendering/storage.
 * - Count/truncate by grapheme cluster (user-visible characters), not UTF-16 code units.
 */

const CONTROL_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function segmentGraphemes(input: string): string[] {
  const value = String(input ?? '');
  if (typeof Intl !== 'undefined' && typeof (Intl as any).Segmenter === 'function') {
    const segmenter = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), (entry: { segment: string }) => entry.segment);
  }
  return Array.from(value);
}

export function sanitizeUserText(value: unknown): string {
  const raw = typeof value === 'string' ? value : String(value ?? '');
  return raw.replace(/\r\n?/g, '\n').replace(CONTROL_EXCEPT_WHITESPACE, '');
}

export function normalizeUserText(value: unknown): string {
  return sanitizeUserText(value).trim();
}

export function graphemeLength(value: unknown): number {
  return segmentGraphemes(sanitizeUserText(value)).length;
}

export function truncateGraphemes(value: unknown, max: number): string {
  if (max <= 0) return '';
  const segments = segmentGraphemes(sanitizeUserText(value));
  if (segments.length <= max) return segments.join('');
  return segments.slice(0, max).join('');
}
