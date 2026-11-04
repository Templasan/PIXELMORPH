/**
 * US-18, RF-009: how much a recording shook, from the phone's gyroscope and accelerometer, and the
 * correction that takes the shake out while keeping intended moves. Pure: samples in, numbers out.
 *
 * A sample is [ms since recording began, gyro x, y, z in rad/s, accel x, y, z], device axes:
 * x to the screen's right, y to its top, z out of it.
 */
export type MotionSample = readonly [number, number, number, number, number, number, number];

/** Normalized to the picture's long side (dx, dy); radians, clockwise on screen (rot). */
export interface Correction {
  ms: number;
  dx: number;
  dy: number;
  rot: number;
}

/**
 * Focal length over the picture's long side, for a typical phone main camera (about 65 degrees).
 * shortcut: one value for all phones; read the real one from the camera if a phone test shows it off.
 */
export const FOCAL_OVER_LONG_SIDE = 0.78;
/** The sensor and video clocks start apart by this much. Measured on a phone; 0 until then. */
export const SENSOR_LEAD_MS = 0;
/** Moves slower than this window are intended (a pan), faster ones are shake. */
const SMOOTH_WINDOW_MS = 1000;
const OUTPUT_STEP_MS = 33;
/** Gravity's say in the roll angle. Small, so it only stops slow drift and ignores quick moves. */
const GRAVITY_SHARE = 0.02;
const MAX_STEP_MS = 100;

/** The picture's axes in device axes, from where gravity points: how the phone was held. */
function uprightAxes(samples: readonly MotionSample[]) {
  let ax = 0;
  let ay = 0;
  const first = samples.filter((s) => s[0] - samples[0][0] < 1000);
  for (const s of first) {
    ax += s[4];
    ay += s[5];
  }
  if (Math.abs(ax) <= Math.abs(ay)) {
    const sign = ay >= 0 ? 1 : -1;
    return { right: (x: number) => sign * x, up: (_: number, y: number) => sign * y, r: 1 as const, sign, sideways: false };
  }
  // Held sideways: x points up when ax is positive, and y to the left.
  const sign = ax >= 0 ? 1 : -1;
  return { right: (_: number, y: number) => -sign * y, up: (x: number) => sign * x, r: 1 as const, sign, sideways: true };
}

/** RF-009: the correction along the whole recording. Empty when there is too little to go on. */
export function correctionsOf(samples: readonly MotionSample[]): Correction[] {
  if (samples.length < 10) return [];
  const axes = uprightAxes(samples);
  const n = samples.length;
  const pitch = new Float64Array(n);
  const yaw = new Float64Array(n);
  const roll = new Float64Array(n);
  for (let i = 1; i < n; i += 1) {
    const s = samples[i];
    const before = samples[i - 1];
    const dt = Math.min(MAX_STEP_MS, s[0] - before[0]) / 1000;
    // The step's average rate: its last alone would put the angle half a step ahead of the video.
    const rx = (s[1] + before[1]) / 2;
    const ry = (s[2] + before[2]) / 2;
    pitch[i] = pitch[i - 1] + axes.right(rx, ry) * dt;
    yaw[i] = yaw[i - 1] + axes.up(rx, ry) * dt;
    const turned = roll[i - 1] + ((s[3] + before[3]) / 2) * dt;
    const gx = axes.right(s[4], s[5]);
    const gy = axes.up(s[4], s[5]);
    // Only while the phone is upright enough for gravity to say anything about its tilt.
    const size = Math.hypot(gx, gy);
    const norm = Math.hypot(s[4], s[5], s[6]);
    roll[i] = size > 0.5 * norm && norm > 0 ? turned * (1 - GRAVITY_SHARE) + Math.atan2(gx, gy) * GRAVITY_SHARE : turned;
  }
  const smoothed = (values: Float64Array) => {
    const sum = new Float64Array(n + 1);
    for (let i = 0; i < n; i += 1) sum[i + 1] = sum[i] + values[i];
    const out = new Float64Array(n);
    let a = 0;
    let b = 0;
    for (let i = 0; i < n; i += 1) {
      while (samples[i][0] - samples[a][0] > SMOOTH_WINDOW_MS / 2) a += 1;
      while (b < n - 1 && samples[b + 1][0] - samples[i][0] <= SMOOTH_WINDOW_MS / 2) b += 1;
      out[i] = (sum[b + 1] - sum[a]) / (b + 1 - a);
    }
    return out;
  };
  const steadyPitch = smoothed(pitch);
  const steadyYaw = smoothed(yaw);
  const steadyRoll = smoothed(roll);
  const out: Correction[] = [];
  let next = samples[0][0];
  for (let i = 0; i < n; i += 1) {
    if (samples[i][0] < next) continue;
    next = samples[i][0] + OUTPUT_STEP_MS;
    out.push({
      ms: samples[i][0] - SENSOR_LEAD_MS,
      // Turning left (yaw up) moves the scene right, tilting up moves it down: undo both.
      dx: -FOCAL_OVER_LONG_SIDE * (yaw[i] - steadyYaw[i]),
      dy: -FOCAL_OVER_LONG_SIDE * (pitch[i] - steadyPitch[i]),
      // Turning the phone counter-clockwise turns the scene clockwise on screen.
      rot: -(roll[i] - steadyRoll[i]),
    });
  }
  return out;
}

/** The correction at a moment of the source, between its steps. */
export function correctionAt(path: readonly Correction[], ms: number): Correction | null {
  if (path.length === 0) return null;
  if (ms <= path[0].ms) return path[0];
  if (ms >= path[path.length - 1].ms) return path[path.length - 1];
  let lo = 0;
  let hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].ms <= ms) lo = mid;
    else hi = mid;
  }
  const a = path[lo];
  const b = path[hi];
  const k = (ms - a.ms) / (b.ms - a.ms);
  return { ms, dx: a.dx + (b.dx - a.dx) * k, dy: a.dy + (b.dy - a.dy) * k, rot: a.rot + (b.rot - a.rot) * k };
}

/** The picture is enlarged by this, and the correction moves it within what that leaves spare. */
export const STABLE_ZOOM = 1.1;
const MAX_ROT = (1.5 * Math.PI) / 180;
/** The rest of the spare edge is kept for the turn. */
const SHIFT_SHARE = 0.7;

/** The correction in pixels for a picture this size, never so far that an edge shows. */
export function fitCorrection(c: Correction, width: number, height: number) {
  const long = Math.max(width, height);
  const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
  const spare = ((STABLE_ZOOM - 1) / 2) * SHIFT_SHARE;
  return {
    // The enlargement enlarges the shake too.
    dx: clamp(c.dx * long * STABLE_ZOOM, spare * width),
    dy: clamp(c.dy * long * STABLE_ZOOM, spare * height),
    rot: clamp(c.rot, MAX_ROT),
  };
}
