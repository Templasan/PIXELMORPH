import { buildComposition, compositionDurationMs } from '../domain/composition';
import {
  clipDurationMs,
  clipEndMs,
  createClip,
  createClipId,
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
import type { EditorHost, MediaItem, ProjectFormat } from '../ports/host';
import { frameSize } from '../domain/format';
import { exportComposition, type ExportOutcome } from '../engine/exporter';
import { createStore } from '../state/createStore';
import { createHistory } from './history';
import { createVideoEditorStore } from './videoEditorStore';
import { mainTrack, placeAtPlayhead } from './placement';
import { timelapseClips } from '../domain/timelapse';
import type { TransitionType } from '../domain/transitions';

/** Short edge of the preview canvas (the export renders the same composition at its own size). */
const PREVIEW_SHORT_EDGE = 720;
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
  return [
    makeTrack('v1', 'V1', 'video'),
    makeTrack('img', 'IMG', 'image'),
    makeTrack('txt', 'TXT', 'text'),
    makeTrack('a1', 'A1', 'audio'),
  ];
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
  const previews = new MediaPreviews(pool, () => playing.get());
  const format = createStore<ProjectFormat>('16:9');
  let player: Player | null = null;
  /** Diagnostics: set to [] to record every played frame (see tools/check in the dev console). */
  let trace: FrameInfo[] | null = null;

  // Preview copies (host-made proxies): original → copy; the export never uses them.
  let previewMap: Record<string, string> = {};
  const compose = (tracks: Track[]) =>
    buildComposition(tracks, {
      ...frameSize(format.get(), PREVIEW_SHORT_EDGE),
      mapUri: (u) => previewMap[u] ?? u,
    });
  const askPreviewSources = (tracks: Track[]) =>
    host.wantPreviewSources?.([
      ...new Set(
        tracks.filter((t) => t.kind === 'video').flatMap((t) => t.clips.map((c) => c.sourceUri))
      ),
    ]);
  /** How many video files the preview reads from a light copy (shown as a badge). */
  const previewCopies = createStore(0);
  host.onPreviewSources?.((map) => {
    previewMap = map;
    previewCopies.set(Object.keys(map).length);
    player?.setComposition(compose(editor.store.get().tracks));
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
      undoLog.restore(saved.history as Parameters<typeof undoLog.restore>[0]);
    }
    // A new project takes the shape of its first video (a phone video is usually 9:16).
    if (!saved?.format) {
      const first = editor.store.get().tracks.find((t) => t.kind === 'video')?.clips[0];
      if (first) {
        const p = await probeMedia(pool, first.sourceUri).catch(() => null);
        if (p && p.width && p.height) format.set(p.height > p.width ? '9:16' : p.width === p.height ? '1:1' : '16:9');
      }
    }
    loaded = true;
    askPreviewSources(editor.store.get().tracks);
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
        onFrame: (f) => trace?.push(f),
      },
      compose(editor.store.get().tracks)
    );
    player.seek(time.get());
  }

  function detach() {
    player?.dispose();
    player = null;
  }

  const durationMs = () => compositionDurationMs(editor.store.get().tracks);

  async function addMedia(item: MediaItem) {
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
        // Video goes at the end of the main track; pictures and sound where the playhead is.
        const { tracks, trackId } =
          kind === 'video' ? mainTrack(before) : placeAtPlayhead(before, kind, at, durationMs);
        const track = tracks.find((t) => t.id === trackId)!;
        const startMs =
          kind === 'video' ? track.clips.reduce((m, c) => Math.max(m, clipEndMs(c)), 0) : at;
        const clip = createClip({
          name: item.name,
          sourceUri: item.uri,
          color: KIND_COLORS[kind],
          startMs,
          sourceDurationMs,
        });
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
      });
      return tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, ...clips] } : t));
    });
  }

  function addText() {
    const at = time.get();
    const durationMs = 3000;
    let id = '';
    editor.commit((before) => {
      const { tracks, trackId } = placeAtPlayhead(before, 'text', at, durationMs);
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
  }

  function deleteSelected() {
    const { selectedClipId, tracks } = editor.store.get();
    const found = selectedClipId ? findClip(tracks, selectedClipId) : null;
    if (!found) return;
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
    if (!found) return;
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
    gif?: { fps: number; maxColors: number };
    onProgress: (pct: number) => void;
    isCancelled: () => boolean;
  }): Promise<ExportOutcome> {
    player?.pause();
    const comp = buildComposition(editor.store.get().tracks, opts.frame);
    try {
      return await exportComposition(pool, {
        comp,
        bitrate: opts.bitrate,
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
    startTrace: () => (trace = []),
    stopTrace: () => {
      const t = trace ?? [];
      trace = null;
      return t;
    },
    exportVideo,
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
    seek: (ms: number) => player?.seek(ms),
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
