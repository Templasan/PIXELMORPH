import { buildComposition, compositionDurationMs } from '../domain/composition';
import { setStabilization,
  clipDurationMs,
  clipEndMs,
  createClip,
  createClipId,
  clipMedia,
  type Clip,
  type Track,
} from '../domain/Track';
import { findClip, removeClip, rippleDelete } from '../domain/timeline';
import { DEFAULT_TEXT } from '../domain/textCaption';
import { MediaPool } from '../engine/media';
import { t } from '../i18n';
import { Player, type FrameInfo } from '../engine/player';
import { MediaPreviews } from '../engine/previews';
import { probeMedia } from '../engine/probe';
import type { EditorHost, MediaItem, ProjectFormat, SpeechProgress } from '../ports/host';
import { captionClips } from './speechCaptions';
import { trackFaces } from '../domain/faceTrack';
import { scrubBudget } from '../domain/scrubPlan';
import { ScrubFrames } from '../engine/scrubFrames';
import { isLowEndDevice, previewShortEdge, speechMinutesOn } from '../domain/deviceClass';
import { correctionsOf, type MotionSample } from '../domain/stabilize';
import { motionPathOf, setMotionPath } from '../engine/motion';

const BACKGROUND_WAITS_AFTER_JUMP_MS = 1500;
const FACE_STEP_MS = 500;
const FACE_MAX_SAMPLES = 240;
import { frameSize } from '../domain/format';
import { exportComposition, type ExportOutcome } from '../engine/exporter';
import { createStore } from '../state/createStore';
import { createHistory } from './history';
import { createVideoEditorStore } from './videoEditorStore';
import { freeStart, mainTrack, newLayer, placeAtPlayhead } from './placement';
import { timelapseClips } from '../domain/timelapse';
import type { TransitionType } from '../domain/transitions';

/** Short edge of the preview canvas (the export renders the same composition at its own size). */
/** Not in every browser, and the app's WebView reports it rounded. */
const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
const SAVE_DEBOUNCE_MS = 400;

const KIND_COLORS: Record<Track['kind'], string> = {
  video: '#3A8FDE',
  image: '#5FB98F',
  text: '#D2A05E',
  audio: '#9B6FD6',
};

export function defaultTracks(): Track[] {
  const makeTrack = (id: string, name: string, kind: Track['kind']): Track => ({
    id,
    name,
    kind,
    visible: true,
    locked: false,
    clips: [],
  });
  return [makeTrack('v1', 'V1', 'video'), makeTrack('a1', 'A1', 'audio')];
}

/**
 * One editing session: the timeline store with undo, the player (the playhead's only owner) and
 * the host's services. The UI reads stores and calls these methods; nothing else moves time.
 */
