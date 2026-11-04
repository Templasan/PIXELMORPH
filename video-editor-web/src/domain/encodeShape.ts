/**
 * Some phones' H.264 encoders only take the long side across: a Samsung A11 encodes 1920x1080 but
 * refuses 1080x1920. Such a picture is stored lying down with a rotation tag, as cameras do.
 * `supports` asks the encoder about one size.
 */
export type EncodeShape = { width: number; height: number; rotation: 0 | 90 } | null;

export async function encodeShapeFor(
  width: number,
  height: number,
  supports: (width: number, height: number) => Promise<boolean>
): Promise<EncodeShape> {
  if (await supports(width, height)) return { width, height, rotation: 0 };
  if (height > width && (await supports(height, width))) return { width: height, height: width, rotation: 90 };
  return null;
}
