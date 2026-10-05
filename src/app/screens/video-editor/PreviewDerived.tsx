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
import * as VideoThumbnails from 'expo-video-thumbnails';
import { previousClipOf, topClipAt, type Clip, type Track } from '@modules/video-editor';
import { ClipVideo } from './ClipVideo';
import { useTime, type TimeStore } from './timeStore';

export interface TransitionBlend {
  progress: number;
  type: string;
  fromUri: string;
  fromTimeMs: number;
}

export interface PreviewDerivedState {
  currentClip: Clip | null;
  transitionBlend: TransitionBlend | null;
  previewFrameUri: string | null;
  fromFrameUri: string | null;
}

interface Derived {
  clip: Clip | null;
  blend: TransitionBlend | null;
}

/** Pure: what the preview shows at `timeMs` (clip under the playhead + transition blend). */
export function derivePreview(tracks: Track[], timeMs: number): Derived {
  const clip = topClipAt(tracks, timeMs);
  if (!clip?.transitionIn) return { clip, blend: null };
  const t = timeMs - clip.startMs;
  if (t < 0 || t > clip.transitionIn.durationMs) return { clip, blend: null };
  const track = tracks.find((tr) => tr.clips.some((c) => c.id === clip.id));
  const prev = track ? previousClipOf(track, clip) : null;
  if (!prev) return { clip, blend: null };
  return {
    clip,
    blend: {
      progress: t / clip.transitionIn.durationMs,
      type: clip.transitionIn.type,
      fromUri: prev.sourceUri,
      fromTimeMs: Math.max(0, prev.outPointMs - 40),
    },
  };
}

const sameDerived = (a: Derived, b: Derived) =>
  a.clip === b.clip &&
  (a.blend === b.blend ||
    (!!a.blend &&
      !!b.blend &&
      a.blend.progress === b.blend.progress &&
      a.blend.type === b.blend.type &&
      a.blend.fromUri === b.blend.fromUri &&
      a.blend.fromTimeMs === b.blend.fromTimeMs));

/** Source-file position of the playhead inside `clip`, in ms. */
export const sourceTimeAt = (clip: Clip, timeMs: number) =>
  clip.inPointMs + (timeMs - clip.startMs) * (clip.speed ?? 1);

/** The real video for `clip`: the only part of the preview that follows the continuous clock. */
export function LiveClipVideo({
  store,
  clip,
  ...rest
}: { store: TimeStore; clip: Clip } & Omit<
  ComponentProps<typeof ClipVideo>,
  'sourceTimeMs' | 'uri'
>) {
  const t = useTime(store);
  return <ClipVideo {...rest} uri={clip.sourceUri} sourceTimeMs={sourceTimeAt(clip, t)} />;
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
  clipRef: MutableRefObject<Clip | null> | null;
  children: (s: PreviewDerivedState) => ReactNode;
}) {
  const last = useRef<Derived | null>(null);
  const getSnapshot = useMemo(
    () => () => {
      const next = derivePreview(tracks, store.get());
      if (last.current && sameDerived(last.current, next)) return last.current;
      last.current = next;
      return next;
    },
    [tracks, store]
  );
  const { clip: currentClip, blend: transitionBlend } = useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    getSnapshot
  );
  if (clipRef) clipRef.current = currentClip;

  const [previewFrameUri, setPreviewFrameUri] = useState<string | null>(null);
  useEffect(() => {
    // While playing the real player draws the picture; extracting posters would only churn.
    if (playing) return;
    if (!currentClip) {
      setPreviewFrameUri(null);
      return;
    }
    let cancelled = false;
    // A frozen clip shows its held frame, not the moving playhead position.
    const posterTimeMs = currentClip.frozen
      ? currentClip.inPointMs
      : sourceTimeAt(currentClip, store.get());
    VideoThumbnails.getThumbnailAsync(currentClip.sourceUri, { time: posterTimeMs })
      .then((result) => {
        if (!cancelled) setPreviewFrameUri(result.uri);
      })
      .catch(() => {
        // Not a video (e.g. an image clip) — the raw source is already a displayable image.
        if (!cancelled) setPreviewFrameUri(currentClip.sourceUri);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClip?.id, currentClip?.sourceUri, playing]);

  const [fromFrameUri, setFromFrameUri] = useState<string | null>(null);
  const fromUri = transitionBlend?.fromUri;
  const fromTimeMs = transitionBlend?.fromTimeMs ?? 0;
  useEffect(() => {
    if (!fromUri) {
      setFromFrameUri(null);
      return;
    }
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(fromUri, { time: fromTimeMs })
      .then((result) => {
        if (!cancelled) setFromFrameUri(result.uri);
      })
      .catch(() => {
        if (!cancelled) setFromFrameUri(fromUri);
      });
    return () => {
      cancelled = true;
    };
  }, [fromUri, fromTimeMs]);

  return <>{children({ currentClip, transitionBlend, previewFrameUri, fromFrameUri })}</>;
}
