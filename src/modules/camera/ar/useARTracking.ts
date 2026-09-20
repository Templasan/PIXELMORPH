import { useEffect, useState, useRef } from 'react';
import { Gyroscope } from 'expo-sensors';

export interface AROffsets {
  x: number;
  y: number;
}

/**
 * RF-024: Gyro-responsive AR anchor tracking (simulates camera movement).
 * Maps device tilt to anchor offset, creating parallax depth effect.
 */
export function useARTracking(enabled: boolean, maxOffset: number = 0.05): AROffsets {
  const [offset, setOffset] = useState<AROffsets>({ x: 0, y: 0 });
  const lastUpdateRef = useRef<number>(0);
  const filterRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) {
      setOffset({ x: 0, y: 0 });
      filterRef.current = { x: 0, y: 0 };
      return;
    }

    Gyroscope.setUpdateInterval(16);

    const subscription = Gyroscope.addListener((data: { x: number; y: number; z: number }) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < 16) return;
      lastUpdateRef.current = now;

      // Low-pass filter for smooth tracking
      const alpha = 0.3;
      filterRef.current.x = filterRef.current.x * (1 - alpha) + data.y * alpha;
      filterRef.current.y = filterRef.current.y * (1 - alpha) + data.x * alpha;

      // Clamp to ±maxOffset
      const x = Math.max(-maxOffset, Math.min(maxOffset, filterRef.current.x * 10));
      const y = Math.max(-maxOffset, Math.min(maxOffset, filterRef.current.y * 10));

      setOffset({ x, y });
    });

    return () => subscription.remove();
  }, [enabled, maxOffset]);

  return offset;
}
