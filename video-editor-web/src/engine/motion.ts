import type { Correction } from '../domain/stabilize';

/** RF-009: each recording's correction, read once. Drawing looks it up by file, frame by frame. */
const paths = new Map<string, Correction[]>();

export const setMotionPath = (uri: string, path: Correction[]) => paths.set(uri, path);
export const motionPathOf = (uri: string) => paths.get(uri) ?? null;
