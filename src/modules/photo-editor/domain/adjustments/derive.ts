import { toFullUniforms, type FullAdjustmentUniforms } from '../color/colorAdjustments';
import { toRetroUniforms, type RetroUniforms } from '../effects/retroEffects';
import { computeHomography, type Mat3, type Point } from '../geometry/homography';
import type { Adjustments } from './Adjustments';

/**
 * What the canvas (and the bake actions) need from the numeric adjustments — computed in one
 * place so the live render, the histogram and "bake into pixels" can never disagree.
 */

/** RF-047/063/059/029: uniforms of the color-adjustment shader. */
export function adjustmentUniforms(a: Adjustments): FullAdjustmentUniforms {
  return toFullUniforms(
    a,
    {
      nitidez: a.nitidez,
      raio: a.raio,
      reducaoRuido: a.reducaoRuido,
      luminancia: a.luminancia,
    },
    {
      colorIndex: a.corIndex >= 0 ? a.corIndex : null,
      tolerancia: a.corTolerancia,
      desaturarResto: a.corDesaturarResto,
      matiz: a.corMatiz,
      saturacao: a.corSaturacao,
      luminosidade: a.corLuminosidade,
    },
    {
      master: { y1: a.curveMasterY1, y2: a.curveMasterY2 },
      r: { y1: a.curveRY1, y2: a.curveRY2 },
      g: { y1: a.curveGY1, y2: a.curveGY2 },
      b: { y1: a.curveBY1, y2: a.curveBY2 },
    }
  );
}

/** RF-041/RF-028: uniforms of the retro + overlay-texture shader. */
export function retroUniformsOf(a: Adjustments, width: number, height: number): RetroUniforms {
  return toRetroUniforms(
    {
      aging: a.retroAging,
      agingBlend: a.retroAgingBlend,
      grain: a.retroGrain,
      grainBlend: a.retroGrainBlend,
      vignette: a.retroVignette,
      vignetteBlend: a.retroVignetteBlend,
    },
    { type: a.overlayType, intensity: a.overlayIntensity, opacity: a.overlayOpacity },
    width,
    height
  );
}

/** US-05: the 4 marked perspective corners in canvas space. */
export function perspectiveCornersOf(
  a: Adjustments,
  width: number,
  height: number
): [Point, Point, Point, Point] {
  return [
    { x: a.perspX0 * width, y: a.perspY0 * height },
    { x: a.perspX1 * width, y: a.perspY1 * height },
    { x: a.perspX2 * width, y: a.perspY2 * height },
    { x: a.perspX3 * width, y: a.perspY3 * height },
  ];
}

/**
 * RF-048: maps the marked (distorted) quad onto the full canvas rect, or null when the corners
 * are (within half a pixel) the identity quad.
 */
export function perspectiveMatrixOf(a: Adjustments, width: number, height: number): Mat3 | null {
  const corners = perspectiveCornersOf(a, width, height);
  const identity: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const active = corners.some(
    (p, i) => Math.abs(p.x - identity[i].x) > 0.5 || Math.abs(p.y - identity[i].y) > 0.5
  );
  return active ? computeHomography(corners, identity) : null;
}

/** Quarter turns plus horizon straightening, in radians. */
export function totalRotationRadOf(a: Adjustments): number {
  return ((a.rotation90 + a.fineRotation) * Math.PI) / 180;
}
