import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { extractFrame } from '../../../../modules/pixelmorph-video-export/src';
import {
  frameAt,
  planSequence,
  sourceTimeIn,
  type Clip,
  type Frame,
  type PlannedClip,
  type SequencePlan,
  type Track,
} from '@modules/video-editor';
import { useStore } from '@core/state';
import { ClipVideo } from './ClipVideo';
import { useTime, type TimeStore } from './timeStore';
import { proxyStore } from './previewProxy';

/** The outgoing clip's frozen frame, laid over the incoming clip (as the export does). */
export interface TransitionBlend {
  progress: number;
  type: string;
  mode: 'out' | 'in';
  fromUri: string;
  fromTimeMs: number;
  fromRotation: number;
  /** The outgoing source is a picture: show the file itself. */
  fromImage: boolean;
}

export interface PreviewDerivedState {
  /** What the finished video shows right now (null: nothing, e.g. past the end). */
  frame: Frame | null;
  /** The editor clip behind `frame` (for per-clip looks such as colour correction). */
  currentClip: Clip | null;
  transitionBlend: TransitionBlend | null;
  previewFrameUri: string | null;
  fromFrameUri: string | null;
}

/** Pure: what the preview shows at `timeMs`, from the same plan the export is built from. */
export function derivePreview(plan: SequencePlan, timeMs: number): Frame | null {
  return frameAt(plan, timeMs);
}

const sameFrame = (a: Frame | null, b: Frame | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.piece === b.piece &&
    (a.transition === b.transition ||
      (!!a.transition &&
        !!b.transition &&
        a.transition.progress === b.transition.progress &&
        a.transition.type === b.transition.type &&
        a.transition.mode === b.transition.mode &&
        a.transition.from === b.transition.from)));

const blendOf = (frame: Frame | null): TransitionBlend | null =>
  frame?.transition
    ? {
        progress: frame.transition.progress,
        type: frame.transition.type,
        mode: frame.transition.mode,
        fromUri: frame.transition.from.sourceUri,
        fromTimeMs: frame.transition.from.timeMs,
        fromRotation: frame.transition.from.rotation,
        fromImage: frame.transition.from.image,
      }
    : null;

/** What the live preview decodes for `sourceUri`: its 720p proxy once ready, else the original. */
export function useProxyUri(sourceUri: string | undefined): string | undefined {
  const readyUri = useStore(proxyStore, (s) =>
    sourceUri && s[sourceUri]?.status === 'ready' ? s[sourceUri].uri : undefined
  );
  return readyUri ?? sourceUri;
}

/** Posters are shown in the preview box; the 720p preview copy is already this wide. */
const POSTER_MAX_WIDTH = 1280;

/** The real video for `piece`: the only part of the preview that follows the continuous clock. */
export function LiveClipVideo({
  store,
  piece,
  ...rest
}: { store: TimeStore; piece: PlannedClip } & Omit<
  ComponentProps<typeof ClipVideo>,
  'sourceTimeMs' | 'uri'
>) {
  const t = useTime(store);
  const uri = useProxyUri(piece.sourceUri) ?? piece.sourceUri;
  return <ClipVideo {...rest} uri={uri} sourceTimeMs={sourceTimeIn(piece, t)} />;
}

/**
 * Everything the preview derives from the playhead (clip under it, transition blend, poster
 * frames). Re-renders only when that discrete state changes (clip switch, transition progress),
 * not on every clock tick; the continuous source time goes straight to LiveClipVideo.
 */
export function PreviewDerived({
  store,
  tracks,
  playing,
  clipRef,
  children,
}: {
  store: TimeStore;
  tracks: Track[];
  playing: boolean;
  /** Mirrors the clip under the playhead for the parent's clock (pass null to skip). */
  clipRef: MutableRefObject<Frame | null> | null;
  children: (s: PreviewDerivedState) => ReactNode;
}) {
  const plan = useMemo(() => planSequence(tracks), [tracks]);
  const last = useRef<Frame | null>(null);
  const getSnapshot = useMemo(
    () => () => {
      const next = derivePreview(plan, store.get());
      if (sameFrame(last.current, next)) return last.current;
      last.current = next;
      return next;
    },
    [plan, store]
  );
  const frame = useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  if (clipRef) clipRef.current = frame;
  const piece = frame?.piece ?? null;
  const currentClip = useMemo(
    () =>
      piece ? (tracks.flatMap((t) => t.clips).find((c) => c.id === piece.clipId) ?? null) : null,
    [tracks, piece]
  );
  const transitionBlend = useMemo(() => blendOf(frame), [frame]);

  const [previewFrameUri, setPreviewFrameUri] = useState<string | null>(null);
  const posterUri = useProxyUri(piece?.sourceUri);
  useEffect(() => {
    // While playing the real player draws the picture; extracting posters would only churn.
    if (playing) return;
    if (!piece || piece.kind === 'gap') {
      setPreviewFrameUri(null);
      return;
    }
    let cancelled = false;
    // A frozen clip shows its held frame, not the moving playhead position.
    const posterTimeMs = frameAt(plan, store.get())?.sourceTimeMs ?? 0;
    // Exact frame (expo-video-thumbnails, now deprecated, snapped to keyframes on Android).
    extractFrame(posterUri ?? piece.sourceUri, posterTimeMs, POSTER_MAX_WIDTH)
      .then((result) => {
        if (!cancelled) setPreviewFrameUri(result.uri);
      })
      .catch(() => {
        // Not a video (e.g. an image clip) — the raw source is already a displayable image.
        if (!cancelled) setPreviewFrameUri(posterUri ?? piece.sourceUri);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece?.clipId, piece?.startMs, piece?.sourceUri, posterUri, playing]);

  const [fromFrameUri, setFromFrameUri] = useState<string | null>(null);
  const fromUri = transitionBlend?.fromUri;
  const fromPlayUri = useProxyUri(fromUri);
  const fromTimeMs = transitionBlend?.fromTimeMs ?? 0;
  const fromImage = transitionBlend?.fromImage ?? false;
  useEffect(() => {
    if (!fromUri || fromImage) {
      setFromFrameUri(null); // a picture is shown as is
      return;
    }
    let cancelled = false;
    extractFrame(fromPlayUri ?? fromUri, fromTimeMs, POSTER_MAX_WIDTH)
      .then((result) => {
        if (!cancelled) setFromFrameUri(result.uri);
      })
      .catch(() => {
        if (!cancelled) setFromFrameUri(fromPlayUri ?? fromUri);
      });
    return () => {
      cancelled = true;
    };
  }, [fromUri, fromPlayUri, fromTimeMs, fromImage]);

  return <>{children({ frame, currentClip, transitionBlend, previewFrameUri, fromFrameUri })}</>;
}
