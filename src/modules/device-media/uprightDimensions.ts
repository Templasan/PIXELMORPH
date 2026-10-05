/** A file stored sideways with a 90/270 rotation tag displays with width and height swapped. */
export function uprightDimensions(
  width: number,
  height: number,
  rotation: number | null | undefined
): { width: number; height: number } {
  const r = (((rotation ?? 0) % 360) + 360) % 360;
  return r === 90 || r === 270 ? { width: height, height: width } : { width, height };
}
