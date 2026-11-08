import type { BasicAdjustments } from '@modules/photo-editor';

export type CameraMode = 'FOTO' | 'VÍDEO' | 'STOP-MOTION' | 'AR';

/** Carousel order. */
export const MODES: CameraMode[] = ['VÍDEO', 'FOTO', 'STOP-MOTION', 'AR'];

export type FlashMode = 'off' | 'auto' | 'on';

export const FLASH_LABEL: Record<FlashMode, string> = { off: 'OFF', auto: 'AUTO', on: 'ON' };

/** Photo flash: OFF → AUTO → ON. */
export function nextFlash(flash: FlashMode): FlashMode {
  return flash === 'off' ? 'auto' : flash === 'auto' ? 'on' : 'off';
}

/** The torch has no AUTO, so in VÍDEO the same button only toggles ON and OFF. */
export function nextTorch(flash: FlashMode): FlashMode {
  return flash === 'on' ? 'off' : 'on';
}

/** Seconds of countdown before a photo; 0 is OFF. */
export const TIMER_STEPS = [0, 3, 10];

export function nextTimer(seconds: number): number {
  return TIMER_STEPS[(TIMER_STEPS.indexOf(seconds) + 1) % TIMER_STEPS.length];
}

export const timerLabel = (seconds: number): string => (seconds === 0 ? 'OFF' : `${seconds} s`);

export const STOP_FPS_STEPS = [4, 6, 8, 12];

export function nextStopFps(fps: number): number {
  return STOP_FPS_STEPS[(STOP_FPS_STEPS.indexOf(fps) + 1) % STOP_FPS_STEPS.length];
}

/** Onion skin: how strongly the last stop-motion frame shows over the preview, in percent. */
export const ONION_STEPS = [0, 25, 40, 60];
export const ONION_DEFAULT = 40;

export function nextOnion(percent: number): number {
  return ONION_STEPS[(ONION_STEPS.indexOf(percent) + 1) % ONION_STEPS.length];
}

/** mm:ss for the recording clock. */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

// RF-006/RF-079: Real-time filter presets computed from HSL adjustments.
// Each preset maps to a BasicAdjustments configuration. The overlay is computed
// by sampling a white pixel through the adjustment pipeline to get the final color.
export const FILTER_PRESETS: { name: string; adjustments: BasicAdjustments }[] = [
  {
    name: 'Original',
    adjustments: {
      temperatura: 0,
      tint: 0,
      matiz: 0,
      saturacao: 0,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 0,
    },
  },
  {
    name: 'Vívido',
    adjustments: {
      temperatura: 0,
      tint: 0,
      matiz: 0,
      saturacao: 50,
      luminosidade: 10,
      vibracao: 30,
      exposicao: 0,
    },
  },
  {
    name: 'Retrô 400',
    adjustments: {
      temperatura: 40,
      tint: 20,
      matiz: 0,
      saturacao: -20,
      luminosidade: 5,
      vibracao: -10,
      exposicao: -0.3,
    },
  },
  {
    name: 'Frio',
    adjustments: {
      temperatura: -50,
      tint: -20,
      matiz: 0,
      saturacao: 10,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 0.2,
    },
  },
  {
    name: 'Sépia',
    adjustments: {
      temperatura: 80,
      tint: 50,
      matiz: 20,
      saturacao: -30,
      luminosidade: 10,
      vibracao: 0,
      exposicao: 0,
    },
  },
  {
    name: 'P&B',
    adjustments: {
      temperatura: 0,
      tint: 0,
      matiz: 0,
      saturacao: -100,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 0,
    },
  },
  {
    name: 'Cine',
    adjustments: {
      temperatura: -20,
      tint: 0,
      matiz: 0,
      saturacao: -15,
      luminosidade: -20,
      vibracao: 0,
      exposicao: -0.4,
    },
  },
];

/**
 * Original vector artwork (no stock/licensed photo) used as the shared "sample photo" behind
 * every filter thumbnail, matching how real camera apps preview a look on an actual image
 * instead of a flat color swatch.
 */
export function adjustmentsToOverlayColor(adj: BasicAdjustments): string {
  // Sample white (1,1,1) through adjustments to compute overlay tint.
  // Simplified: convert adjustment values to approximate RGB shift.
  const r = Math.max(0, Math.min(255, 255 + adj.tint * 0.75 + adj.temperatura * 0.15));
  const g = Math.max(0, Math.min(255, 255 - adj.tint * 0.15 + adj.temperatura * 0.05));
  const b = Math.max(0, Math.min(255, 255 - adj.tint * 0.075 - adj.temperatura * 0.15));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/** expo-audio metering is in dBFS (roughly -160 silence .. 0 peak) — map to a 0..100 bar. */
export function meteringToPercent(db: number | undefined): number {
  if (db === undefined || Number.isNaN(db)) return 0;
  const clamped = Math.max(-60, Math.min(0, db));
  return ((clamped + 60) / 60) * 100;
}

/**
 * Clockwise quarter turns that make a captured picture upright, from VisionCamera's
 * orientation of its pixels ('up' is already upright).
 */
export function quarterTurnsOf(orientation: 'up' | 'right' | 'down' | 'left'): number {
  return { up: 0, right: 1, down: 2, left: 3 }[orientation];
}
