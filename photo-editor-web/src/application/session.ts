import { DEFAULT_ADJUSTMENTS, type Adjustments } from '../domain/adjustments';
import { SCENE_W, sceneSizeOf, type SceneSize } from '../domain/sceneSize';
import { coverFitRect, scaleToFit, searchQualityForTargetSize, SOCIAL_PRESETS } from '../domain/export/exportMath';
import { setJpegDpi, setPngDpi, setPngIcc } from '../domain/export/exportBytes';
import { adobeRgbProfile, proofCmyk, setJpegIcc, srgbToAdobeRgb, type ExportColorSpace } from '../domain/export/colorSpace';
import { encodePsd, opaqueBounds, type PsdLayer } from '../domain/export/psd';
import { dataUrlBytes } from '../domain/export/dataUrl';
import { PhotoGl, type BlendImage } from '../engine/photoGl';
import { t } from '../i18n';
import { drawCutoutMask, localParts, drawLayer, drawScene, isClosedStroke, layerBox } from '../engine/scene';
import { fillHole } from '../domain/fillHole';
import {
  createCutoutLayer,
  createFaceLayer,
  createImageLayer,
  createLayerId,
  faceRetouchOf,
  RED_EYE_RADIUS,
  isFixedLayer,
  redEyeShare,
  type DetectedFace,
  type EditorLayer,
} from '../domain/layers';
import { sceneOf } from '../domain/scene';
import { isValidQRContent, readQr } from '../domain/QRCode';
import { dominantColors, saliencyMap, suggestCrops, convergenceCrop, vanishingPoint } from '../domain/suggestions';
import { detectStereoscopicFromDimensions, detectStereoscopicFromUri, eyeRects } from '../domain/stereoscopic/StereoscopicDetection';
import { qrDataUrl } from '../engine/qr';
import { drawWatermark } from '../engine/watermark';
import { loadPicture } from '../engine/picture';
import { drawCollage, drawPanorama, type CollageOptions } from '../engine/compose';
import type { CollageLayout } from '../domain/collage/CollageMath';
import { alignPair, type GreyPicture, type PairAlignment } from '../domain/panorama/alignPair';
import { panoramaLayout } from '../domain/panorama/panoramaLayout';
import type { EditorHost, PictureRef, PresetRef, SavedPhoto, WatermarkRef } from '../ports/host';
import { LIGHT_EDGE, qualitySettingOf, tierOf, type QualitySetting } from '../domain/previewQuality';
import { createStore } from '../state/createStore';
import { createHistory, replay } from './history';
import { createPhotoEditorStore, LAYERS_OP } from './photoEditorStore';

/** Collage side (square), as the app made it, a bit larger. */
export const COLLAGE_SIZE = 2048;
/** Panorama height at most (the photos' own if smaller). */
const PANORAMA_HEIGHT = 2048;
/** Photos are compared at this height: enough to line them up, small enough to try every shift. */
const ALIGN_HEIGHT = 120;
/** Each picture of a collage or panorama is read at most this long. */
const MONTAGE_PICTURE_EDGE = 4096;

/** The quality the app set (or Automática), read once: picking another one reopens the editor. */
const qualitySetting = qualitySettingOf((globalThis as { __pmQuality?: unknown }).__pmQuality);
const deviceMemory = (globalThis as { navigator?: { deviceMemory?: number } }).navigator?.deviceMemory;
/** The screen works on a copy this long at most (the tier's); the export always reads the original. */
const previewEdge = LIGHT_EDGE[tierOf(qualitySetting, deviceMemory)];

/** Geometry belongs to one photo; presets carry everything else. */
const GEOMETRY = /^(rotation90|fineRotation|flipH|flipV|mirrorOpacity|persp[XY]\d|crop[XYWH])$/;
function lookOf(a: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(a).filter(([k]) => !GEOMETRY.test(k) && k in DEFAULT_ADJUSTMENTS));
}

/** RF-055 works at this size at most around the area: the filling is soft enough, and it stays quick. */
const REMOVE_EDGE = 384;
/** Known picture kept around the area, in scene units, for the filling to read from. */
const REMOVE_MARGIN = 40;
/** US-26 reads the picture at this size: plenty for colours and composition. */
const ANALYSIS_EDGE = 96;
/** A kept logo is resized to this, since it is saved inside the watermark. */
const WATERMARK_LOGO_EDGE = 512;
/** A QR code is read back at this size at most: enough for any scanner, and quick. */
const QR_CHECK_EDGE = 800;

/** This share of red-eye pixels around an eye switches the fix on by itself. */
const RED_EYE_SHARE = 0.05;

/** What went wrong finding the subject, from the native module's error codes. */
function cutoutErrorText(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  if (/NO_SUBJECT|No subject/.test(text)) return t('Não encontrei um objeto principal nesta foto.');
  if (/NO_PLAY_SERVICES|Play services is not/.test(text)) return t('Este aparelho não tem o Google Play Services, necessário para recortar o fundo.');
  if (/MODEL_DOWNLOAD/.test(text)) return t('Não foi possível baixar o modelo. Confira a internet e tente de novo.');
  return t('Não foi possível recortar o fundo: {msg}', { msg: text });
}

