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
import { previousClipOf, topClipAt, type Clip, type Track } from '@modules/video-editor';
import { useStore } from '@core/state';
import { ClipVideo } from './ClipVideo';
import { useTime, type TimeStore } from './timeStore';
import { proxyStore } from './previewProxy';

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

/** What the live preview decodes for `sourceUri`: its 720p proxy once ready, else the original. */
export function useProxyUri(sourceUri: string | undefined): string | undefined {
  const readyUri = useStore(proxyStore, (s) =>
    sourceUri && s[sourceUri]?.status === 'ready' ? s[sourceUri].uri : undefined
  );
  return readyUri ?? sourceUri;
}

/** Posters are shown in the preview box; the 720p preview copy is already this wide. */
const POSTER_MAX_WIDTH = 1280;

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
  const uri = useProxyUri(clip.sourceUri) ?? clip.sourceUri;
  return <ClipVideo {...rest} uri={uri} sourceTimeMs={sourceTimeAt(clip, t)} />;
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
  const posterUri = useProxyUri(currentClip?.sourceUri);
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
    // Exact frame (expo-video-thumbnails, now deprecated, snapped to keyframes on Android).
    extractFrame(posterUri ?? currentClip.sourceUri, posterTimeMs, POSTER_MAX_WIDTH)
      .then((result) => {
        if (!cancelled) setPreviewFrameUri(result.uri);
      })
      .catch(() => {
        // Not a video (e.g. an image clip) — the raw source is already a displayable image.
        if (!cancelled) setPreviewFrameUri(posterUri ?? currentClip.sourceUri);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClip?.id, currentClip?.sourceUri, posterUri, playing]);

  const [fromFrameUri, setFromFrameUri] = useState<string | null>(null);
  const fromUri = transitionBlend?.fromUri;
  const fromPlayUri = useProxyUri(fromUri);
  const fromTimeMs = transitionBlend?.fromTimeMs ?? 0;
  useEffect(() => {
    if (!fromUri) {
      setFromFrameUri(null);
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
  }, [fromUri, fromPlayUri, fromTimeMs]);

  return <>{children({ currentClip, transitionBlend, previewFrameUri, fromFrameUri })}</>;
}
