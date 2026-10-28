import { DEFAULT_ADJUSTMENTS, type Adjustments } from '../domain/adjustments';
import { sceneSizeOf, type SceneSize } from '../domain/sceneSize';
import { PhotoGl, type BlendImage } from '../engine/photoGl';
import { drawScene } from '../engine/scene';
import { loadPicture } from '../engine/picture';
import type { EditorHost, PictureRef, SavedPhoto } from '../ports/host';
import { createStore } from '../state/createStore';
import { createHistory, replay } from './history';
import { createPhotoEditorStore } from './photoEditorStore';

/** The screen works on a copy this long at most; the export always reads the original. */
const PREVIEW_LONG_EDGE = 2048;

export type ExportFormat = 'jpeg' | 'png' | 'webp';

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
    // The GPU passes run again only when something they draw changed.
    const glKey = JSON.stringify([a, adjustmentsVisible, blends.map((b) => [b.blend, b.opacity, b.image.width])]);
    if (glKey !== lastGlKey) {
      preview.render({ adjustments: a, adjustmentsVisible, units: size.photo, blends });
      lastGlKey = glKey;
      clearTimeout(histogramTimer);
      histogramTimer = setTimeout(measureHistogram, 150);
    }
    const ctx = screen.getContext('2d')!;
    const k = screen.width / size.scene.w;
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

    async load() {
      try {
        const saved = await host.loadProject();
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
        // Without a light copy the original was decoded: its size is known now.
        const photo = saved.previewUri || saved.photo.width ? saved.photo : { ...saved.photo, width: picture.width, height: picture.height };
        preview = new PhotoGl();
        preview.setSource(light, light.width, light.height);
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

    /** The finished picture at the original's full size, saved through the host. */
    async exportImage(format: ExportFormat, quality: number, scale = 1): Promise<string> {
      const i = info.get();
      if (!i.photo) throw new Error('Nada para exportar.');
      setInfo({ busy: 'Exportando…' });
      const gl = new PhotoGl();
      try {
        const st = editor.store.get();
        const a = st.adjustments;
        const full = (await loadPicture(i.photo.uri, gl.maxSize)).bitmap;
        const w = Math.max(1, Math.round(full.width * scale));
        const h = Math.max(1, Math.round(full.height * scale));
        const size = sceneSizeOf(w, h, a.rotation90);
        const blends: BlendImage[] = [];
        for (const ref of [i.doubleExposure, i.overlay]) {
          if (!ref) continue;
          const pic = (await loadPicture(ref.uri, gl.maxSize)).bitmap;
          const de = ref === i.doubleExposure;
          blends.push({
            image: pic,
            blend: de ? a.doubleExposureBlend : a.overlayBlend,
            opacity: (de ? a.doubleExposureOpacity : a.overlayIntensity) / 100,
          });
        }
        gl.setSource(full, w, h);
        gl.render({
          adjustments: a,
          adjustmentsVisible: st.layers.find((l) => l.id === 'ajustes')?.visible ?? true,
          units: size.photo,
          blends,
        });
        const k = w / size.photo.w;
        const out = document.createElement('canvas');
        out.width = Math.round(size.scene.w * k);
        out.height = Math.round(size.scene.h * k);
        const ctx = out.getContext('2d')!;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        drawScene(ctx, {
          photo: gl.canvas,
          size,
          adjustments: a,
          layers: st.layers,
          frameColor: i.frameColor,
          frameGradientColor: i.frameGradientColor,
        });
        const type = `image/${format}`;
        const blob = await new Promise<Blob | null>((r) => out.toBlob(r, type, quality));
        if (!blob) throw new Error('O navegador não gerou o arquivo.');
        const sink = host.exportSink();
        await sink.start(`pixelmorph_${Date.now()}.${format === 'jpeg' ? 'jpg' : format}`);
        await sink.write(0, new Uint8Array(await blob.arrayBuffer()));
        return await sink.finish();
      } finally {
        gl.dispose();
        setInfo({ busy: null });
      }
    },

    close: () => host.close(),
  };
}

export type PhotoSession = ReturnType<typeof createPhotoSession>;