/** RF-066: a QR code on the picture cannot be read, so the export stopped before saving. */
export class QrUnreadableError extends Error {}

/** 'heic': the page writes a quality-100 JPEG and the app re-encodes it (Android 9+ only). */
export type ExportFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'psd';

/** The export sheet's choices; they live in the session, so they survive closing the sheet. */
export interface ExportOptions {
  format: ExportFormat;
  /** 10..100, used unless the target size chooses it. */
  quality: number;
  /** A SOCIAL_PRESETS name: the picture is cover-cropped to that frame. */
  social: string | null;
  /** Smart compression: the highest quality whose file fits `targetMB` (JPEG and WebP only). */
  targetOn: boolean;
  targetMB: number;
  /** Written into JPEG and PNG files. */
  dpi: number;
  /** RF-051: JPEG, PNG and WebP; Adobe RGB only in JPEG and PNG, which can carry its profile. */
  colorSpace: ExportColorSpace;
  /** RF-073: the finished picture as it would print. */
  proofCmyk: boolean;
  /** Export only: never drawn on the preview. An empty text means no watermark. */
  watermark: { text: string; position: number; opacity: number; size: number; rotation: number };
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'jpeg',
  quality: 85,
  social: null,
  targetOn: false,
  targetMB: 2,
  dpi: 300,
  colorSpace: 'srgb',
  proofCmyk: false,
  watermark: { text: '', position: 8, opacity: 60, size: 20, rotation: 0 },
};

export interface ExportResult {
  where: string;
  format: ExportFormat;
  width: number;
  height: number;
  /** The file's size; null for HEIC, which the host encodes after the page is done. */
  bytes: number | null;
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
  /** HEIC export is offered (the host can encode it). */
  canHeic: boolean;
}

