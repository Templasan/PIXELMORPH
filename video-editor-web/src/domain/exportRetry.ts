/**
 * Whether a failed export gets one more try from 1080p copies: the device could not decode a
 * source, the person did not cancel, and the host can make the copies.
 */
export function shouldRetryWithCopies(message: string, cancelled: boolean, canMakeCopies: boolean): boolean {
  return !cancelled && canMakeCopies && /decod/i.test(message);
}
