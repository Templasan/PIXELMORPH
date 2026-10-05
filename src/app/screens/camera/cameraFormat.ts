import type { BasicAdjustments } from '@modules/photo-editor';

export type CameraMode = 'FOTO' | 'VÍDEO' | 'TEMPORIZADOR' | 'STOP-MOTION' | 'AR';

export const MODES: CameraMode[] = ['FOTO', 'VÍDEO', 'TEMPORIZADOR', 'STOP-MOTION', 'AR'];

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