async function deflated(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * RF-040: the picture as a Photoshop file. Text, shapes, paint and pictures stay separate layers,
 * rasterized. What works on the pixels below (colour adjustments, masks, retouch, painted looks)
 * has no equivalent to write, so it goes into a bottom layer with everything under it.
 */
/** Effect steps kept as layers of their own in a PSD. */
const MAX_PSD_EFFECT_LAYERS = 6;

function psdOf(
  picture: HTMLCanvasElement,
  layers: EditorLayer[],
  s: {
    photo: CanvasImageSource;
    /** The same photo without its colour work. */
    original: CanvasImageSource;
    size: SceneSize;
    a: Adjustments;
    k: number;
    frameColor: string;
    frameGradientColor: string;
    pictureOf: (uri: string) => CanvasImageSource | undefined;
    dpi: number;
  }
): Uint8Array {
  const { w, h } = s.size.scene;
  const pixelsOf = (paint: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = picture.width;
    c.height = picture.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.setTransform(s.k, 0, 0, s.k, 0, 0);
    paint(ctx);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    c.width = c.height = 0;
    return data;
  };
  const out: PsdLayer[] = [];
  const add = (name: string, rgba: Uint8ClampedArray, l?: EditorLayer) => {
    const box = opaqueBounds(rgba, picture.width, picture.height);
    if (!box) return;
    const cut = new Uint8ClampedArray(box.width * box.height * 4);
    for (let y = 0; y < box.height; y += 1) {
      const from = ((y + box.top) * picture.width + box.left) * 4;
      cut.set(rgba.subarray(from, from + box.width * 4), y * box.width * 4);
    }
    out.push({
      name,
      ...box,
      rgba: cut,
      opacity: Math.round(((l?.opacity ?? 100) / 100) * 255),
      blend: l?.blend ?? 'source-over',
      clip: !!l?.clip,
      visible: l?.visible ?? true,
    });
  };
  const scene = {
    photo: s.photo,
    size: s.size,
    adjustments: s.a,
    frameColor: s.frameColor,
    frameGradientColor: s.frameGradientColor,
    pictureOf: s.pictureOf,
    layers: [] as EditorLayer[],
  };
  const through = (end: number) => (ctx: CanvasRenderingContext2D) => drawScene(ctx, { ...scene, layers: layers.slice(0, end) });
  const isEffect = (l: EditorLayer) => !!(l.local || l.warp || l.art || l.face || l.cutout);
  // A plain subject cut-out hides everything under it: that is a mask on the picture so far.
  const cutAt = layers.reduce(
    (last, l, i) => (l.visible && l.cutout && !l.cutout.backUri && !l.cutout.backColor && !l.cutout.backBlur ? i : last),
    -1
  );
  const effects = layers.flatMap((l, i) => (i > cutAt && l.visible && isEffect(l) ? [i] : []));
  // Each of these is a whole picture in memory: past the limit, the earliest ones are merged.
  const kept = effects.slice(-MAX_PSD_EFFECT_LAYERS);
  const from = cutAt >= 0 && effects.length <= MAX_PSD_EFFECT_LAYERS ? cutAt + 1 : (kept[0] ?? cutAt + 1);
  const baseEnd = cutAt >= 0 ? cutAt : from;
  const basePixels = pixelsOf(through(baseEnd));
  // Colour work has no Photoshop equivalent to map onto, so it is a layer that can be switched off.
  const onlyPhoto = layers.slice(0, baseEnd).every((l) => l.kind === 'background' || l.kind === 'adjustments');
  const plainPixels = onlyPhoto ? pixelsOf((ctx) => drawScene(ctx, { ...scene, photo: s.original })) : null;
  const coloured = !!plainPixels && plainPixels.some((v, i) => v !== basePixels[i]);
  if (coloured) add(t('Foto original'), plainPixels);
  add(coloured ? t('Ajustes') : t('Fundo'), basePixels);
  if (cutAt >= 0) {
    const { cutout } = layers[cutAt];
    const mask = pixelsOf((ctx) => drawCutoutMask(ctx, cutout!, scene));
    for (const base of out) base.mask = mask;
    if (from > cutAt + 1) add(t('Efeitos'), pixelsOf(through(from)));
  }
  layers.slice(from).forEach((l, offset) => {
    const i = from + offset;
    if (l.kind === 'background' || l.kind === 'adjustments') return;
    if (!isEffect(l)) {
      add(l.name, pixelsOf((ctx) => drawLayer(ctx, { ...l, opacity: 100, blend: undefined, visible: true }, w, h, s.pictureOf)), l);
      return;
    }
    if (!l.visible) return;
    const local = l.local && !l.clip && !layers[i + 1]?.clip ? l.local : null;
    if (!local || (local.mask === 'brush' && local.strokes.length === 0) || (local.clone && !local.offset)) {
      // Nothing a PSD can hold apart (liquify, art, a face, a filled background): this step's picture.
      add(l.name, pixelsOf(through(i + 1)));
      return;
    }
    // The change as its own pixels, with its real, editable mask, over what is under it.
    const under = document.createElement('canvas');
    under.width = picture.width;
    under.height = picture.height;
    const uctx = under.getContext('2d', { willReadFrequently: true })!;
    uctx.setTransform(s.k, 0, 0, s.k, 0, 0);
    through(i)(uctx);
    const { changed, mask } = localParts(uctx, l, w, h);
    const read = (c: CanvasRenderingContext2D) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      return c.getImageData(0, 0, picture.width, picture.height).data;
    };
    const pixels = read(changed);
    const alpha = read(mask);
    if (local.invert) for (let p = 3; p < alpha.length; p += 4) alpha[p] = 255 - alpha[p];
    const before = out.length;
    add(l.name, pixels, l);
    if (out.length > before) out[before].mask = alpha;
    changed.canvas.width = changed.canvas.height = mask.canvas.width = mask.canvas.height = 0;
    under.width = under.height = 0;
  });
  const composite = picture.getContext('2d')!.getImageData(0, 0, picture.width, picture.height).data;
  return encodePsd(picture.width, picture.height, out, composite, s.dpi);
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
    name: t('Novo projeto'),
    photo: null,
    size: null,
    frameColor: '#111111',
    frameGradientColor: '#FFFFFF',
    doubleExposure: null,
    overlay: null,
    busy: null,
    canHeic: false,
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
  /** The upright copy of the photo on file: what is read to find its subject. */
  let lightUri = '';
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
    const p = loadPicture(ref.uri, previewEdge)
      .then(({ bitmap }) => {
        blendReady.set(ref.uri, bitmap);
        requestDraw();
        return bitmap;
      })
      .catch(() => null);
    blendPictures.set(ref.uri, p);
  }

  function wantLayerPictures(layers: EditorLayer[]) {
    for (const l of layers) {
      if (l.image) wantBlend({ name: l.name, uri: l.image.uri });
      if (l.cutout) wantBlend({ name: l.name, uri: l.cutout.maskUri });
      if (l.cutout?.backUri) wantBlend({ name: l.name, uri: l.cutout.backUri });
    }
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
      pictureOf: (uri) => blendReady.get(uri),
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
    // A layer step holds the whole stack twice: too heavy to save, the stack itself already is.
    const { done, undone } = history.state.get();
    const lasting = (op: { type: string }) => op.type !== LAYERS_OP;
    return {
      name: i.name,
      photo: i.photo!,
      adjustments: st.adjustments,
      layers: st.layers,
      doubleExposure: i.doubleExposure,
      overlay: i.overlay,
      frameColor: i.frameColor,
      frameGradientColor: i.frameGradientColor,
      history: { done: done.filter(lasting), undone: undone.filter(lasting) },
    };
  }
  function scheduleSave() {
    if (!loaded) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void host.saveProject(snapshot()).catch((e) => console.error('save failed', e));
    }, 400);
  }
  /** Saves now instead of after the debounce: the editor is about to be reopened. */
  function flushSave() {
    clearTimeout(saveTimer);
    return loaded ? host.saveProject(snapshot()) : Promise.resolve();
  }

  let lastStore = editor.store.get();
  editor.store.subscribe(() => {
    const st = editor.store.get();
    if (st.adjustments !== lastStore.adjustments || st.layers !== lastStore.layers) scheduleSave();
    if (st.layers !== lastStore.layers) wantLayerPictures(st.layers);
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

  /** Loads `refs`, draws them with `draw`, and hands the JPEG to the host as a new project. */
  async function makeProject(
    name: string,
    refs: PictureRef[],
    draw: (pics: { bitmap: ImageBitmap; width: number; height: number }[]) => HTMLCanvasElement
  ) {
    if (info.get().busy) return;
    setInfo({ busy: t('Criando {name}…', { name: t(name).toLowerCase() }) });
    const pics: { bitmap: ImageBitmap; width: number; height: number }[] = [];
    let canvas: HTMLCanvasElement | null = null;
    try {
      for (const ref of refs) {
        const { bitmap } = await loadPicture(ref.uri, MONTAGE_PICTURE_EDGE);
        pics.push({ bitmap, width: bitmap.width, height: bitmap.height });
      }
      canvas = draw(pics);
      const done = canvas;
      const blob = await new Promise<Blob | null>((r) => done.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error(t('O navegador não gerou o arquivo.'));
      const sink = host.newProject(name, canvas.width, canvas.height);
      await sink.start(`${name.toLowerCase()}_${Date.now()}.jpg`);
      await sink.write(0, new Uint8Array(await blob.arrayBuffer()));
      await sink.finish();
    } finally {
      for (const p of pics) p.bitmap.close();
      if (canvas) canvas.width = canvas.height = 0;
      setInfo({ busy: null });
    }
  }

  return {
    editor,
    info,
    /** The preview quality: the person's pick, the tier it means here, and the automatic tier. */
    quality: {
      setting: qualitySetting,
      tier: tierOf(qualitySetting, deviceMemory),
      auto: tierOf('auto', deviceMemory),
    },
    /** Saves the project, then asks the host to reopen the editor at that quality. */
    async setPreviewQuality(setting: QualitySetting) {
      await flushSave();
      host.setPreviewQuality(setting);
    },
    history: historyState,
    histogram,
    exportOptions,
    exportTimings,

    async load() {
      try {
        performance.mark('pm:load');
        const saved = await host.loadProject(previewEdge);
        performance.mark('pm:project');
        if (!saved) throw new Error(t('Projeto sem foto.'));
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
        wantLayerPictures(editor.store.get().layers);
        lightUri = saved.previewUri ?? saved.photo.uri;
        const picture = await loadPicture(lightUri, previewEdge);
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
          canHeic: saved.canHeic ?? false,
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
    /** Light-copy pixels per scene unit: the most detail the screen can show. */
    pixelsPerUnit: () => (light ? light.width / SCENE_W : 1),
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
     * The finished picture at the photo's chosen size, with the sheet's options (social crop, target size, DPI,
     * watermark), saved through the host. Defaults to the options the sheet keeps.
     */
    async exportImage(options: ExportOptions = exportOptions.get(), allowUnreadableQr = false): Promise<ExportResult> {
      const i = info.get();
      if (!i.photo) throw new Error(t('Nada para exportar.'));
      setInfo({ busy: t('Exportando…') });
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
        const longEdge = a.outputLongEdge || null;
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
        // A picture that can no longer be read is left out, as the preview leaves it out.
        const layerPictures = new Map<string, ImageBitmap>();
        const layerEdges = new Map<string, number>();
        for (const l of st.layers) {
          if (!l.visible || !l.image) continue;
          const shownW = l.image.size * size.scene.w * (w / size.photo.w);
          const edge = Math.ceil(shownW * Math.max(1, 1 / l.image.aspect));
          layerEdges.set(l.image.uri, Math.max(edge, layerEdges.get(l.image.uri) ?? 0));
        }
        // A mask's edge must be as sharp as the picture it cuts.
        for (const l of st.layers) {
          if (!l.visible || !l.cutout) continue;
          layerEdges.set(l.cutout.maskUri, Math.max(w, h));
          if (l.cutout.backUri) layerEdges.set(l.cutout.backUri, Math.max(w, h));
        }
        for (const [uri, edge] of layerEdges) {
          const pic = await loadPicture(uri, Math.min(edge, MONTAGE_PICTURE_EDGE)).catch(() => null);
          if (!pic) continue;
          bitmaps.push(pic.bitmap);
          layerPictures.set(uri, pic.bitmap);
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
          layers: st.layers.filter((l) => !l.local?.remove),
          frameColor: i.frameColor,
          frameGradientColor: i.frameGradientColor,
          pictureOf: (uri) => layerPictures.get(uri),
        });
        ctx.getImageData(0, 0, 1, 1); // waits for the drawing, so 'drawn' and 'encoded' split right
        if (!allowUnreadableQr) {
          // Read from the finished picture: another layer or an effect may be what hides it.
          for (const l of st.layers) {
            if (!l.visible || !l.image?.qr) continue;
            const box = layerBox(l, size.scene.w, size.scene.h)!;
            const side = Math.max(box.w, box.h) * Math.SQRT2;
            const scale = Math.min(1, QR_CHECK_EDGE / (side * k));
            const check = newCanvas(Math.max(1, Math.round(side * k * scale)), Math.max(1, Math.round(side * k * scale)));
            const cctx = check.getContext('2d', { willReadFrequently: true })!;
            cctx.fillStyle = '#FFFFFF';
            cctx.fillRect(0, 0, check.width, check.height);
            cctx.scale(scale, scale);
            cctx.drawImage(picture, -(box.cx - side / 2) * k, -(box.cy - side / 2) * k);
            const px = cctx.getImageData(0, 0, check.width, check.height);
            if (readQr(px.data, px.width, px.height) !== l.image.qr) {
              throw new QrUnreadableError(t('O QR code "{name}" não pode ser lido nesta foto.', { name: l.name }));
            }
          }
        }
        lap('drawn');
        const cropped = a.cropW < 1 || a.cropH < 1;
        const kept = cropped
          ? newCanvas(Math.max(1, Math.round(picture.width * a.cropW)), Math.max(1, Math.round(picture.height * a.cropH)))
          : picture;
        if (cropped) kept.getContext('2d')!.drawImage(picture, -a.cropX * picture.width, -a.cropY * picture.height);
        let out = kept;
        if (social) {
          out = newCanvas(social.width, social.height);
          const octx = out.getContext('2d')!;
          octx.imageSmoothingQuality = 'high';
          const r = coverFitRect(kept.width, kept.height, social.width, social.height);
          octx.drawImage(kept, r.x, r.y, r.width, r.height);
        }
        const wm = options.watermark;
        if (wm.text.trim()) {
          drawWatermark(out.getContext('2d')!, out.width, out.height, { ...wm, text: wm.text.trim(), opacity: wm.opacity / 100 });
        }
        const { format } = options;
        if (format === 'psd') {
          // shortcut: the crop, social frame and watermark are export-time looks a PSD leaves to the editor that opens it.
          // The GPU's canvas is about to be drawn again, so what it holds now is copied first.
          const adjusted = newCanvas(photo.width, photo.height);
          adjusted.getContext('2d')!.drawImage(photo, 0, 0);
          gl.render({ adjustments: a, adjustmentsVisible: false, units: size.photo, blends });
          const original = gl.picture();
          if (original !== gl.canvas) canvases.push(original);
          const bytes = psdOf(picture, st.layers.filter((l) => !l.local?.remove), { photo: adjusted, original, size, a, k, frameColor: i.frameColor, frameGradientColor: i.frameGradientColor, pictureOf: (uri) => layerPictures.get(uri), dpi: options.dpi });
          const sink = host.exportSink();
          await sink.start(`pixelmorph_${Date.now()}.psd`);
          await sink.write(0, bytes);
          const where = await sink.finish();
          lap('saved');
          return { where, format, width: picture.width, height: picture.height, bytes: bytes.length, quality: null, overTarget: false };
        }
        const adobe = options.colorSpace === 'adobe-rgb' && (format === 'jpeg' || format === 'png');
        if (options.proofCmyk || adobe) {
          const octx = out.getContext('2d', { willReadFrequently: true })!;
          const image = octx.getImageData(0, 0, out.width, out.height);
          if (options.proofCmyk) proofCmyk(image.data);
          if (adobe) srgbToAdobeRgb(image.data);
          octx.putImageData(image, 0, 0);
        }
        if (options.colorSpace === 'display-p3' && format !== 'heic') {
          // Same colours, tagged and stored as Display P3: the browser converts and embeds the profile.
          const wide = newCanvas(out.width, out.height);
          wide.getContext('2d', { colorSpace: 'display-p3' })!.drawImage(out, 0, 0);
          out = wide;
        }
        const heic = format === 'heic';
        const type = heic ? 'image/jpeg' : `image/${format}`;
        const targetOn = options.targetOn && (format === 'jpeg' || format === 'webp');
        const targetBytes = Math.round(options.targetMB * 1024 * 1024);
        // The probe is the same encoder as toBlob below, at the same quality, so the sizes agree.
        const quality = targetOn
          ? searchQualityForTargetSize(targetBytes, (q) => dataUrlBytes(out.toDataURL(type, q / 100)), 20, 100)
          : options.quality;
        const blob = await new Promise<Blob | null>((r) => out.toBlob(r, type, heic ? 1 : quality / 100));
        if (!blob) throw new Error(t('O navegador não gerou o arquivo.'));
        lap('encoded');
        let bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
        if (format === 'jpeg') bytes = setJpegDpi(bytes, options.dpi);
        if (format === 'png') bytes = setPngDpi(bytes, options.dpi);
        if (adobe && format === 'jpeg') bytes = setJpegIcc(bytes, adobeRgbProfile());
        if (adobe && format === 'png') bytes = setPngIcc(bytes, await deflated(adobeRgbProfile()));
        const sink = host.exportSink();
        await sink.start(
          `pixelmorph_${Date.now()}.${format === 'jpeg' ? 'jpg' : format}`,
          heic ? { heicQuality: quality } : undefined
        );
        await sink.write(0, bytes);
        const where = await sink.finish();
        lap('saved');
        return {
          where,
          format,
          width: out.width,
          height: out.height,
          bytes: heic ? null : bytes.length,
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
      setInfo({ busy: t('Aplicando…') });
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
        if (!blob) throw new Error(t('O navegador não gerou o arquivo.'));
        const sink = host.photoSink();
        await sink.start(`baked_${Date.now()}.jpg`);
        await sink.write(0, new Uint8Array(await blob.arrayBuffer()));
        const baked = await sink.finish();
        const picture = await loadPicture(baked.previewUri ?? baked.photo.uri, previewEdge);
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

    /** A picture from the gallery as a new layer on top of the stack. */
    async addImageLayer() {
      const ref = await host.pickPicture();
      const size = sizeOf(editor.store.get().adjustments);
      if (!ref || !size) return;
      wantBlend(ref);
      const bitmap = await blendPictures.get(ref.uri);
      if (!bitmap) throw new Error(t('Não foi possível abrir {name}.', { name: ref.name }));
      editor.addLayers([
        createImageLayer(ref.name, ref.uri, bitmap.width / bitmap.height, size.scene.w / size.scene.h),
      ]);
    },
    /**
     * RF-004: hides everything but the photo's main subject. It is a layer right above the photo's
     * colour adjustments, so they still apply, and deleting it brings the background back.
     */
    async removeBackground(backBlur?: number) {
      if (!host.segmentSubject) throw new Error(t('Recortar o fundo só funciona no app.'));
      setInfo({ busy: t('Procurando o objeto principal…') });
      try {
        const cut = await host.segmentSubject(lightUri);
        wantBlend(cut);
        await blendPictures.get(cut.uri);
        const layer = createCutoutLayer(backBlur ? t('Efeito retrato') : t('Fundo removido'), cut.uri);
        if (backBlur) layer.cutout!.backBlur = backBlur;
        const { layers } = editor.store.get();
        const after = layers.filter(isFixedLayer).length;
        editor.setLayers((ls) => [...ls.slice(0, after), layer, ...ls.slice(after)]);
        editor.selectLayer(layer.id);
      } catch (e) {
        throw new Error(cutoutErrorText(e));
      } finally {
        setInfo({ busy: null });
      }
    },
    /** RF-034: what kind of photo this is. Null when the photo gives no clear answer. */
    async recognizeScene() {
      if (!host.labelImage) throw new Error(t('Reconhecer a cena só funciona no app.'));
      const labels = await host.labelImage(lightUri);
      // A face is the surest sign of a portrait; a failure to look for one should not stop the rest.
      const faces = host.detectFaces ? await host.detectFaces(lightUri).catch(() => []) : [];
      return sceneOf(labels, faces);
    },
    /** RF-016: one layer per face found, each with its own settings; red eye is checked at once. */
    async retouchFaces() {
      if (!host.detectFaces) throw new Error(t('Detectar rostos só funciona no app.'));
      setInfo({ busy: t('Procurando rostos…') });
      try {
        const faces = await host.detectFaces(lightUri);
        if (faces.length === 0) throw new Error(t('Nenhum rosto encontrado nesta foto.'));
        const area = document.createElement('canvas');
        const actx = area.getContext('2d', { willReadFrequently: true })!;
        const hasRedEye = (f: DetectedFace) =>
          [f.leftEye, f.rightEye].some((e) => {
            if (!e || !light) return false;
            const r = Math.max(2, Math.round(f.w * light.width * RED_EYE_RADIUS));
            area.width = area.height = r * 2;
            actx.drawImage(light, e.x * light.width - r, e.y * light.height - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
            return redEyeShare(actx.getImageData(0, 0, r * 2, r * 2).data) > RED_EYE_SHARE;
          });
        const added = faces.map((f, i) =>
          createFaceLayer(t('Rosto {n}', { n: i + 1 }), { ...faceRetouchOf(f), redEye: hasRedEye(f) })
        );
        area.width = area.height = 0;
        editor.addLayers(added);
        return added.length;
      } finally {
        setInfo({ busy: null });
      }
    },
    /** RF-004: a picture from the gallery behind the subject. */
    async pickCutoutBack(id: string) {
      const ref = await host.pickPicture();
      if (!ref) return;
      wantBlend(ref);
      await blendPictures.get(ref.uri);
      editor.setLayers((ls) =>
        ls.map((l) => (l.id === id && l.cutout ? { ...l, cutout: { maskUri: l.cutout.maskUri, backUri: ref.uri } } : l))
      );
    },
    /**
     * RF-055: replaces a marked area with what surrounds it. The result is a picture layer over
     * that spot, so the photo stays untouched and the removal can be undone or hidden.
     */
    removeMarked(layerId: string) {
      const st = editor.store.get();
      const index = st.layers.findIndex((l) => l.id === layerId);
      const marked = st.layers[index];
      const size = sizeOf(st.adjustments);
      if (!marked?.local?.remove || !marked.local.strokes.length || !size || !preview) return;
      const paths = marked.local.strokes.map((s) => ({ s, path: new Path2D(s.path) }));

      // Find the area's bounds from its pixels: strokes have width, and a circle has an inside.
      const { w: sw, h: sh } = size.scene;
      const probe = document.createElement('canvas');
      probe.width = Math.round(sw);
      probe.height = Math.round(sh);
      const pctx = probe.getContext('2d', { willReadFrequently: true })!;
      const paint = (ctx: CanvasRenderingContext2D) => {
        ctx.strokeStyle = ctx.fillStyle = '#fff';
        ctx.lineCap = ctx.lineJoin = 'round';
        for (const { s, path } of paths) {
          ctx.lineWidth = s.width;
          ctx.stroke(path);
          if (isClosedStroke(s.path)) ctx.fill(path);
        }
      };
      paint(pctx);
      const seen = pctx.getImageData(0, 0, probe.width, probe.height).data;
      let x0 = probe.width;
      let y0 = probe.height;
      let x1 = 0;
      let y1 = 0;
      for (let y = 0; y < probe.height; y += 1) {
        for (let x = 0; x < probe.width; x += 1) {
          if (seen[(y * probe.width + x) * 4 + 3] > 0) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x + 1);
            y1 = Math.max(y1, y + 1);
          }
        }
      }
      probe.width = probe.height = 0;
      if (x1 <= x0) return;
      const left = Math.max(0, x0 - REMOVE_MARGIN);
      const top = Math.max(0, y0 - REMOVE_MARGIN);
      const right = Math.min(sw, x1 + REMOVE_MARGIN);
      const bottom = Math.min(sh, y1 + REMOVE_MARGIN);
      const unit = Math.min(preview.canvas.width / size.photo.w, REMOVE_EDGE / Math.max(right - left, bottom - top));
      const width = Math.max(1, Math.round((right - left) * unit));
      const height = Math.max(1, Math.round((bottom - top) * unit));

      // What is under the mark right now: the photo with its effects and the layers below.
      const area = document.createElement('canvas');
      area.width = width;
      area.height = height;
      const ctx = area.getContext('2d', { willReadFrequently: true })!;
      ctx.setTransform(unit, 0, 0, unit, -left * unit, -top * unit);
      const { frameColor, frameGradientColor } = info.get();
      drawScene(ctx, {
        photo: preview.canvas,
        size,
        adjustments: st.adjustments,
        layers: st.layers.slice(0, index),
        frameColor,
        frameGradientColor,
        pictureOf: (uri) => blendReady.get(uri),
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const image = ctx.getImageData(0, 0, width, height);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const mctx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
      mctx.setTransform(unit, 0, 0, unit, -left * unit, -top * unit);
      paint(mctx);
      const alpha = mctx.getImageData(0, 0, width, height).data;
      const hole = new Uint8Array(width * height);
      for (let i = 0; i < hole.length; i += 1) hole[i] = alpha[i * 4 + 3] > 0 ? 1 : 0;
      fillHole(image.data, width, height, hole);
      ctx.putImageData(image, 0, 0);

      // Only the filled part goes in the layer, with a soft edge so it melts into the photo.
      const patch = document.createElement('canvas');
      patch.width = width;
      patch.height = height;
      const out = patch.getContext('2d')!;
      out.filter = 'blur(1.5px)';
      out.drawImage(maskCanvas, 0, 0);
      out.filter = 'none';
      out.globalCompositeOperation = 'source-in';
      out.drawImage(area, 0, 0);
      const uri = patch.toDataURL('image/webp', 0.92);
      area.width = area.height = maskCanvas.width = maskCanvas.height = patch.width = patch.height = 0;

      const layer = createImageLayer(t('Objeto removido'), uri, width / height, sw / sh);
      layer.image = { ...layer.image!, x: (left + right) / 2 / sw, y: (top + bottom) / 2 / sh, size: (right - left) / sw };
      editor.setLayers((ls) => ls.map((l) => (l.id === layerId ? layer : l)));
      editor.selectLayer('fundo');
    },
    /** RF-071: if the photo looks stereoscopic, where each eye's picture is. */
    stereoViews() {
      const photo = info.get().photo;
      if (!photo?.width || !photo.height || !light) return null;
      const byName = detectStereoscopicFromUri(photo.uri);
      const found = byName.isStereoscopic ? byName : detectStereoscopicFromDimensions(photo.width, photo.height);
      return found.isStereoscopic ? eyeRects(found.format, light.width, light.height) : null;
    },
    /** RF-071: draws the view `mix` of the way from the left eye to the right one. */
    drawStereo(canvas: HTMLCanvasElement, mix: number) {
      const views = this.stereoViews();
      const ctx = canvas.getContext('2d');
      if (!views || !ctx || !light) return;
      const { left, right } = views;
      const k = Math.min(canvas.width / left.w, canvas.height / left.h);
      const w = left.w * k;
      const h = left.h * k;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.drawImage(light, left.x, left.y, left.w, left.h, x, y, w, h);
      ctx.globalAlpha = mix;
      ctx.drawImage(light, right.x, right.y, right.w, right.h, x, y, w, h);
      ctx.globalAlpha = 1;
    },
    /** US-26: what the picture on screen suggests. Fast enough to run when the panel opens. */
    analyzePicture() {
      if (!preview) return null;
      const size = sizeOf(editor.store.get().adjustments);
      const k = ANALYSIS_EDGE / Math.max(preview.canvas.width, preview.canvas.height);
      const c = document.createElement('canvas');
      c.width = Math.max(4, Math.round(preview.canvas.width * k));
      c.height = Math.max(4, Math.round(preview.canvas.height * k));
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      // The quick default skips pixels at this reduction, and thin lines come out broken.
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(preview.canvas, 0, 0, c.width, c.height);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      const point = size ? vanishingPoint(data, c.width, c.height) : null;
      const leading = point && size ? convergenceCrop(point, size.scene.w / size.scene.h) : null;
      const result = {
        palette: dominantColors(data),
        crops: size ? suggestCrops(saliencyMap(data, c.width, c.height), c.width, c.height, size.scene.w / size.scene.h) : [],
      };
      c.width = c.height = 0;
      if (leading) result.crops = [leading, ...result.crops];
      return result;
    },
    /** RF-066: a QR code as a picture layer, placed, sized and turned like any other. */
    addQrLayer(content: string) {
      const text = content.trim();
      const size = sizeOf(editor.store.get().adjustments);
      if (!size || !isValidQRContent(text)) throw new Error(t('Digite um link ou texto.'));
      let uri: string;
      try {
        uri = qrDataUrl(text);
      } catch {
        throw new Error(t('Texto longo demais para um QR code.'));
      }
      const layer = createImageLayer(t('QR code'), uri, 1, size.scene.w / size.scene.h, 0.35);
      layer.image!.qr = text;
      editor.addLayers([layer]);
    },
    /** RF-020: kept watermarks, shared by every photo; loaded on demand. */
    watermarks: createStore<WatermarkRef[] | null>(null),
    async loadWatermarks() {
      this.watermarks.set(await host.listWatermarks());
    },
    /** Keeps a layer as a watermark. A picture goes inside it: its file belongs to this project. */
    async saveWatermark(name: string, layer: EditorLayer) {
      let kept = layer;
      if (layer.image && !layer.image.uri.startsWith('data:')) {
        const { bitmap } = await loadPicture(layer.image.uri, WATERMARK_LOGO_EDGE);
        const c = document.createElement('canvas');
        c.width = bitmap.width;
        c.height = bitmap.height;
        c.getContext('2d')!.drawImage(bitmap, 0, 0);
        bitmap.close();
        kept = { ...layer, image: { ...layer.image, uri: c.toDataURL('image/png') } };
        c.width = c.height = 0;
      }
      await host.saveWatermark({ id: createLayerId(), name: name.trim(), layer: kept });
      await this.loadWatermarks();
    },
    async deleteWatermark(id: string) {
      await host.deleteWatermark(id);
      await this.loadWatermarks();
    },
    applyWatermark(watermark: WatermarkRef) {
      editor.addLayers([{ ...watermark.layer, id: createLayerId(), name: watermark.name }]);
    },
    /** A layer alone on a small canvas: the layer list's thumbnail. */
    drawThumb(canvas: HTMLCanvasElement, layer: EditorLayer) {
      const size = sizeOf(editor.store.get().adjustments);
      const ctx = canvas.getContext('2d');
      if (!size || !ctx || !light) return;
      const { w, h } = size.scene;
      const k = Math.min(canvas.width / w, canvas.height / h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, 0, 0, k, (canvas.width - w * k) / 2, (canvas.height - h * k) / 2);
      if (layer.kind === 'background') ctx.drawImage(light, 0, 0, w, h);
      else drawLayer(ctx, { ...layer, opacity: 100, blend: undefined }, w, h, (uri) => blendReady.get(uri));
    },

    /** One more picture for a collage or panorama (the gallery picker); null when cancelled. */
    pickPicture: () => host.pickPicture(),
    /** RF-011: a collage of `refs` (one per cell) becomes a new project. */
    createCollage(refs: PictureRef[], layout: CollageLayout, options: CollageOptions) {
      return makeProject(t('Colagem'), refs, (pics) =>
        drawCollage(pics.map((p) => p.bitmap), pics, layout, COLLAGE_SIZE, options)
      );
    },
    /**
     * RF-062: how each photo lines up with the one before it. A pair that shares too little has
     * no value (null) and keeps what the person set by hand.
     */
    async alignPanorama(refs: PictureRef[]): Promise<(PairAlignment | null)[]> {
      const greys: GreyPicture[] = [];
      for (const ref of refs) {
        const { bitmap } = await loadPicture(ref.uri, MONTAGE_PICTURE_EDGE);
        const height = ALIGN_HEIGHT;
        const width = Math.max(4, Math.round((bitmap.width * height) / bitmap.height));
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        const px = ctx.getImageData(0, 0, width, height).data;
        const data = new Uint8ClampedArray(width * height);
        for (let i = 0; i < data.length; i += 1) data[i] = 0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2];
        c.width = c.height = 0;
        greys.push({ width, height, data });
      }
      return greys.map((g, i) => (i === 0 ? null : alignPair(greys[i - 1], g)));
    },
    /** US-28: `refs` left to right, overlapping by `overlap` of each width, nudged by `offsetsY`. */
    createPanorama(refs: PictureRef[], overlap: number | number[], offsetsY: number[]) {
      return makeProject(t('Panorama'), refs, (pics) => {
        const height = Math.min(PANORAMA_HEIGHT, ...pics.map((p) => p.height));
        return drawPanorama(pics.map((p) => p.bitmap), panoramaLayout(pics, height, overlap, offsetsY));
      });
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
    listPhotoProjects: () => host.listPhotoProjects(),
    /** US-02 batch edit: this photo's look (or a preset's) applied to other photo projects. */
    async applyLookTo(ids: string[], preset: PresetRef | null, onProgress?: (done: number) => void) {
      const look = lookOf(preset ? preset.adjustments : editor.store.get().adjustments);
      let done = 0;
      for (const id of ids) {
        done += await host.applyLookTo([id], look);
        onProgress?.(done);
      }
      return done;
    },
    applyPreset(preset: PresetRef) {
      editor.applyPreset(lookOf(preset.adjustments));
    },

    close: () => host.close(),
  };
}

export type PhotoSession = ReturnType<typeof createPhotoSession>;
