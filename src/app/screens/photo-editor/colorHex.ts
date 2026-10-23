/**
 * Normalises a hex colour ('#abc', 'ABC', '#AABBCC') to '#RRGGBB' upper case.
 * Returns null for anything else, so callers never store a garbage colour.
 */
export function normaliseHex(input: string): string | null {
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(input.trim());
  if (!match) return null;
  const digits = match[1];
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
  return `#${full.toUpperCase()}`;
}

/** True when two colours are the same hex value, ignoring case and the 3-digit form. */
export function sameHex(a: string, b: string): boolean {
  const na = normaliseHex(a);
  return na !== null && na === normaliseHex(b);
}
