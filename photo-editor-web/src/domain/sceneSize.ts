/**
 * The editor draws in scene units, the app's old canvas units: the photo is SCENE_W wide and as
 * tall as its own shape asks (the app forced every photo into 340×227 and cropped it). Text
 * sizes, stroke widths, blur radii and the shaders' `pos` are all in these units, so a project
 * looks the same on screen and in a full-resolution export.
 */
export const SCENE_W = 340;

export interface SceneSize {
  /** The photo's own rect, before its rotation. */
  photo: { w: number; h: number };
  /** The finished picture: the photo turned by its quarter turns. */
  scene: { w: number; h: number };
}

export function sceneSizeOf(photoW: number, photoH: number, rotation90: number): SceneSize {
  const photo = { w: SCENE_W, h: (SCENE_W * photoH) / Math.max(1, photoW) };
  const quarter = ((Math.round(rotation90 / 90) % 4) + 4) % 4;
  const scene = quarter % 2 === 1 ? { w: photo.h, h: photo.w } : { ...photo };
  return { photo, scene };
}
