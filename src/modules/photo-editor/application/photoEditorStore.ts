import { createStore, type Store } from '@core/state';
import { DEFAULT_ADJUSTMENTS, type Adjustments } from '../domain/adjustments';
import {
  createPaintLayer,
  createStrokeId,
  pointsToPath,
  pressureWidth,
  type BrushShape,
  type EditorLayer,
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
  /** Points of the stroke being drawn right now (canvas space). */
  currentStroke: { x: number; y: number }[];
}

export function defaultLayers(): EditorLayer[] {
  return [
    { id: 'fundo', name: 'Fundo', kind: 'background', visible: true, opacity: 100, locked: true },
    {
      id: 'ajustes',
      name: 'Ajustes de cor',
      kind: 'adjustments',
      visible: true,
      opacity: 100,
      locked: false,
    },
    createPaintLayer('Pintura 1'),
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
    currentStroke: [],
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
  const setLayers = (fn: (layers: EditorLayer[]) => EditorLayer[]) =>
    set({ layers: fn(get().layers) });

  function restore(op: ReturnType<AdjustmentsHistory['undo']>, side: 'from' | 'to') {
    if (op && op.type in DEFAULT_ADJUSTMENTS)
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
    /** Merges values without history (e.g. applying a preset, as before). */
    applyAdjustments(patch: Partial<Adjustments>) {
      setAdjustments(patch as Record<string, number>);
    },
    /** Resets fields to neutral and drops their undo entries (after baking them into pixels). */
    resetFields(fields: readonly string[]) {
      const patch: Record<string, number> = {};
      for (const f of fields) patch[f] = DEFAULT_ADJUSTMENTS[f];
      setAdjustments(patch);
      history.clearFields(fields);
    },
    undo: () => restore(history.undo(), 'from'),
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

    // ---- layers (persisted separately by layerStorage, not undo-tracked) ----
    hydrateLayers(saved: EditorLayer[]) {
      const keep = saved.some((l) => l.id === get().selectedLayerId);
      set({ layers: saved, selectedLayerId: keep ? get().selectedLayerId : 'fundo' });
    },
    setLayers,
    selectLayer: (selectedLayerId: string) => set({ selectedLayerId }),
    /** Adds layers and selects the last one added. */
    addLayers(added: EditorLayer[]) {
      if (added.length === 0) return;
      set({ layers: [...get().layers, ...added], selectedLayerId: added[added.length - 1].id });
    },

    // ---- painting ----
    setBrush: (patch: Partial<Brush>) => set({ brush: { ...get().brush, ...patch } }),
    appendStrokePoint(x: number, y: number, pressure?: number) {
      if (pressure) pressures.push(pressure);
      set({ currentStroke: [...get().currentStroke, { x, y }] });
    },
    /** Ends the stroke: appended to the selected layer as one vector stroke (if it has 2+ points). */
    commitStroke() {
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
            l.id === selectedLayerId ? { ...l, strokes: [...(l.strokes ?? []), stroke] } : l
          )
        );
      }
      pressures = [];
      set({ currentStroke: [] });
    },
  };
}

export type PhotoEditorStore = ReturnType<typeof createPhotoEditorStore>;
