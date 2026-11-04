/**
 * US-25, RF-016 in video: faces found in frames sampled from a clip, followed from one sample to
 * the next, each with its own settings. Pure; finding them is ML Kit's, in the app.
 * Positions are normalized to the picture, and times are the source file's.
 */
export interface Point {
  x: number;
  y: number;
}

export interface DetectedFace {
  x: number;
  y: number;
  w: number;
  h: number;
  leftEye: Point | null;
  rightEye: Point | null;
  mouthLeft: Point | null;
  mouthRight: Point | null;
  mouthBottom: Point | null;
}

export interface FaceSample {
  ms: number;
  faces: DetectedFace[];
}

export interface FacePose {
  ms: number;
  x: number;
  y: number;
  w: number;
  h: number;
  leftEye: Point | null;
  rightEye: Point | null;
  mouth: (Point & { w: number }) | null;
}

export interface FaceTrack {
  id: number;
  poses: FacePose[];
  /** 0..100 */
  smooth: number;
  /** 0..100 */
  eyes: number;
  /** -100 cooler .. 100 warmer */
  tone: number;
}

/** A face this far from where it was, in face widths, is another face. */
const MAX_JUMP = 1;
/** A face can go missing for this many samples (a blink, a turn) and still be the same one. */
const MAX_MISSED = 3;
const MAX_TRACKS = 6;

const round = (v: number) => Math.round(v * 10000) / 10000;
const roundPoint = (p: Point | null) => (p ? { x: round(p.x), y: round(p.y) } : null);

function poseOf(ms: number, f: DetectedFace): FacePose {
  const { mouthLeft: a, mouthRight: b, mouthBottom: c } = f;
  return {
    ms,
    x: round(f.x),
    y: round(f.y),
    w: round(f.w),
    h: round(f.h),
    leftEye: roundPoint(f.leftEye),
    rightEye: roundPoint(f.rightEye),
    mouth:
      a && b
        ? { x: round((a.x + b.x) / 2), y: round(c ? (a.y + c.y) / 2 : a.y), w: round(Math.hypot(a.x - b.x, a.y - b.y)) }
        : null,
  };
}

/** Follows faces through the samples, nearest first. A face seen only once was probably not one. */
export function trackFaces(samples: readonly FaceSample[], stepMs: number): FaceTrack[] {
  const open: FacePose[][] = [];
  const done: FacePose[][] = [];
  for (const { ms, faces } of samples) {
    for (let i = open.length - 1; i >= 0; i -= 1) {
      if (ms - open[i][open[i].length - 1].ms > stepMs * (MAX_MISSED + 1)) done.push(...open.splice(i, 1));
    }
    const pairs: { track: number; face: number; distance: number }[] = [];
    open.forEach((poses, track) => {
      const last = poses[poses.length - 1];
      faces.forEach((f, face) => {
        const distance = Math.hypot(f.x + f.w / 2 - last.x - last.w / 2, f.y + f.h / 2 - last.y - last.h / 2) / last.w;
        if (distance <= MAX_JUMP) pairs.push({ track, face, distance });
      });
    });
    pairs.sort((a, b) => a.distance - b.distance);
    const usedTracks = new Set<number>();
    const usedFaces = new Set<number>();
    for (const { track, face } of pairs) {
      if (usedTracks.has(track) || usedFaces.has(face)) continue;
      usedTracks.add(track);
      usedFaces.add(face);
      open[track].push(poseOf(ms, faces[face]));
    }
    faces.forEach((f, face) => {
      if (!usedFaces.has(face)) open.push([poseOf(ms, f)]);
    });
  }
  const area = (poses: FacePose[]) => poses.reduce((sum, p) => sum + p.w * p.h, 0);
  return [...done, ...open]
    .filter((poses) => poses.length >= 2)
    .sort((a, b) => area(b) - area(a))
    .slice(0, MAX_TRACKS)
    .map((poses, id) => ({ id, poses, smooth: 35, eyes: 0, tone: 0 }));
}

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixPoint = (a: Point | null, b: Point | null, k: number) =>
  a && b ? { x: mix(a.x, b.x, k), y: mix(a.y, b.y, k) } : (a ?? b);

/** Where a track's face is at a moment, between its samples; null when it is not on screen then. */
export function poseAt(poses: readonly FacePose[], ms: number): FacePose | null {
  if (poses.length === 0 || ms < poses[0].ms || ms > poses[poses.length - 1].ms) return null;
  let after = 1;
  while (after < poses.length - 1 && poses[after].ms < ms) after += 1;
  const a = poses[after - 1];
  const b = poses[after];
  const k = b.ms === a.ms ? 0 : (ms - a.ms) / (b.ms - a.ms);
  return {
    ms,
    x: mix(a.x, b.x, k),
    y: mix(a.y, b.y, k),
    w: mix(a.w, b.w, k),
    h: mix(a.h, b.h, k),
    leftEye: mixPoint(a.leftEye, b.leftEye, k),
    rightEye: mixPoint(a.rightEye, b.rightEye, k),
    mouth: a.mouth && b.mouth ? { ...mixPoint(a.mouth, b.mouth, k)!, w: mix(a.mouth.w, b.mouth.w, k) } : (a.mouth ?? b.mouth),
  };
}
