import { DEFAULT_ADJUSTMENTS, type Adjustments } from '../domain/adjustments';
import { sceneSizeOf, type SceneSize } from '../domain/sceneSize';
import { coverFitRect, scaleToFit, searchQualityForTargetSize, SIZE_PRESETS, SOCIAL_PRESETS } from '../domain/export/exportMath';
import { setJpegDpi, setPngDpi } from '../domain/export/exportBytes';
import { dataUrlBytes } from '../domain/export/dataUrl';
import { PhotoGl, type BlendImage } from '../engine/photoGl';
import { drawScene } from '../engine/scene';
import { drawWatermark } from '../engine/watermark';
import { loadPicture } from '../engine/picture';
import type { EditorHost, PictureRef, PresetRef, SavedPhoto } from '../ports/host';
import { createStore } from '../state/createStore';
import { createHistory, replay } from './history';
import { createPhotoEditorStore } from './photoEditorStore';

/** The screen works on a copy this long at most; the export always reads the original. */
const PREVIEW_LONG_EDGE = 2048;

/** Geometry belongs to one photo; presets carry everything else. */
const GEOMETRY = /^(rotation90|fineRotation|flipH|flipV|mirrorOpacity|persp[XY]\d)$/;
function lookOf(a: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(a).filter(([k]) => !GEOMETRY.test(k) && k in DEFAULT_ADJUSTMENTS));
}

export type ExportFormat = 'jpeg' | 'png' | 'webp';

/** The export sheet's choices; they live in the session, so they survive closing the sheet. */
export interface ExportOptions {
  format: ExportFormat;
  /** 10..100, used unless the target size chooses it. */
  quality: number;
  /** A SIZE_PRESETS name ('Original' keeps the size); ignored while a social preset is on. */
  sizePreset: string;
  /** A SOCIAL_PRESETS name: the picture is cover-cropped to that frame. */
  social: string | null;
  /** Smart compression: the highest quality whose file fits `targetMB` (JPEG and WebP only). */
  targetOn: boolean;
  targetMB: number;
  /** Written into JPEG and PNG files. */
  dpi: number;
  /** Export only: never drawn on the preview. An empty text means no watermark. */
  watermark: { text: string; position: number; opacity: number; size: number; rotation: number };
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'jpeg',
  quality: 85,
  sizePreset: 'Original',
  social: null,
  targetOn: false,
  targetMB: 2,
  dpi: 300,
  watermark: { text: '', position: 8, opacity: 60, size: 20, rotation: 0 },
};

export interface ExportResult {
  where: string;
  format: ExportFormat;
  width: number;
  height: number;
  bytes: number;
  /** The quality the target size chose; null when the sheet's quality was used. */
  quality: number | null;
  /** The target could not be met even at the lowest quality. */
  overTarget: boolean;
}

export interface SessionInfo {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  name: string;
  photo: SavedPhoto['photo'] | null;
  /** Shape of the picture being edited (scene units), null until the photo is read. */
  size: SceneSize | null;
  frameColor: string;
  frameGradientColor: string;
  doubleExposure: PictureRef | null;
  overlay: PictureRef | null;
  /** A long job running (export), shown over the editor. */
  busy: string | null;
}

/**
 * One photo editing session: the photo, its edit state (application/photoEditorStore), undo,
 * saving through the host and the export. The UI reads its stores and calls its methods; only
 * the session draws (attach) and only through engine/scene.ts.
 */
