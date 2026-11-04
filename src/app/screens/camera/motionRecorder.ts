import { Accelerometer, Gyroscope } from 'expo-sensors';

/** Fast enough for hand shake; the editor works out the correction from these (RF-009). */
const SAMPLE_MS = 20;
/** A recording this long stops adding samples, which keeps the file small enough to read back. */
const MAX_SAMPLES = 30 * 60 * (1000 / SAMPLE_MS);

const round = (v: number) => Math.round(v * 10000) / 10000;

/**
 * Records the phone's motion while the camera records: [ms since start, gyro x y z, accel x y z].
 * `stop` gives null when the phone sent nothing, which is a phone with no such sensors.
 */
export function startMotionRecording() {
  const startedAt = Date.now();
  const samples: number[][] = [];
  let accel = { x: 0, y: 0, z: 0 };
  let clockOffset: number | null = null;
  Gyroscope.setUpdateInterval(SAMPLE_MS);
  Accelerometer.setUpdateInterval(SAMPLE_MS);
  const accelerometer = Accelerometer.addListener((a) => {
    accel = a;
  });
  const gyroscope = Gyroscope.addListener((g) => {
    if (samples.length >= MAX_SAMPLES) return;
    // The sensor's own clock is steadier than when its event reaches this thread.
    clockOffset ??= Date.now() - startedAt - g.timestamp * 1000;
    samples.push([
      Math.round(g.timestamp * 1000 + clockOffset),
      round(g.x),
      round(g.y),
      round(g.z),
      round(accel.x),
      round(accel.y),
      round(accel.z),
    ]);
  });
  return {
    stop(): string | null {
      gyroscope.remove();
      accelerometer.remove();
      return samples.length > 0 ? JSON.stringify(samples) : null;
    },
  };
}

/** Where a video's motion lives: beside it, so it goes when its project's folder goes. */
export const motionFileOf = (videoUri: string) => `${videoUri}.motion.json`;
