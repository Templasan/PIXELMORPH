import { useEffect, useState, useRef } from 'react';
import { Gyroscope } from 'expo-sensors';

export interface ParallaxOffset {
  x: number;
  y: number;
}

/**
 * RF-071: Real-time parallax effect responding to device gyroscope rotation.
 * Maps gyro Y (left-right tilt) to X offset, gyro X (up-down tilt) to Y offset.
 */
export function useGyroParallax(enabled: boolean, maxOffset: number = 30): ParallaxOffset {
  const [offset, setOffset] = useState<ParallaxOffset>({ x: 0, y: 0 });
  const lastUpdateRef = useRef<number>(0);
  const filterRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) {
      setOffset({ x: 0, y: 0 });
      filterRef.current = { x: 0, y: 0 };
      return;
    }

    // Set sampling rate to ~60Hz for smooth animation
    Gyroscope.setUpdateInterval(16);

    const subscription = Gyroscope.addListener((data: { x: number; y: number; z: number }) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < 16) return;
      lastUpdateRef.current = now;

      // Low-pass filter: smooth out noisy gyro data
      const alpha = 0.3;
      filterRef.current.x = filterRef.current.x * (1 - alpha) + data.y * alpha;
      filterRef.current.y = filterRef.current.y * (1 - alpha) + data.x * alpha;

      // Map gyro angular velocity (rad/s) to pixel offset
      // Y rotation (tilt left-right) → X offset, X rotation (tilt up-down) → Y offset
      const x = Math.max(-maxOffset, Math.min(maxOffset, filterRef.current.x * 100));
      const y = Math.max(-maxOffset, Math.min(maxOffset, filterRef.current.y * 100));

      setOffset({ x, y });
    });

    return () => subscription.remove();
  }, [enabled, maxOffset]);

  return offset;
}