export function createPhotoSession(host: EditorHost) {
  let history = createHistory();
  const editor = createPhotoEditorStore({
    push: (t, f, to) => history.log.push(t, f, to),
    undo: () => history.log.undo(),
    redo: () => history.log.redo(),
    clearFields: (types) => history.log.clearFields(types),
  });
  const historyState = createStore(history.state.get());
  const info = createStore<SessionInfo>({
    status: 'loading',
    error: null,
    name: 'Novo projeto',
    photo: null,
    size: null,
    frameColor: '#111111',
    frameGradientColor: '#FFFFFF',
    doubleExposure: null,
    overlay: null,
    busy: null,
  });
  const exportOptions = createStore<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  /** Per-channel histogram of the edited photo (64 bins, 0..1), for Ajustes. */
  const histogram = createStore<{ r: number[]; g: number[]; b: number[] } | null>(null);
  let histogramTimer: ReturnType<typeof setTimeout> | undefined;
  function measureHistogram() {
    if (!preview) return;
    // A small copy is plenty for 64 bins and keeps this off the GPU's critical path.
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = Math.max(1, Math.round((160 * preview.canvas.height) / preview.canvas.width));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(preview.canvas, 0, 0, c.width, c.height);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const bins = { r: new Array(64).fill(0), g: new Array(64).fill(0), b: new Array(64).fill(0) };
    for (let i = 0; i < px.length; i += 4) {
      bins.r[px[i] >> 2] += 1;
      bins.g[px[i + 1] >> 2] += 1;
      bins.b[px[i + 2] >> 2] += 1;
    }
    const peak = Math.max(1, ...bins.r, ...bins.g, ...bins.b);
    histogram.set({ r: bins.r.map((v) => v / peak), g: bins.g.map((v) => v / peak), b: bins.b.map((v) => v / peak) });
  }
  const setInfo = (patch: Partial<SessionInfo>) => info.set((s) => ({ ...s, ...patch }));

  let preview: PhotoGl | null = null;
  /** The photo as the screen shows it (the light copy). */
  let light: ImageBitmap | null = null;
  const blendPictures = new Map<string, Promise<ImageBitmap | null>>();
  const blendReady = new Map<string, ImageBitmap>();
  let loaded = false;
  /** ms from the export's start to the end of each stage (diagnostics, read by measuring scripts). */
  const exportTimings: Record<string, number> = {};

  const sizeOf = (a: Adjustments) => {
    return light ? sceneSizeOf(light.width, light.height, a.rotation90) : null;
  };

  function blendsOf(a: Adjustments): BlendImage[] {
    const out: BlendImage[] = [];
    const { doubleExposure, overlay } = info.get();
    const de = doubleExposure && blendReady.get(doubleExposure.uri);
    if (de) out.push({ image: de, blend: a.doubleExposureBlend, opacity: a.doubleExposureOpacity / 100 });
    const ov = overlay && blendReady.get(overlay.uri);
    if (ov) out.push({ image: ov, blend: a.overlayBlend, opacity: a.overlayIntensity / 100 });
    return out;
  }

  function wantBlend(ref: PictureRef | null) {
    if (!ref || blendPictures.has(ref.uri)) return;
    const p = loadPicture(ref.uri, PREVIEW_LONG_EDGE)
      .then(({ bitmap }) => {
        blendReady.set(ref.uri, bitmap);
        requestDraw();
        return bitmap;
      })
      .catch(() => null);
    blendPictures.set(ref.uri, p);
  }

  // ---- drawing on screen ----
  let screen: HTMLCanvasElement | null = null;
  let frame = 0;
  let lastGlKey = '';
  let firstDrawn = false;
  function requestDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  function draw() {
    frame = 0;
    if (!screen || !preview || !light) return;
    const st = editor.store.get();
    const a = st.adjustments;
    const size = sizeOf(a)!;
    const adjustmentsVisible = st.layers.find((l) => l.id === 'ajustes')?.visible ?? true;
    const blends = blendsOf(a);
    const k = screen.width / size.scene.w;
    // The passes draw what the screen shows of the photo, never more than the light copy has.
    const fit = Math.min(1, (size.photo.w * k) / light.width);
    preview.setOutput(Math.max(1, Math.round(light.width * fit)), Math.max(1, Math.round(light.height * fit)));
    // The GPU passes run again only when something they draw changed.
    const glKey = JSON.stringify([a, adjustmentsVisible, blends.map((b) => [b.blend, b.opacity, b.image.width]), fit]);
    if (glKey !== lastGlKey) {
      preview.render({ adjustments: a, adjustmentsVisible, units: size.photo, blends });
      lastGlKey = glKey;
      clearTimeout(histogramTimer);
      histogramTimer = setTimeout(measureHistogram, 150);
    }
    const ctx = screen.getContext('2d')!;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const { frameColor, frameGradientColor } = info.get();
    drawScene(ctx, {
      photo: preview.canvas,
      size,
      adjustments: a,
      layers: st.layers,
      frameColor,
      frameGradientColor,
      stroke: { points: st.currentStroke, brush: st.brush },
    });
    if (!firstDrawn) {
      firstDrawn = true;
      performance.mark('pm:first-draw');
    }
    if (st.compareMode) {
      // ORIGINAL: the photo as it came in (turned like the edit so both halves line up).
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, (size.scene.w * st.compareSplit) / 100, size.scene.h);
      ctx.clip();
      drawScene(ctx, {
        photo: light,
        size,
        adjustments: { ...DEFAULT_ADJUSTMENTS, rotation90: a.rotation90 },
        layers: [],
        frameColor,
        frameGradientColor,
      });
      ctx.restore();
    }
  }

  // ---- saving ----
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  function snapshot(): SavedPhoto {
    const i = info.get();
    const st = editor.store.get();
    return {
      name: i.name,
      photo: i.photo!,
      adjustments: st.adjustments,
      layers: st.layers,
      doubleExposure: i.doubleExposure,
      overlay: i.overlay,
      frameColor: i.frameColor,
      frameGradientColor: i.frameGradientColor,
      history: history.state.get(),
    };
  }
  function scheduleSave() {
    if (!loaded) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void host.saveProject(snapshot()).catch((e) => console.error('save failed', e));
    }, 400);
  }

  let lastStore = editor.store.get();
  editor.store.subscribe(() => {
    const st = editor.store.get();
    if (st.adjustments !== lastStore.adjustments || st.layers !== lastStore.layers) scheduleSave();
    lastStore = st;
    requestDraw();
  });
  let lastInfo = info.get();
  info.subscribe(() => {
    const i = info.get();
    if (
      i.frameColor !== lastInfo.frameColor ||
      i.frameGradientColor !== lastInfo.frameGradientColor ||
      i.doubleExposure !== lastInfo.doubleExposure ||
      i.overlay !== lastInfo.overlay
    )
      scheduleSave();
    wantBlend(i.doubleExposure);
    wantBlend(i.overlay);
    lastInfo = i;
    requestDraw();
  });

  return {
    editor,
    info,
    history: historyState,
    histogram,
    exportOptions,
    exportTimings,

    async load() {
      try {
        performance.mark('pm:load');
        const saved = await host.loadProject();
        performance.mark('pm:project');
        if (!saved) throw new Error('Projeto sem foto.');
        history = createHistory(saved.history);
        historyState.set(history.state.get());
        history.state.subscribe(() => {
          historyState.set(history.state.get());
          scheduleSave();
        });
        // A project saved without its adjustments (the app's first open) replays its log.
        const base = { ...DEFAULT_ADJUSTMENTS, ...saved.adjustments } as Adjustments;
        const adjustments = saved.adjustments ? base : replay(base, history.state.get().done);
        editor.hydrateAdjustments(adjustments);
        if (saved.layers) editor.hydrateLayers(saved.layers);
        const picture = await loadPicture(saved.previewUri ?? saved.photo.uri, PREVIEW_LONG_EDGE);
        light = picture.bitmap;
        performance.mark('pm:picture');
        // Without a light copy the original was decoded: what it really is beats the project's
        // metadata (a project's file can change after its metadata was written).
        const photo = saved.previewUri
          ? saved.photo
          : { ...saved.photo, width: picture.width, height: picture.height, sizeBytes: picture.bytes };
        preview = new PhotoGl();
        preview.setSource(light);
        performance.mark('pm:gl');
        setInfo({
          status: 'ready',
          name: saved.name,
          photo,
          size: sizeOf(adjustments),
          doubleExposure: saved.doubleExposure ?? null,
          overlay: saved.overlay ?? null,
          frameColor: saved.frameColor ?? '#111111',
          frameGradientColor: saved.frameGradientColor ?? '#FFFFFF',
        });
        loaded = true;
      } catch (e) {
        setInfo({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    },

    /** Draws on `canvas` from now on (its size in pixels is the UI's; the picture fills it). */
    attach(canvas: HTMLCanvasElement) {
      screen = canvas;
      lastGlKey = '';
      requestDraw();
    },
    detach(canvas: HTMLCanvasElement) {
      if (screen === canvas) screen = null;
    },
    redraw: requestDraw,
    /** The picture's shape now (it changes with quarter turns). */
    size: () => sizeOf(editor.store.get().adjustments),

    setColors(patch: Partial<Pick<SessionInfo, 'frameColor' | 'frameGradientColor'>>) {
      setInfo(patch);
    },
    async pickBlend(which: 'doubleExposure' | 'overlay') {
      const ref = await host.pickPicture();
      if (ref) setInfo({ [which]: ref });
    },
    clearBlend(which: 'doubleExposure' | 'overlay') {
      setInfo({ [which]: null });
    },

    /**
     * The finished picture with the sheet's options (size, social crop, target size, DPI,
     * watermark), saved through the host. Defaults to the options the sheet keeps.
     */
    async exportImage(options: ExportOptions = exportOptions.get()): Promise<ExportResult> {
      const i = info.get();
      if (!i.photo) throw new Error('Nada para exportar.');
      setInfo({ busy: 'Exportando…' });
      const gl = new PhotoGl();
      // Full-size pictures and canvases are freed as soon as the file is out (see PhotoGl.dispose).
      const bitmaps: ImageBitmap[] = [];
      const canvases: HTMLCanvasElement[] = [];
      const newCanvas = (width: number, height: number) => {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        canvases.push(c);
        return c;
      };
      try {
        const st = editor.store.get();
        const a = st.adjustments;
        const t0 = performance.now();
        const lap = (stage: string) => (exportTimings[stage] = Math.round(performance.now() - t0));
        const full = (await loadPicture(i.photo.uri, gl.maxSize)).bitmap;
        bitmaps.push(full);
        lap('decoded');
        // A social frame is cover-cropped from the full render; a size preset renders smaller.
        const social = SOCIAL_PRESETS.find((p) => p.name === options.social);
        const longEdge = SIZE_PRESETS.find((p) => p.name === options.sizePreset)?.maxLongEdge ?? null;
        const fit = social ? { width: full.width, height: full.height } : scaleToFit(full.width, full.height, longEdge);
        const w = fit.width;
        const h = fit.height;
        const size = sceneSizeOf(w, h, a.rotation90);
        const blends: BlendImage[] = [];
        for (const ref of [i.doubleExposure, i.overlay]) {
          if (!ref) continue;
          const pic = (await loadPicture(ref.uri, gl.maxSize)).bitmap;
          bitmaps.push(pic);
          const de = ref === i.doubleExposure;
          blends.push({
            image: pic,
            blend: de ? a.doubleExposureBlend : a.overlayBlend,
            opacity: (de ? a.doubleExposureOpacity : a.overlayIntensity) / 100,
          });
        }
        gl.setSource(full, false);
        lap('uploaded');
        gl.setOutput(w, h);
        gl.render({
          adjustments: a,
          adjustmentsVisible: st.layers.find((l) => l.id === 'ajustes')?.visible ?? true,
          units: size.photo,
          blends,
        });
        const photo = gl.picture();
        if (photo !== gl.canvas) canvases.push(photo);
        lap('gpu');
        const k = w / size.photo.w;
        const picture = newCanvas(Math.round(size.scene.w * k), Math.round(size.scene.h * k));
        const ctx = picture.getContext('2d')!;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        drawScene(ctx, {
          photo,
          size,
          adjustments: a,
          layers: st.layers,
          frameColor: i.frameColor,
          frameGradientColor: i.frameGradientColor,
        });
        ctx.getImageData(0, 0, 1, 1); // waits for the drawing, so 'drawn' and 'encoded' split right
        lap('drawn');
        let out = picture;
        if (social) {
          out = newCanvas(social.width, social.height);
          const octx = out.getContext('2d')!;
          octx.imageSmoothingQuality = 'high';
          const r = coverFitRect(picture.width, picture.height, social.width, social.height);
          octx.drawImage(picture, r.x, r.y, r.width, r.height);
        }
        const wm = options.watermark;
        if (wm.text.trim()) {
          drawWatermark(out.getContext('2d')!, out.width, out.height, { ...wm, text: wm.text.trim(), opacity: wm.opacity / 100 });
        }
        const { format } = options;
        const type = `image/${format}`;
        const targetOn = options.targetOn && format !== 'png';
        const targetBytes = Math.round(options.targetMB * 1024 * 1024);
        // The probe is the same encoder as toBlob below, at the same quality, so the sizes agree.
        const quality = targetOn
          ? searchQualityForTargetSize(targetBytes, (q) => dataUrlBytes(out.toDataURL(type, q / 100)), 20, 100)
          : options.quality;
        const blob = await new Promise<Blob | null>((r) => out.toBlob(r, type, quality / 100));
        if (!blob) throw new Error('O navegador não gerou o arquivo.');
        lap('encoded');
        let bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
        if (format === 'jpeg') bytes = setJpegDpi(bytes, options.dpi);
        if (format === 'png') bytes = setPngDpi(bytes, options.dpi);
        const sink = host.exportSink();
        await sink.start(`pixelmorph_${Date.now()}.${format === 'jpeg' ? 'jpg' : format}`);
        await sink.write(0, bytes);
        const where = await sink.finish();
        lap('saved');
        return {
          where,
          format,
          width: out.width,
          height: out.height,
          bytes: bytes.length,
          quality: targetOn ? quality : null,
          overTarget: targetOn && bytes.length > targetBytes,
        };
      } finally {
        for (const b of bitmaps) b.close();
        for (const c of canvases) c.width = c.height = 0;
        gl.dispose();
        setInfo({ busy: null });
      }
    },

    /**
     * "Aplicar e recomeçar": `fields` (e.g. the Ajustes drawer's) are drawn into the full photo,
     * which becomes the project's photo, and reset to neutral with their undo steps, so the next
     * pass starts on top of the result. Everything else keeps applying live.
     */
    async bake(fields: readonly string[]) {
      const i = info.get();
      if (!i.photo || i.busy) return;
      setInfo({ busy: 'Aplicando…' });
      const gl = new PhotoGl();
      let bitmap: ImageBitmap | null = null;
      try {
        const now = editor.store.get().adjustments;
        const only = { ...DEFAULT_ADJUSTMENTS } as Adjustments;
        for (const f of fields) only[f] = now[f];
        // shortcut: a photo larger than the GPU's texture limit is baked at that limit; tile it if a phone ever hits this.
        const full = (await loadPicture(i.photo.uri, gl.maxSize)).bitmap;
        bitmap = full;
        const size = sceneSizeOf(full.width, full.height, 0);
        gl.setSource(full, false);
        gl.setOutput(full.width, full.height);
        gl.render({ adjustments: only, adjustmentsVisible: true, units: size.photo, blends: [] });
        const pixels = gl.picture();
        const blob = await new Promise<Blob | null>((r) => pixels.toBlob(r, 'image/jpeg', 0.92));
        if (pixels !== gl.canvas) pixels.width = pixels.height = 0;
        if (!blob) throw new Error('O navegador não gerou o arquivo.');
        const sink = host.photoSink();
        await sink.start(`baked_${Date.now()}.jpg`);
        await sink.write(0, new Uint8Array(await blob.arrayBuffer()));
        const baked = await sink.finish();
        const picture = await loadPicture(baked.previewUri ?? baked.photo.uri, PREVIEW_LONG_EDGE);
        light?.close();
        light = picture.bitmap;
        preview?.setSource(light);
        lastGlKey = '';
        editor.resetFields(fields);
        setInfo({ photo: baked.photo });
      } finally {
        bitmap?.close();
        gl.dispose();
        setInfo({ busy: null });
      }
    },

    /** Saved presets (shared by every photo); loaded on demand. */
    presets: createStore<PresetRef[] | null>(null),
    async loadPresets() {
      this.presets.set(await host.listPresets());
    },
    /** Saves the current look (not the geometry: a preset must not turn or warp another photo). */
    async savePreset(name: string) {
      await host.savePreset(name.trim(), lookOf(editor.store.get().adjustments));
      await this.loadPresets();
    },
    applyPreset(preset: PresetRef) {
      editor.applyPreset(lookOf(preset.adjustments));
    },

    close: () => host.close(),
  };
}

export type PhotoSession = ReturnType<typeof createPhotoSession>;
