/**
 * RF-021: a 360 video is a sphere unrolled into an equirectangular picture. Turning it re-reads each
 * output point from where the turn takes it. `sphereGl` does this per pixel on the GPU; this is the
 * same maths in plain numbers, so it can be tested and kept honest.
 */
export interface SphereView {
  /** Degrees: left-right, up-down, tilt. */
  yaw: number;
  pitch: number;
  roll: number;
  /** A flat cut of one angle, like an ordinary clip; otherwise it stays a full 360 picture. */
  flat: boolean;
  /** The flat cut's horizontal field of view, in degrees. */
  fov: number;
}

const RAD = Math.PI / 180;

/** Column by column: the rotation applied to a view ray, yaw last. */
export function sphereMatrix(v: Pick<SphereView, 'yaw' | 'pitch' | 'roll'>): number[] {
  const [cy, sy] = [Math.cos(v.yaw * RAD), Math.sin(v.yaw * RAD)];
  // Negative: a positive pitch looks up.
  const [cp, sp] = [Math.cos(v.pitch * RAD), -Math.sin(v.pitch * RAD)];
  const [cr, sr] = [Math.cos(v.roll * RAD), Math.sin(v.roll * RAD)];
  // R = Ry(yaw) * Rx(pitch) * Rz(roll)
  return [
    cy * cr + sy * sp * sr, cp * sr, -sy * cr + cy * sp * sr,
    -cy * sr + sy * sp * cr, cp * cr, sy * sr + cy * sp * cr,
    sy * cp, -sp, cy * cp,
  ];
}

/** Where output point (u, v), both 0..1, reads from in the source picture. */
export function sourceUv(u: number, v: number, view: SphereView, aspect = 2): [number, number] {
  let x: number;
  let y: number;
  let z: number;
  if (view.flat) {
    const half = Math.tan((view.fov * RAD) / 2);
    x = (u * 2 - 1) * half;
    y = (1 - v * 2) * half / aspect;
    z = 1;
  } else {
    const lon = (u - 0.5) * 2 * Math.PI;
    const lat = (0.5 - v) * Math.PI;
    x = Math.cos(lat) * Math.sin(lon);
    y = Math.sin(lat);
    z = Math.cos(lat) * Math.cos(lon);
  }
  const m = sphereMatrix(view);
  const rx = m[0] * x + m[3] * y + m[6] * z;
  const ry = m[1] * x + m[4] * y + m[7] * z;
  const rz = m[2] * x + m[5] * y + m[8] * z;
  const length = Math.hypot(rx, ry, rz);
  const su = Math.atan2(rx, rz) / (2 * Math.PI) + 0.5;
  const sv = 0.5 - Math.asin(ry / length) / Math.PI;
  return [su, sv];
}

/** A 2:1 video is what a 360 camera writes: the tool is offered for it, never forced. */
export function looksLike360(width: number, height: number): boolean {
  return Math.abs(width / height - 2) < 0.02;
}
