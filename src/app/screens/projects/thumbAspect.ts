/** Past this a crop leaves a flat colour with no hint of the picture's shape. */
const EXTREME_RATIO = 3;
/** The thinnest a drawn strip may get, or a 1500x3 picture would vanish on a small tile. */
const MAX_DRAWN_RATIO = 24;

/**
 * The aspect ratio to draw a very long or very tall picture at, whole and centred; null when the
 * picture is an ordinary shape (or its size is unknown) and can simply fill its frame.
 */
export function extremeAspectOf(width?: number, height?: number): number | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (ratio >= 1 / EXTREME_RATIO && ratio <= EXTREME_RATIO) return null;
  return Math.min(MAX_DRAWN_RATIO, Math.max(1 / MAX_DRAWN_RATIO, ratio));
}

/** Whether the wide highlight would crop away much of this picture. */
export function cropsInHighlight(width?: number, height?: number): boolean {
  if (!width || !height) return false;
  return width / height < 1 || width / height > EXTREME_RATIO;
}
