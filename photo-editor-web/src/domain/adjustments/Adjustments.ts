import { CURVE_IDENTITY } from '../color/colorAdjustments';
import {
  DEFAULT_DOUBLE_EXPOSURE_BLEND,
  DEFAULT_DOUBLE_EXPOSURE_OPACITY,
} from '../effects/doubleExposure';

/**
 * Every numeric, undo-tracked setting of the photo editor (color, geometry, effects). Each field
 * is one history operation type (core/history), so undo/redo and reopening a project replay them.
 */
export interface Adjustments {
  // Básico (RF-047)
  temperatura: number;
  tint: number; // RF-003 white balance's green<->magenta axis
  matiz: number;
  saturacao: number;
  luminosidade: number;
  vibracao: number;
  exposicao: number;
  // Detalhe (RF-063)
  nitidez: number;
  raio: number;
  reducaoRuido: number;
  luminancia: number;
  // Cor seletiva (RF-059) — corIndex -1 means "no color selected".
  corIndex: number;
  corTolerancia: number;
  corDesaturarResto: number;
  corMatiz: number;
  corSaturacao: number;
  corLuminosidade: number;
  // Curvas (RF-029) — piecewise-linear per channel, see colorAdjustments.ts.
  curveMasterY1: number;
  curveMasterY2: number;
  curveRY1: number;
  curveRY2: number;
  curveGY1: number;
  curveGY2: number;
  curveBY1: number;
  curveBY2: number;
  // Geometria (US-05): rotation, mirror, and 4-point perspective — see geometry/.
  rotation90: number; // 0 | 90 | 180 | 270
  fineRotation: number; // -45..45 (horizon straighten)
  flipH: number; // 0 | 1
  flipV: number; // 0 | 1
  mirrorOpacity: number; // 0..100
  perspX0: number;
  perspY0: number;
  perspX1: number;
  perspY1: number;
  perspX2: number;
  perspY2: number;
  perspX3: number;
  perspY3: number;
  // Efeitos — Retrô (RF-041): envelhecimento/granulado/vinheta, each with its own blend.
  retroAging: number;
  retroAgingBlend: number;
  retroGrain: number;
  retroGrainBlend: number;
  retroVignette: number;
  retroVignetteBlend: number;
  // Efeitos — Overlays (RF-028): procedural textures from the internal repository.
  overlayType: number;
  overlayIntensity: number;
  overlayOpacity: number;
  overlayBlend: number;
  // Efeitos — Molduras (RF-060).
  frameStyle: number;
  frameThickness: number;
  frameRadius: number;
  // Efeitos — Iluminação (RF-068).
  lightType: number;
  lightX: number;
  lightY: number;
  lightIntensity: number;
  // Efeitos — Dupla exposição (RF-075).
  doubleExposureBlend: number;
  doubleExposureOpacity: number;
  [key: string]: number;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  temperatura: 0,
  tint: 0,
  matiz: 0,
  saturacao: 0,
  luminosidade: 0,
  vibracao: 0,
  exposicao: 0,
  nitidez: 0,
  raio: 1,
  reducaoRuido: 0,
  luminancia: 0,
  corIndex: -1,
  corTolerancia: 50,
  corDesaturarResto: 100,
  corMatiz: 0,
  corSaturacao: 0,
  corLuminosidade: 0,
  curveMasterY1: CURVE_IDENTITY.y1,
  curveMasterY2: CURVE_IDENTITY.y2,
  curveRY1: CURVE_IDENTITY.y1,
  curveRY2: CURVE_IDENTITY.y2,
  curveGY1: CURVE_IDENTITY.y1,
  curveGY2: CURVE_IDENTITY.y2,
  curveBY1: CURVE_IDENTITY.y1,
  curveBY2: CURVE_IDENTITY.y2,
  rotation90: 0,
  fineRotation: 0,
  flipH: 0,
  flipV: 0,
  mirrorOpacity: 100,
  perspX0: 0,
  perspY0: 0,
  perspX1: 1,
  perspY1: 0,
  perspX2: 1,
  perspY2: 1,
  perspX3: 0,
  perspY3: 1,
  retroAging: 0,
  retroAgingBlend: 100,
  retroGrain: 0,
  retroGrainBlend: 100,
  retroVignette: 0,
  retroVignetteBlend: 100,
  overlayType: 0,
  overlayIntensity: 60,
  overlayOpacity: 0,
  overlayBlend: 1, // 'screen' — the usual look for light/dust overlays
  frameStyle: 0,
  frameThickness: 30,
  frameRadius: 30,
  lightType: 0,
  lightX: 0.78,
  lightY: 0.22,
  lightIntensity: 0,
  doubleExposureBlend: DEFAULT_DOUBLE_EXPOSURE_BLEND,
  doubleExposureOpacity: DEFAULT_DOUBLE_EXPOSURE_OPACITY,
};

/** Every field the "Ajustes" drawer's 4 tabs (Básico/Curvas/Detalhe/Cor seletiva) own —
 * used to reset just those fields on bake, leaving geometry/effects/frame untouched. */
export const ADJUST_DRAWER_FIELDS: readonly string[] = [
  'temperatura',
  'tint',
  'matiz',
  'saturacao',
  'luminosidade',
  'vibracao',
  'exposicao',
  'nitidez',
  'raio',
  'reducaoRuido',
  'luminancia',
  'corIndex',
  'corTolerancia',
  'corDesaturarResto',
  'corMatiz',
  'corSaturacao',
  'corLuminosidade',
  'curveMasterY1',
  'curveMasterY2',
  'curveRY1',
  'curveRY2',
  'curveGY1',
  'curveGY2',
  'curveBY1',
  'curveBY2',
];

/** Every field "Corrigir perspectiva" owns — reset on bake so the next correction starts
 * from a fresh identity quad instead of warping an already-warped coordinate space. */
export const PERSPECTIVE_FIELDS: readonly string[] = [
  'perspX0',
  'perspY0',
  'perspX1',
  'perspY1',
  'perspX2',
  'perspY2',
  'perspX3',
  'perspY3',
];
