/**
 * What a phone can carry, from how much memory the browser says it has (it rounds, and reports at
 * most 8). Unknown counts as a normal phone: the slower choices are not forced on anyone by a guess.
 */
const LOW_MEMORY_GB = 3;

export const isLowEndDevice = (memoryGb: number | undefined) => memoryGb !== undefined && memoryGb <= LOW_MEMORY_GB;

/** The preview's short edge. A low one draws and decodes less; the export always reads the originals. */
export const previewShortEdge = (memoryGb: number | undefined) => (isLowEndDevice(memoryGb) ? 540 : 720);

/** Measured on a Samsung A11: speech takes about this many times the clip's length there. */
const LOW_END_SPEECH_FACTOR = 1.5;

/** RF-069: whole minutes to tell the person to expect on a low-end phone; null when it is not one. */
export function speechMinutesOn(memoryGb: number | undefined, clipMs: number): number | null {
  if (!isLowEndDevice(memoryGb)) return null;
  return Math.max(1, Math.ceil((clipMs * LOW_END_SPEECH_FACTOR) / 60000));
}
