import { createStore, type Store } from '../state/createStore';
import { t } from '../i18n';
import { DEFAULT_ADJUSTMENTS, type Adjustments } from '../domain/adjustments';
import {
  createPaintLayer,
  createShapeLayer,
  createStrokeId,
  createTextLayer,
  pointsToPath,
  pressureWidth,
  type BrushShape,
  type EditorLayer,
  type ShapeDraft,
  type TextDraft,
  type WarpMode,
} from '../domain/layers';

/** The undo log the store records adjustment edits into (core/history's usePersistedHistory). */
export interface AdjustmentsHistory {
  push(type: string, from: unknown, to: unknown): void;
  undo(): { type: string; params: { from: unknown; to: unknown } } | undefined;
  redo(): { type: string; params: { from: unknown; to: unknown } } | undefined;
  clearFields(types: readonly string[]): void;
}

export interface Brush {
  color: string;
  size: number;
  shape: BrushShape;
  opacity: number;
}

export interface PhotoEditorState {
  adjustments: Adjustments;
  /** Open tool drawer (toolbar id) or null. */
  activeTool: string | null;
  compareMode: boolean;
  compareSplit: number;
  zoom: number;
  layers: EditorLayer[];
  selectedLayerId: string;
  brush: Brush;
  /** The liquify brush. */
  warpBrush: { mode: WarpMode; radius: number; strength: number };
  /** Points of the stroke being drawn right now (canvas space). */
  currentStroke: { x: number; y: number }[];
  /** Elementos forms; they survive closing the drawer and follow the selected layer. */
  textDraft: TextDraft;
  shapeDraft: ShapeDraft;
}

/** History op type of a preset: params hold several fields' values. */
export const PRESET_OP = 'preset';
/** History op type of a layer edit: params hold the whole stack before and after. */
export const LAYERS_OP = 'layers';

const SHAPE_NAMES: Record<ShapeDraft['kind'], string> = {
  circle: 'Círculo',
  rect: 'Retângulo',
  line: 'Linha',
  arrow: 'Seta',
};

export function defaultLayers(): EditorLayer[] {
  return [
    { id: 'fundo', name: t('Fundo'), kind: 'background', visible: true, opacity: 100, locked: true },
    {
      id: 'ajustes',
      name: t('Ajustes de cor'),
      kind: 'adjustments',
      visible: true,
      opacity: 100,
      locked: false,
    },
    createPaintLayer(t('Pintura {n}', { n: 1 })),
  ];
}

export function initialPhotoEditorState(): PhotoEditorState {
  return {
    adjustments: DEFAULT_ADJUSTMENTS,
    activeTool: null,
    compareMode: false,
    compareSplit: 50,
    zoom: 100,
    layers: defaultLayers(),
    selectedLayerId: 'fundo',
    brush: { color: '#E5484D', size: 8, shape: 'round', opacity: 100 },
    warpBrush: { mode: 'push', radius: 40, strength: 0.5 },
    currentStroke: [],
    textDraft: {
      content: '',
      fontFamily: 'sans-serif',
      color: '#FFFFFF',
      shadow: false,
      strokeColor: '#000000',
      strokeWidth: 2,
      entrada: 0,
      saida: 100,
      align: 'center',
    },
    shapeDraft: { kind: 'circle', color: '#FFFFFF', strokeWidth: 4 },
  };
}

/**
 * The photo editor's state and its edit rules, outside React: the canvas, each drawer and the
 * toolbar subscribe to the slice they use (useStore + selector), so a slider tick or a brush
 * point no longer re-renders the whole screen.
 *
 * Adjustments follow the same contract the screen had: a slider sets a field live, and on
 * release `commitField` records one undo entry (field, from, to). Fields touched before the
 * persisted history finished loading win over the replay (`hydrateAdjustments`).
 */
