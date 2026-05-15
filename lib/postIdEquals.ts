/** Feed / API post ids can be string or number depending on client JSON; compare canonically. */
export function postIdEquals(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}
