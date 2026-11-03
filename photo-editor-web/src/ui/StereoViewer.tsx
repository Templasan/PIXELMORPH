import { useEffect, useRef, useState } from 'react';
import type { PhotoSession } from '../application/session';
import { autoEyeMix, eyeMix } from '../domain/stereoscopic/StereoscopicDetection';
import { t } from '../i18n';
import { Icon } from './Icon';

/** With no tilt reading after this long, the device has no sensor to follow. */
const SENSOR_WAIT_MS = 800;

/** RF-071: a stereo photo with depth, following the device's tilt; it can be paused or left. */
export function StereoViewer({ session, onClose }: { session: PhotoSession; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const [following, setFollowing] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    let tilt: number | null = null;
    let base: number | null = null;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null) return;
      // Relative to how the device was held when the view opened.
      base ??= e.gamma;
      tilt = e.gamma - base;
      setFollowing(true);
    };
    window.addEventListener('deviceorientation', onTilt);
    const opened = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (pausedRef.current) return;
      const noSensor = tilt === null && now - opened > SENSOR_WAIT_MS;
      session.drawStereo(canvas, tilt !== null ? eyeMix(tilt) : noSensor ? autoEyeMix(now - opened) : 0.5);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [session]);

  return (
    <div className="stereo-view">
      <canvas ref={ref} />
      <div className="stereo-bar">
        <button className="icon-btn" onClick={onClose} aria-label={t('Fechar')}>
          <Icon name="x" size={20} />
        </button>
        <span className="muted">{following ? t('Incline o aparelho') : t('Movimento automático')}</span>
        <button className="icon-btn" onClick={() => setPaused(!paused)} aria-label={paused ? t('Continuar') : t('Pausar')}>
          <Icon name={paused ? 'play' : 'pause'} size={20} />
        </button>
      </div>
    </div>
  );
}