export function createPhotoEditorStore(history: AdjustmentsHistory) {
  const store: Store<PhotoEditorState> = createStore(initialPhotoEditorState());
  /** Fields the user touched before hydration, re-applied on top of the replayed history. */
  const edited: Record<string, number> = {};
  /** Stylus pressure samples (0..1) of the stroke being drawn — empty for a finger. */
  let pressures: number[] = [];

  const get = () => store.get();
  const set = (patch: Partial<PhotoEditorState>) => store.set((s) => ({ ...s, ...patch }));
  const setAdjustments = (patch: Record<string, number>) =>
    set({ adjustments: { ...get().adjustments, ...patch } });
  /** The stack when the running drag began (see liveLayers). */
  let layersGesture: EditorLayer[] | null = null;
  function endLayers() {
    const before = layersGesture;
    layersGesture = null;
    if (before && before !== get().layers) history.push(LAYERS_OP, before, get().layers);
  }
  /** A discrete layer edit: one undo step. */
  function setLayers(fn: (layers: EditorLayer[]) => EditorLayer[]) {
    endLayers();
    const before = get().layers;
    const after = fn(before);
    if (after === before) return;
    set({ layers: after });
    history.push(LAYERS_OP, before, after);
  }
  /** A layer edit that follows a finger or a slider: one undo step when it ends (endLayers). */
  function liveLayers(fn: (layers: EditorLayer[]) => EditorLayer[]) {
    layersGesture ??= get().layers;
    set({ layers: fn(get().layers) });
  }
  const selectedLayer = () => get().layers.find((l) => l.id === get().selectedLayerId);
  /** Selects a layer; a text/shape selection loads its real style into the matching form. */
  function select(selectedLayerId: string) {
    const layer = get().layers.find((l) => l.id === selectedLayerId);
    const patch: Partial<PhotoEditorState> = { selectedLayerId };
    if (layer?.kind === 'text' && layer.text) {
      const t = layer.text;
      patch.textDraft = {
        content: t.content,
        fontFamily: t.fontFamily,
        color: t.color,
        shadow: t.shadow,
        strokeColor: t.strokeColor,
        strokeWidth: t.strokeWidth,
        entrada: t.entrada,
        saida: t.saida,
        align: t.align ?? 'center',
      };
    } else if (layer?.kind === 'shape' && layer.shape) {
      const sh = layer.shape;
      patch.shapeDraft = { kind: sh.kind, color: sh.color, strokeWidth: sh.strokeWidth };
    }
    set(patch);
  }
  function addLayers(added: EditorLayer[]) {
    if (added.length === 0) return;
    setLayers((layers) => [...layers, ...added]);
    select(added[added.length - 1].id);
  }

  function restore(op: ReturnType<AdjustmentsHistory['undo']>, side: 'from' | 'to') {
    if (op?.type === LAYERS_OP) {
      const layers = op.params[side] as EditorLayer[];
      set({ layers });
      select(layers.some((l) => l.id === get().selectedLayerId) ? get().selectedLayerId : 'fundo');
    } else if (op?.type === PRESET_OP) {
      // A step made by the app may not know a newer field: undoing it goes back to neutral.
      const to = op.params.to as Record<string, number>;
      const neutral = Object.fromEntries(Object.keys(to).map((k) => [k, DEFAULT_ADJUSTMENTS[k]]));
      setAdjustments({ ...neutral, ...(op.params[side] as Record<string, number>) });
    }
    else if (op && op.type in DEFAULT_ADJUSTMENTS)
      setAdjustments({ [op.type]: op.params[side] as number });
  }

  return {
    store,

    // ---- adjustments (undo-tracked) ----
    hydrateAdjustments(replayed: Adjustments) {
      set({ adjustments: { ...replayed, ...edited } });
    },
    /** Live value while a slider/handle moves (no undo entry yet). */
    setField(field: string, value: number) {
      edited[field] = value;
      setAdjustments({ [field]: value });
    },
    setFields(patch: Record<string, number>) {
      Object.assign(edited, patch);
      setAdjustments(patch);
    },
    /** Gesture end / discrete change: applies `value` and records one undo entry. */
    commitField(field: string, value: number, previousValue: number) {
      edited[field] = value;
      setAdjustments({ [field]: value });
      if (value !== previousValue) history.push(field, previousValue, value);
    },
    /** A preset: many fields in one undo step (the log keeps the fields' values before/after). */
    applyPreset(patch: Record<string, number>) {
      const before = get().adjustments;
      const from: Record<string, number> = {};
      for (const k of Object.keys(patch)) from[k] = before[k];
      Object.assign(edited, patch);
      setAdjustments(patch);
      history.push(PRESET_OP, from, patch);
    },
    /** Resets fields to neutral and drops their undo entries (after baking them into pixels). */
    resetFields(fields: readonly string[]) {
      const patch: Record<string, number> = {};
      for (const f of fields) patch[f] = DEFAULT_ADJUSTMENTS[f];
      setAdjustments(patch);
      history.clearFields(fields);
    },
    undo() {
      endLayers();
      restore(history.undo(), 'from');
    },
    redo: () => restore(history.redo(), 'to'),

    // ---- tools and view ----
    toggleTool: (tool: string) => set({ activeTool: get().activeTool === tool ? null : tool }),
    setTool: (activeTool: string | null) => set({ activeTool }),
    /** Next tool in `order` after the active one (RF-076 shortcut). */
    nextTool(order: readonly string[]) {
      const i = order.indexOf(get().activeTool ?? '');
      set({ activeTool: order[(i + 1) % order.length] });
    },
    toggleCompare: () => set({ compareMode: !get().compareMode }),
    setCompareSplit: (compareSplit: number) => set({ compareSplit }),
    setZoom: (zoom: number) => set({ zoom }),

    // ---- layers (persisted separately by layerStorage; their undo steps last one session) ----
    hydrateLayers(saved: EditorLayer[]) {
      const keep = saved.some((l) => l.id === get().selectedLayerId);
      set({ layers: saved, selectedLayerId: keep ? get().selectedLayerId : 'fundo' });
    },
    setLayers,
    liveLayers,
    endLayers,
    selectLayer: select,
    /** Adds layers and selects the last one added. */
    addLayers,

    // ---- Elementos (text, shapes, memes, stickers) ----
    /** Form edits apply live to a selected text, so it can be read on the picture while typing. */
    setTextDraft(patch: Partial<TextDraft>) {
      set({ textDraft: { ...get().textDraft, ...patch } });
      const sel = selectedLayer();
      if (sel?.kind === 'text' && !sel.locked) {
        liveLayers((layers) =>
          layers.map((l) => (l.id === sel.id && l.text ? { ...l, text: { ...l.text, ...patch } } : l))
        );
      }
    },
    /** Form edits apply live to a selected shape, so a colour picked for it is never lost. */
    setShapeDraft(patch: Partial<ShapeDraft>) {
      set({ shapeDraft: { ...get().shapeDraft, ...patch } });
      const sel = selectedLayer();
      if (sel?.kind === 'shape' && !sel.locked) {
        liveLayers((layers) =>
          layers.map((l) =>
            l.id === sel.id && l.shape ? { ...l, shape: { ...l.shape, ...patch } } : l
          )
        );
      }
    },
    /** RF-008: creates a text layer, or restyles the selected one (keeping its position). */
    submitText() {
      const { textDraft, layers } = get();
      if (!textDraft.content.trim()) return;
      const sel = selectedLayer();
      if (sel?.kind === 'text' && sel.text) {
        endLayers(); // the form already applied it while typing
      } else {
        const n = layers.filter((l) => l.kind === 'text').length + 1;
        addLayers([createTextLayer(t('Texto {n}', { n }), textDraft.content, textDraft)]);
      }
    },
    /** RF-044: creates a shape layer, or restyles the selected one (keeping its position). */
    submitShape() {
      const { shapeDraft, layers } = get();
      const sel = selectedLayer();
      if (sel?.kind === 'shape' && sel.shape) {
        endLayers(); // the form already applied it
      } else {
        const n = layers.filter((l) => l.kind === 'shape').length + 1;
        addLayers([
          createShapeLayer(`${t(SHAPE_NAMES[shapeDraft.kind])} ${n}`, shapeDraft.kind, shapeDraft),
        ]);
      }
    },
    /** RF-046: a meme is two classic text layers (bold white, black outline) at top/bottom. */
    submitMeme(top: string, bottom: string) {
      const style = {
        fontFamily: 'sans-serif-black',
        fontSize: 32,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 3,
      };
      const added: EditorLayer[] = [];
      if (top.trim()) {
        const layer = createTextLayer(t('Meme (cima)'), top, style);
        layer.text!.y = 0.12;
        added.push(layer);
      }
      if (bottom.trim()) {
        const layer = createTextLayer(t('Meme (baixo)'), bottom, style);
        layer.text!.y = 0.88;
        added.push(layer);
      }
      addLayers(added);
    },
    /** RF-046: a sticker is an emoji placed as a larger, unstroked text layer. */
    addSticker: (emoji: string) =>
      addLayers([createTextLayer('Adesivo', emoji, { fontSize: 48, strokeWidth: 0 })]),

    // ---- painting ----
    setBrush: (patch: Partial<Brush>) => set({ brush: { ...get().brush, ...patch } }),
    setWarpBrush: (patch: Partial<PhotoEditorState['warpBrush']>) =>
      set({ warpBrush: { ...get().warpBrush, ...patch } }),
    appendStrokePoint(x: number, y: number, pressure?: number) {
      if (pressure) pressures.push(pressure);
      set({ currentStroke: [...get().currentStroke, { x, y }] });
    },
    /**
     * Ends the stroke: appended to the selected layer as one vector stroke (if it has 2+ points).
     * `scene` is the picture's size: a clone's first stroke sets the distance to what it copies.
     */
    commitStroke(scene?: { w: number; h: number }) {
      const { currentStroke: pts, brush, selectedLayerId } = get();
      if (pts.length > 1) {
        const stroke = {
          id: createStrokeId(),
          path: pointsToPath(pts),
          color: brush.color,
          width: pressureWidth(brush.size, pressures),
          opacity: brush.opacity / 100,
          shape: brush.shape,
        };
        setLayers((layers) =>
          layers.map((l) =>
            l.id !== selectedLayerId
              ? l
              : l.local
                ? {
                    ...l,
                    local: {
                      ...l.local,
                      strokes: [...l.local.strokes, stroke],
                      offset:
                        l.local.offset ??
                        (l.local.clone && scene
                          ? { dx: l.local.x * scene.w - pts[0].x, dy: l.local.y * scene.h - pts[0].y }
                          : undefined),
                    },
                  }
                : { ...l, strokes: [...(l.strokes ?? []), stroke] }
          )
        );
      }
      pressures = [];
      set({ currentStroke: [] });
    },
  };
}

export type PhotoEditorStore = ReturnType<typeof createPhotoEditorStore>;
