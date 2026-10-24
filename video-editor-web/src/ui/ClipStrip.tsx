import { useEffect, useRef, useState } from 'react';
import type { Clip, Track } from '../domain/Track';
import { PEAKS_PER_SECOND, thumbStep, type MediaPreviews } from '../engine/previews';

/** Canvas tiles this wide: a 10-minute clip is many small canvases, drawn only when on screen. */
const TILE_PX = 512;
/** Thumbnails are laid out this far apart (px). */
const THUMB_SPACING_PX = 56;

/** Source time (s) shown at `x` px into the clip. */
function sourceAt(clip: Clip, x: number, pps: number): number {
  if (clip.frozen) return clip.inPointMs / 1000;
  return (clip.inPointMs + (x / pps) * 1000 * (clip.speed ?? 1)) / 1000;
}

/**
 * Thumbnails (video), the picture itself (image) or the waveform (audio, and the sound of a video
 * clip as a thin band) behind a clip's label. Split in tiles that draw when they scroll into view.
 */
export function ClipStrip({
  clip,
  kind,
  width,
  height,
  pps,
  previews,
  root,
}: {
  clip: Clip;
  kind: Track['kind'];
  width: number;
  height: number;
  pps: number;
  previews: MediaPreviews;
  root: HTMLElement | null;
}) {
  if (kind === 'text' || !clip.sourceUri) return null;
  const tiles = Math.ceil(width / TILE_PX);
  return (
    <div className="clip-strip">
      {Array.from({ length: tiles }, (_, i) => (
        <Tile
          key={i}
          x0={i * TILE_PX}
          w={Math.min(TILE_PX, width - i * TILE_PX)}
          h={height}
          clip={clip}
          kind={kind}
          pps={pps}
          previews={previews}
          root={root}
        />
      ))}
    </div>
  );
}

function Tile({
  x0,
  w,
  h,
  clip,
  kind,
  pps,
  previews,
  root,
}: {
  x0: number;
  w: number;
  h: number;
  clip: Clip;
  kind: Track['kind'];
  pps: number;
  previews: MediaPreviews;
  root: HTMLElement | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !root) return;
    // Generous side margins: tiles get ready just before they scroll in.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      root,
      rootMargin: '0px 400px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (!visible) return;
    const draw = () => {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, w, h);
      if (kind === 'video') drawThumbs(ctx, clip, x0, w, h, pps, previews);
      else if (kind === 'image') drawPicture(ctx, clip, w, h, previews);
      if (kind === 'audio') drawWave(ctx, clip, x0, w, h, h, pps, previews);
      else if (kind === 'video') drawWave(ctx, clip, x0, w, h * 0.3, h, pps, previews);
    };
    draw();
    return previews.subscribe(draw);
  }, [visible, clip, kind, x0, w, h, pps, previews]);

  return <canvas ref={ref} width={Math.max(1, Math.round(w))} height={h} style={{ left: x0 }} />;
}

function drawThumbs(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  x0: number,
  w: number,
  h: number,
  pps: number,
  previews: MediaPreviews
) {
  const step = thumbStep((THUMB_SPACING_PX / pps) * (clip.speed ?? 1));
  for (let x = Math.floor(x0 / THUMB_SPACING_PX) * THUMB_SPACING_PX; x < x0 + w; x += THUMB_SPACING_PX) {
    // On the step grid, but never past the source's last frame (the end of the clip had none).
    const last = Math.floor((clip.sourceDurationMs / 1000 - 0.05) / step) * step;
    const t = Math.min(last, Math.round(sourceAt(clip, x, pps) / step) * step);
    const thumb = previews.thumb(clip.sourceUri, +t.toFixed(3));
    if (!thumb) continue;
    const tw = (thumb.width / thumb.height) * h;
    ctx.drawImage(thumb, x - x0, 0, Math.max(tw, THUMB_SPACING_PX), h);
  }
}

function drawPicture(ctx: CanvasRenderingContext2D, clip: Clip, w: number, h: number, previews: MediaPreviews) {
  // A still picture: a small copy of it repeated along the clip.
  const thumb = previews.picture(clip.sourceUri);
  if (!thumb) return;
  const tw = (thumb.width / thumb.height) * h;
  for (let x = 0; x < w; x += tw) ctx.drawImage(thumb, x, 0, tw, h);
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  x0: number,
  w: number,
  bandH: number,
  h: number,
  pps: number,
  previews: MediaPreviews
) {
  if (clip.frozen) return;
  const peaks = previews.waveform(clip.sourceUri);
  if (!peaks) return;
  const gain = (clip.volume ?? 100) / 100;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  const mid = h - bandH / 2;
  for (let x = 0; x < w; x += 2) {
    const a = Math.floor(sourceAt(clip, x0 + x, pps) * PEAKS_PER_SECOND);
    const b = Math.max(a + 1, Math.floor(sourceAt(clip, x0 + x + 2, pps) * PEAKS_PER_SECOND));
    let v = 0;
    for (let i = a; i < b && i < peaks.length; i += 1) v = Math.max(v, peaks[i] ?? 0);
    // Square root: closer to how loud it sounds, so quiet recordings still show their shape.
    const half = Math.max(0.5, Math.sqrt(Math.min(1, v * gain)) * (bandH / 2));
    ctx.fillRect(x, mid - half, 2, half * 2);
  }
}