export function createEditorSession(host: EditorHost) {
  const undoLog = createHistory();
  const { history, state: historyState } = undoLog;
  const editor = createVideoEditorStore(history, { tracks: defaultTracks() });
  const pool = new MediaPool(host.fileReader, host.streamAboveBytes);
  const time = createStore(0);
  const playing = createStore(false);
  const error = createStore<string | null>(null);
  const busy = createStore<string | null>(null);
  const projectName = createStore('Projeto sem nome');
  // Timeline thumbnails and waveforms wait while the preview plays (its decoders come first).
  // Background decoding waits while the person plays or moves the playhead: their frames come first.
  let lastJumpAt = 0;
  const previewBusy = () => playing.get() || performance.now() - lastJumpAt < BACKGROUND_WAITS_AFTER_JUMP_MS;
  const previews = new MediaPreviews(pool, previewBusy);
  const scrubFrames = new ScrubFrames(pool, previewBusy, scrubBudget(isLowEndDevice(deviceMemory)));
  const format = createStore<ProjectFormat>('16:9');
  /** Video layers holding their frame while playing (see liveLayerKeys). */
  const frozenLayers = createStore(0);
  /** Counts drawn frames: what the preview's handles follow. */
  const drawn = createStore(0);
  let player: Player | null = null;
  /** Diagnostics: set to [] to record every played frame (see tools/check in the dev console). */
  let trace: FrameInfo[] | null = null;

  // Preview copies (host-made proxies): original → copy; the export never uses them.
  let previewMap: Record<string, string> = {};
  const compose = (tracks: Track[]) =>
    buildComposition(tracks, {
      ...frameSize(format.get(), previewShortEdge(deviceMemory)),
      mapUri: (u) => previewMap[u] ?? u,
    });
  const askPreviewSources = (tracks: Track[]) =>
    host.wantPreviewSources?.(
      [...new Set(tracks.flatMap((t) => t.clips.filter((c) => clipMedia(t, c) === 'video').map((c) => c.sourceUri)))],
      isLowEndDevice(deviceMemory)
    );
  /** The files the preview shows: original or its light copy, whichever it reads now. */
  const wantScrubFrames = (tracks: Track[]) =>
    scrubFrames.want([
      ...new Set(
        tracks.flatMap((t) => t.clips.filter((c) => clipMedia(t, c) === 'video' && !c.frozen).map((c) => previewMap[c.sourceUri] ?? c.sourceUri))
      ),
    ]);
  /** How many video files the preview reads from a light copy (shown as a badge). */
  const previewCopies = createStore(0);
  host.onPreviewSources?.((map) => {
    previewMap = map;
    previewCopies.set(Object.keys(map).length);
    player?.setComposition(compose(editor.store.get().tracks));
    wantScrubFrames(editor.store.get().tracks);
  });
  // Nothing is saved until the project has loaded: a save in between wrote an empty timeline.
  let loaded = false;
  const save = () =>
    loaded
      ? host.saveProject({
          name: projectName.get(),
          tracks: editor.store.get().tracks,
          format: format.get(),
          history: undoLog.snapshot(),
        })
      : Promise.resolve();
  format.subscribe(() => {
    player?.setComposition(compose(editor.store.get().tracks));
    void save();
  });

  let lastTracks = editor.store.get().tracks;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  editor.store.subscribe(() => {
    const { tracks } = editor.store.get();
    if (tracks === lastTracks) return;
    lastTracks = tracks;
    askPreviewSources(tracks);
    wantScrubFrames(tracks);
    player?.setComposition(compose(tracks));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
  });

  async function load() {
    const saved = await host.loadProject();
    if (saved) {
      projectName.set(saved.name);
      if (saved.format) format.set(saved.format);
      editor.hydrate(saved.tracks);
      for (const clip of saved.tracks.flatMap((track) => track.clips)) {
        if (clip.stabilization) await loadMotion(clip.sourceUri);
      }
      undoLog.restore(saved.history as Parameters<typeof undoLog.restore>[0]);
    }
    // A new project takes the shape of its first video (a phone video is usually 9:16).
    if (!saved?.format) {
      const first = editor.store
        .get()
        .tracks.flatMap((t) => t.clips.filter((c) => clipMedia(t, c) === 'video'))[0];
      if (first) {
        const p = await probeMedia(pool, first.sourceUri).catch(() => null);
        if (p && p.width && p.height) format.set(p.height > p.width ? '9:16' : p.width === p.height ? '1:1' : '16:9');
      }
    }
    loaded = true;
    askPreviewSources(editor.store.get().tracks);
    wantScrubFrames(editor.store.get().tracks);
  }

  function attach(canvas: HTMLCanvasElement) {
    player?.dispose();
    player = new Player(
      canvas,
      pool,
      {
        onTime: (ms) => time.set(ms),
        onPlaying: (p) => playing.set(p),
        onError: (m) => error.set(m),
        onDrawn: () => drawn.set(drawn.get() + 1),
        onFrozenLayers: (count) => frozenLayers.set(count),
        onFrame: (f) => trace?.push(f),
      },
      compose(editor.store.get().tracks)
    );
    player.scrub = scrubFrames;
    player.seek(time.get());
  }

  function detach() {
    player?.dispose();
    player = null;
  }

  const durationMs = () => compositionDurationMs(editor.store.get().tracks);

  /**
   * Adds a file. With `stack` it goes at the playhead on a new track on top of everything. On the
   * active track it goes at the playhead (or the first room after it). Otherwise a video follows
   * the end of the main track, and pictures and sound go where the playhead is.
   */
  async function addMedia(item: MediaItem, stack = false) {
    busy.set(t('Abrindo {name}…', { name: item.name }));
    try {
      const kind: Track['kind'] = item.kind;
      let durationMs = 5000; // a picture's default length
      let sourceDurationMs = durationMs;
      if (item.kind !== 'image') {
        const probed = await probeMedia(pool, item.uri);
        durationMs = sourceDurationMs = probed.durationMs;
      }
      const at = time.get();
      editor.commit((before) => {
        const active = before.find((t) => t.id === editor.store.get().activeTrackId && !t.locked);
        const useActive = !!active && (active.kind === 'audio') === (kind === 'audio');
        const { tracks, trackId } = stack
          ? newLayer(before)
          : useActive
            ? { tracks: before, trackId: active.id }
            : kind === 'video'
              ? mainTrack(before)
              : placeAtPlayhead(before, kind, at, durationMs);
        const track = tracks.find((t) => t.id === trackId)!;
        const startMs =
          stack || useActive
            ? freeStart(track, at, durationMs)
            : kind === 'video'
              ? track.clips.reduce((m, c) => Math.max(m, clipEndMs(c)), 0)
              : at;
        const clip: Clip = {
          ...createClip({
            name: item.name,
            sourceUri: item.uri,
            color: KIND_COLORS[kind],
            startMs,
            sourceDurationMs,
          }),
          image: kind === 'image',
        };
        return tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t));
      });
    } catch (e) {
      error.set(t('Não foi possível abrir {name}: {msg}', { name: item.name, msg: String((e as Error)?.message ?? e) }));
    } finally {
      busy.set(null);
    }
  }

  /** RF-023: photos in order as consecutive picture clips at the playhead, one undo step. */
  function addTimelapse(photos: MediaItem[], opts: { secondsPerPhoto: number; transition?: TransitionType }) {
    if (photos.length === 0) return;
    const at = time.get();
    const stepMs = Math.round(opts.secondsPerPhoto * 1000);
    editor.commit((before) => {
      const { tracks, trackId } = placeAtPlayhead(before, 'image', at, photos.length * stepMs);
      const clips = timelapseClips(photos, {
        startMs: at,
        stepMs,
        color: KIND_COLORS.image,
        transition: opts.transition,
      }).map((c) => ({ ...c, image: true }));
      return tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, ...clips] } : t));
    });
  }

  function addText(stack = false) {
    const at = time.get();
    const durationMs = 3000;
    let id = '';
    editor.commit((before) => {
      const { tracks, trackId } = stack ? newLayer(before) : placeAtPlayhead(before, 'text', at, durationMs);
      const clip: Clip = {
        ...createClip({
          name: t('Texto'),
          sourceUri: '',
          color: KIND_COLORS.text,
          startMs: at,
          sourceDurationMs: durationMs,
        }),
        text: { ...DEFAULT_TEXT, content: t('Texto') },
      };
      id = clip.id;
      return tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t));
    });
    editor.store.set((s) => ({ ...s, selectedClipId: id }));
    // Past its fade-in, or the new text is invisible where it was just added.
    player?.seek(at + DEFAULT_TEXT.animIn.ms);
  }

  /** RF-069: what is said in a clip becomes text clips on a new layer, undone in one step. */
  async function generateCaptions(clipId: string, onProgress: (p: SpeechProgress) => void): Promise<number> {
    const found = findClip(editor.store.get().tracks, clipId);
    if (!found || !host.transcribeSpeech) throw new Error('FAILED');
    const { clip } = found;
    const segments = await host.transcribeSpeech(clip.sourceUri, clip.inPointMs, clip.outPointMs, onProgress);
    const captions = captionClips(segments, clip, KIND_COLORS.text);
    if (captions.length === 0) return 0;
    editor.commit((before) => {
      const { tracks, trackId } = newLayer(before);
      return tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, ...captions] } : t));
    });
    return captions.length;
  }

  /** RF-009: reads and works out a recording's correction, once. False when it has no motion. */
  async function loadMotion(uri: string): Promise<boolean> {
    if (motionPathOf(uri)) return true;
    const saved = await host.readMotion?.(uri).catch(() => null);
    if (!saved) return false;
    let samples: MotionSample[];
    try {
      samples = JSON.parse(saved) as MotionSample[];
    } catch {
      return false;
    }
    const path = correctionsOf(samples);
    if (path.length === 0) return false;
    setMotionPath(uri, path);
    return true;
  }

  /** RF-009: on and off at any time after recording; the file itself never changes. */
  async function setClipSteady(clipId: string, on: boolean) {
    const found = findClip(editor.store.get().tracks, clipId);
    if (!found) return;
    if (on && !(await loadMotion(found.clip.sourceUri))) {
      error.set(t('Este vídeo não tem dados de movimento: só os gravados na câmera do app, em aparelho com giroscópio, têm.'));
      return;
    }
    editor.commit((before) =>
      before.map((track) => ({ ...track, clips: track.clips.map((c) => (c.id === clipId ? setStabilization(c, on) : c)) }))
    );
  }

  /** RF-016: finds and follows the faces in a clip. Their settings are then the clip's own. */
  async function findClipFaces(clipId: string, onProgress: (percent: number) => void): Promise<number> {
    const found = findClip(editor.store.get().tracks, clipId);
    if (!found || !host.sampleFaces) throw new Error('FAILED');
    const { clip } = found;
    // A long clip is sampled more thinly, so the search keeps to about a minute's work.
    const stepMs = Math.max(FACE_STEP_MS, (clip.outPointMs - clip.inPointMs) / FACE_MAX_SAMPLES);
    const samples = await host.sampleFaces(clip.sourceUri, clip.inPointMs, clip.outPointMs, stepMs, onProgress);
    const faces = trackFaces(samples, stepMs);
    if (faces.length) {
      editor.commit((before) =>
        before.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, faces } : c)) }))
      );
    }
    return faces.length;
  }

  function deleteSelected() {
    const { selectedClipId, tracks } = editor.store.get();
    const found = selectedClipId ? findClip(tracks, selectedClipId) : null;
    if (!found || found.track.locked) return;
    const ripple = editor.store.get().rippleMode;
    editor.commit((t) =>
      ripple
        ? rippleDelete(t, found.track.id, found.clip.id)
        : removeClip(t, found.track.id, found.clip.id)
    );
    editor.clearSelection();
  }

  /** A copy right after the selected clip (or the first free spot after it) on the same track. */
  function duplicateSelected() {
    const { selectedClipId, tracks } = editor.store.get();
    const found = selectedClipId ? findClip(tracks, selectedClipId) : null;
    if (!found || found.track.locked) return;
    // Right after the original; the clips after it on the track make room (the copy is inserted).
    const end = clipEndMs(found.clip);
    const length = clipDurationMs(found.clip);
    const copy: Clip = { ...found.clip, id: createClipId(), startMs: end, transitionIn: undefined };
    editor.commit((t) =>
      t.map((tr) =>
        tr.id === found.track.id
          ? {
              ...tr,
              clips: [
                ...tr.clips.map((c) =>
                  c.startMs >= end - 1e-6 ? { ...c, startMs: c.startMs + length } : c
                ),
                copy,
              ],
            }
          : tr
      )
    );
    editor.store.set((s) => ({ ...s, selectedClipId: copy.id }));
  }

  /** Renders the timeline into a file through the host (mp4, or a GIF when `gif` is set). */
  async function exportVideo(opts: {
    /** The output frame: the project's shape at a short edge, or a social preset's own size. */
    frame: { width: number; height: number; cover: boolean };
    bitrate: number;
    /** RNF-013: lower the mp4 bitrate for a simple clip. */
    adaptive?: boolean;
    spherical?: boolean;
    gif?: { fps: number; maxColors: number; highlights?: boolean };
    onProgress: (pct: number) => void;
    isCancelled: () => boolean;
  }): Promise<ExportOutcome> {
    player?.pause();
    const comp = buildComposition(editor.store.get().tracks, opts.frame);
    try {
      return await exportComposition(pool, {
        comp,
        bitrate: opts.bitrate,
        adaptive: opts.adaptive,
        spherical: opts.spherical,
        gif: opts.gif,
        sink: host.exportSink(),
        onProgress: opts.onProgress,
        isCancelled: opts.isCancelled,
      });
    } finally {
      player?.setComposition(compose(editor.store.get().tracks));
    }
  }

  return {
    host,
    previews,
    previewCopies,
    format,
    drawn,
    frozenLayers,
    /** Where a clip was last drawn, in frame pixels. */
    boxOf: (clipId: string) => player?.boxes.get(clipId) ?? null,
    startTrace: () => (trace = []),
    stopTrace: () => {
      const t = trace ?? [];
      trace = null;
      return t;
    },
    exportVideo,
    scrubFrames,
    generateCaptions,
    findClipFaces,
    setClipSteady,
    canFindFaces: !!host.sampleFaces,
    cancelFaces: () => host.cancelFaces?.(),
    speechModelReady: () => host.speechModelReady?.() ?? Promise.resolve(null),
    /** RF-069: minutes to expect here, on a phone slow enough to warn about. */
    speechMinutes(clipId: string) {
      const found = findClip(editor.store.get().tracks, clipId);
      return found ? speechMinutesOn(deviceMemory, found.clip.outPointMs - found.clip.inPointMs) : null;
    },
    cancelSpeech: () => host.cancelSpeech?.(),
    duplicateSelected,
    editor,
    historyState,
    time,
    playing,
    error,
    busy,
    projectName,
    load,
    attach,
    detach,
    durationMs,
    play: () => void player?.play(),
    pause: () => player?.pause(),
    toggle: () => player?.toggle(),
    seek: (ms: number) => {
      lastJumpAt = performance.now();
      player?.seek(ms);
    },
    seekAndWait: (ms: number) => player?.seekAndWait(ms) ?? Promise.resolve(),
    /** Diagnostics: what a media file is, as the editor reads it. */
    probe: (uri: string) => probeMedia(pool, uri),
    addMedia,
    addTimelapse,
    addText,
    deleteSelected,
    colorOf: (kind: Track['kind']) => KIND_COLORS[kind],
  };
}

export type EditorSession = ReturnType<typeof createEditorSession>;
