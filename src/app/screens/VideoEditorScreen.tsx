import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, ExportSheet, Slider, Switch } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { usePersistedHistory } from '@core/history';
import { createProjectsModule, type Project } from '@modules/projects';
import { errorLogger } from '@core/reliability';
import {
  type Track,
  type Clip,
  createClip,
  clipDurationMs,
  clipEndMs,
  moveClip,
  trimClipIn,
  trimClipOut,
  splitClipAtMs,
  appendClip,
  findClip,
  rippleShiftAfter,
  timelineDurationMs,
  DEFAULT_FPS,
  stepFrameMs,
  formatTimecode,
  TRANSITION_TYPES,
  TRANSITION_LABELS,
  DEFAULT_TRANSITION_MS,
  clampTransitionDurationMs,
  setTransition,
  previousClipOf,
  insertFreezeFrame,
  buildTimelapseTrack,
  clampFadeMs,
  setPipTransform,
} from '@modules/video-editor';
import { AddClipSheet, type AddClipResult } from './video-editor/AddClipSheet';
import { pickMultipleImagesFromGallery } from '@modules/device-media';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoEditor'>;

const TRACK_HEADER_WIDTH = 72;
const ONE_FRAME_MS = 1000 / DEFAULT_FPS;
const PLACEHOLDER_URI =
  'https://images.unsplash.com/photo-1504700610630-ac6aba3536d3?w=780&h=440&fit=crop&auto=format';
const TRACK_COLORS: Record<Track['kind'], string> = {
  video: '#152C44',
  image: '#1E3A5C',
  text: '#1E1E40',
  audio: '#122A1E',
};

const TOOLBAR_ITEMS = [
  { icon: 'crop', label: 'Cortar', action: 'cut' },
  { icon: 'zap', label: 'Dividir', action: 'split' },
  { icon: 'flash', label: 'Congelar', action: 'freeze' },
  { icon: 'ripple', label: 'Ripple', action: 'ripple' },
  { icon: 'image', label: 'Time-lapse', action: 'timelapse' },
] as const;

const CLIP_TABS = [
  'Aparar',
  'Quadro',
  'Transição',
  'Velocidade',
  'Correção',
  'Áudio',
  'Sobreposição',
] as const;
/** RF-049: câmera lenta (<1) até aceleração (>1) — quick presets alongside the continuous slider. */
const SPEED_PRESETS = [0.25, 0.5, 1, 2, 4] as const;
type ClipTab = (typeof CLIP_TABS)[number];

/** US-14: seeds a real starting timeline from the open project's own asset (real durationMs). */
function buildInitialTracks(project: Project | null): Track[] {
  const asset = project?.assets[0];
  const uri = project?.thumbnailUri ?? asset?.originalUri ?? PLACEHOLDER_URI;
  const sourceDurationMs = asset?.metadata.durationMs ?? 10000;
  const v1: Track = {
    id: 'v1',
    name: 'V1',
    kind: 'video',
    visible: true,
    locked: false,
    clips: [
      createClip({
        name: project?.name ?? 'Clipe principal',
        sourceUri: uri,
        color: TRACK_COLORS.video,
        startMs: 0,
        sourceDurationMs,
      }),
    ],
  };
  const txt: Track = {
    id: 'txt',
    name: 'TXT',
    kind: 'text',
    visible: true,
    locked: false,
    clips: [],
  };
  const a1: Track = {
    id: 'a1',
    name: 'A1',
    kind: 'audio',
    visible: true,
    locked: false,
    clips: [],
  };
  return [v1, txt, a1];
}

interface ClipBlockProps {
  clip: Clip;
  track: Track;
  leftPct: number;
  widthPct: number;
  isSelected: boolean;
  msPerPx: number;
  onSelect: () => void;
  onBeginDrag: () => void;
  onMove: (deltaMs: number) => void;
  onTrimIn: (deltaMs: number) => void;
  onTrimOut: (deltaMs: number) => void;
  onEndDrag: () => void;
}

/** One draggable, trimmable clip block (RF-005 move, RF-035 frame-precise trim handles). */
function ClipBlock({
  clip,
  track,
  leftPct,
  widthPct,
  isSelected,
  msPerPx,
  onSelect,
  onBeginDrag,
  onMove,
  onTrimIn,
  onTrimOut,
  onEndDrag,
}: ClipBlockProps) {
  // minDistance lets a plain tap (near-zero movement) fall through to the Pressable's
  // onPress below instead of being claimed by this Pan the instant the touch lands.
  const moveGesture = Gesture.Pan()
    .minDistance(10)
    .enabled(!track.locked)
    .onBegin(() => runOnJS(onBeginDrag)())
    .onUpdate((e) => runOnJS(onMove)(e.translationX * msPerPx))
    .onEnd(() => runOnJS(onEndDrag)());

  const trimInGesture = Gesture.Pan()
    .minDistance(4)
    .enabled(!track.locked && !clip.frozen)
    .onBegin(() => runOnJS(onBeginDrag)())
    .onUpdate((e) => runOnJS(onTrimIn)(e.translationX * msPerPx))
    .onEnd(() => runOnJS(onEndDrag)());

  const trimOutGesture = Gesture.Pan()
    .minDistance(4)
    .enabled(!track.locked && !clip.frozen)
    .onBegin(() => runOnJS(onBeginDrag)())
    .onUpdate((e) => runOnJS(onTrimOut)(e.translationX * msPerPx))
    .onEnd(() => runOnJS(onEndDrag)());

  return (
    <GestureDetector gesture={moveGesture}>
      <Pressable
        onPress={onSelect}
        style={[
          styles.clip,
          { left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: clip.color },
          isSelected && styles.clipSelected,
          clip.frozen && styles.clipFrozen,
        ]}
      >
        <Text style={styles.clipName} numberOfLines={1}>
          {clip.frozen ? '❄ ' : ''}
          {clip.name}
        </Text>
        {track.kind === 'audio' && (
          <View style={styles.waveform}>
            {Array.from({ length: 40 }).map((_, j) => (
              <View
                key={j}
                style={[styles.waveformBar, { height: `${30 + Math.sin(j * 0.7) * 65}%` }]}
              />
            ))}
          </View>
        )}
        {clip.transitionIn && (
          <View style={styles.transitionMarker}>
            <Icon name="zap" size={9} color={colors.acento} />
          </View>
        )}
        {isSelected && !clip.frozen && !track.locked && (
          <>
            <GestureDetector gesture={trimInGesture}>
              <View style={styles.trimHandleLeft} />
            </GestureDetector>
            <GestureDetector gesture={trimOutGesture}>
              <View style={styles.trimHandleRight} />
            </GestureDetector>
          </>
        )}
      </Pressable>
    </GestureDetector>
  );
}

export default function VideoEditorScreen({ navigation, route }: Props) {
  const projectId = route.params?.projectId;
  const sessionId = projectId ?? 'unsaved-video-session';
  const history = usePersistedHistory(sessionId);

  const [project, setProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('Novo projeto');
  const [tracks, setTracks] = useState<Track[]>(() => buildInitialTracks(null));
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const [exportOpen, setExportOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [timelineZoom, setTimelineZoom] = useState(50);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [clipTab, setClipTab] = useState<ClipTab>('Aparar');
  const [loopReview, setLoopReview] = useState(false);
  const [bodyWidth, setBodyWidth] = useState(0);
  const [previewRatio, setPreviewRatio] = useState(0.34);
  const [contentHeight, setContentHeight] = useState(1);
  const [addClipTrackId, setAddClipTrackId] = useState<string | null>(null);
  const [rippleMode, setRippleMode] = useState(false);
  const [freezeHoldMs, setFreezeHoldMs] = useState(2000);
  const [pipClipId, setPipClipId] = useState<string | null>(null);
  const [pipX, setPipX] = useState(0.7);
  const [pipY, setPipY] = useState(0.7);
  const [pipWidth, setPipWidth] = useState(0.3);
  const [pipHeight, setPipHeight] = useState(0.3);

  useEffect(() => {
    if (!projectId) return;
    const { getProject } = createProjectsModule();
    getProject
      .execute(projectId)
      .then((p) => {
        if (p) {
          setProject(p);
          setProjectName(p.name);
        }
      })
      .catch((error) => errorLogger.log(error, 'VideoEditorScreen.getProject'));
  }, [projectId]);

  const initialTracks = useMemo(() => buildInitialTracks(project), [project]);

  // RF-027: once the log loads, replay it over the real project's seeded tracks so reopening
  // this project shows the same edit — the whole timeline is tracked as a single history field.
  useEffect(() => {
    if (!history.ready) return;
    const state = history.reconstructState({ tracks: initialTracks } as unknown as Record<
      string,
      unknown
    >);
    setTracks(state.tracks as Track[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.ready, initialTracks]);

  const commitTracks = useCallback(
    (before: Track[], after: Track[]) => {
      if (before === after) return;
      tracksRef.current = after;
      setTracks(after);
      history.push('tracks', before, after);
    },
    [history]
  );

  const handleUndo = useCallback(() => {
    const op = history.undo();
    if (op && op.type === 'tracks') {
      const from = op.params.from as Track[];
      tracksRef.current = from;
      setTracks(from);
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const op = history.redo();
    if (op && op.type === 'tracks') {
      const to = op.params.to as Track[];
      tracksRef.current = to;
      setTracks(to);
    }
  }, [history]);

  const totalDurationMs = Math.max(1000, timelineDurationMs(tracks));
  const msPerPx = bodyWidth > 0 ? totalDurationMs / bodyWidth : 0;
  const playheadPct = (currentTimeMs / totalDurationMs) * 100;

  // A real (if approximated) playhead — this app has no video decoder installed, so play
  // advances elapsed time and swaps the poster image per clip rather than decoding frames.
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setCurrentTimeMs((t) => {
        const next = t + 100;
        if (next >= totalDurationMs) {
          if (loopReview) return 0;
          setPlaying(false);
          return totalDurationMs;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [playing, totalDurationMs, loopReview]);

  const onBodyLayout = useCallback((e: LayoutChangeEvent) => {
    setBodyWidth(e.nativeEvent.layout.width - TRACK_HEADER_WIDTH);
  }, []);

  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    setContentHeight(Math.max(1, e.nativeEvent.layout.height));
  }, []);

  const updateTimeFromX = useCallback(
    (x: number) => {
      if (bodyWidth <= 0) return;
      const pct = Math.max(0, Math.min(1, (x - TRACK_HEADER_WIDTH) / bodyWidth));
      setCurrentTimeMs(pct * totalDurationMs);
    },
    [bodyWidth, totalDurationMs]
  );

  // Tap-to-jump lives only on the ruler (nothing else to tap there); track rows only scrub
  // on drag so a plain tap can still reach a clip's own Pressable underneath to select it.
  const rulerGesture = Gesture.Race(
    Gesture.Pan().onUpdate((e) => runOnJS(updateTimeFromX)(e.x)),
    Gesture.Tap().onEnd((e) => runOnJS(updateTimeFromX)(e.x))
  );

  // RF-053: a real draggable divider between the preview and timeline panels.
  const dividerStartRatio = useRef(previewRatio);
  const dividerGesture = Gesture.Pan()
    .onBegin(() => {
      dividerStartRatio.current = previewRatio;
    })
    .onUpdate((e) => {
      const next = Math.max(
        0.15,
        Math.min(0.62, dividerStartRatio.current + e.translationY / contentHeight)
      );
      runOnJS(setPreviewRatio)(next);
    });

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      setCurrentTimeMs((t) => stepFrameMs(t, direction, totalDurationMs, DEFAULT_FPS));
    },
    [totalDurationMs]
  );

  // RF-005/RF-032: which clip is "on screen" right now, and whether it's mid-transition.
  const currentClip = useMemo(() => {
    const mediaTracks = tracks.filter(
      (t) => (t.kind === 'video' || t.kind === 'image') && t.visible
    );
    for (const track of mediaTracks) {
      const clip = track.clips.find(
        (c) => currentTimeMs >= c.startMs && currentTimeMs < clipEndMs(c)
      );
      if (clip) return clip;
    }
    return null;
  }, [tracks, currentTimeMs]);

  const transitionBlend = useMemo(() => {
    if (!currentClip?.transitionIn) return null;
    const t = currentTimeMs - currentClip.startMs;
    if (t < 0 || t > currentClip.transitionIn.durationMs) return null;
    const track = tracks.find((tr) => tr.clips.some((c) => c.id === currentClip.id));
    if (!track) return null;
    const prev = previousClipOf(track, currentClip);
    if (!prev) return null;
    return {
      progress: t / currentClip.transitionIn.durationMs,
      type: currentClip.transitionIn.type,
      fromUri: prev.sourceUri,
    };
  }, [currentClip, currentTimeMs, tracks]);

  const selected = selectedClipId ? findClip(tracks, selectedClipId) : null;

  // Live-update (during a gesture) vs. commit-once (on release) — the drag-start snapshot
  // is what history.push compares against, matching the pattern used across this app.
  const dragStartRef = useRef<Track[] | null>(null);
  const beginDrag = useCallback(() => {
    dragStartRef.current = tracksRef.current;
  }, []);
  const updateDragMove = useCallback((trackId: string, clipId: string, deltaMs: number) => {
    const start = dragStartRef.current;
    if (!start) return;
    const orig = findClip(start, clipId);
    if (!orig) return;
    const next = moveClip(start, trackId, clipId, orig.clip.startMs + deltaMs);
    tracksRef.current = next;
    setTracks(next);
  }, []);
  const updateDragTrimIn = useCallback((trackId: string, clipId: string, deltaMs: number) => {
    const start = dragStartRef.current;
    if (!start) return;
    const orig = findClip(start, clipId);
    if (!orig) return;
    const next = trimClipIn(start, trackId, clipId, orig.clip.inPointMs + deltaMs);
    tracksRef.current = next;
    setTracks(next);
  }, []);
  const updateDragTrimOut = useCallback((trackId: string, clipId: string, deltaMs: number) => {
    const start = dragStartRef.current;
    if (!start) return;
    const orig = findClip(start, clipId);
    if (!orig) return;
    const next = trimClipOut(start, trackId, clipId, orig.clip.outPointMs + deltaMs);
    tracksRef.current = next;
    setTracks(next);
  }, []);
  const endDrag = useCallback(() => {
    const before = dragStartRef.current;
    if (before) {
      dragStartRef.current = null;
      history.push('tracks', before, tracksRef.current);
    }
  }, [history]);

  const nudgeTrimIn = (deltaFrames: number) => {
    if (!selected) return;
    const before = tracksRef.current;
    const after = trimClipIn(
      before,
      selected.track.id,
      selected.clip.id,
      selected.clip.inPointMs + deltaFrames * ONE_FRAME_MS
    );
    commitTracks(before, after);
  };
  /** Trims the out-point and, in Ripple mode, shifts every later clip to close the gap. */
  const trimOutWithRipple = (newOutPointMs: number) => {
    if (!selected) return;
    const before = tracksRef.current;
    const oldEnd = clipEndMs(selected.clip);
    let after = trimClipOut(before, selected.track.id, selected.clip.id, newOutPointMs);
    if (rippleMode) {
      const trimmed = findClip(after, selected.clip.id)?.clip;
      if (trimmed) {
        after = rippleShiftAfter(after, selected.track.id, oldEnd, clipEndMs(trimmed) - oldEnd);
      }
    }
    commitTracks(before, after);
  };

  const nudgeTrimOut = (deltaFrames: number) => {
    if (!selected) return;
    trimOutWithRipple(selected.clip.outPointMs + deltaFrames * ONE_FRAME_MS);
  };

  const handleSplit = () => {
    if (!selected) return;
    const before = tracksRef.current;
    const after = splitClipAtMs(before, selected.track.id, selected.clip.id, currentTimeMs);
    commitTracks(before, after);
  };

  const handleCut = () => {
    if (!selected) return;
    const relativeMs = currentTimeMs - selected.clip.startMs;
    trimOutWithRipple(selected.clip.inPointMs + relativeMs);
  };

  const handleFreeze = () => {
    if (!selected) return;
    const before = tracksRef.current;
    const after = insertFreezeFrame(
      before,
      selected.track.id,
      selected.clip.id,
      currentTimeMs,
      freezeHoldMs
    );
    commitTracks(before, after);
  };

  // RF-023: a time-lapse is a real image track built from photos the user actually picks —
  // each photo a short still clip, sequenced back-to-back (see buildTimelapseTrack).
  const handleTimelapse = async () => {
    try {
      const picked = await pickMultipleImagesFromGallery();
      if (picked.length === 0) return;
      const track = buildTimelapseTrack(
        picked.map((p) => ({ uri: p.uri, name: p.fileName ?? '' })),
        200,
        TRACK_COLORS.image
      );
      const before = tracksRef.current;
      const after = [...before, track];
      commitTracks(before, after);
    } catch (error) {
      if (error instanceof Error && error.message === 'PERMISSION_DENIED') {
        Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para criar o time-lapse.');
      } else {
        errorLogger.log(error, 'VideoEditorScreen.handleTimelapse');
        Alert.alert('Não foi possível criar o time-lapse', 'Tente novamente.');
      }
    }
  };

  const handleToolbarAction = (action: string) => {
    if (action === 'cut') handleCut();
    else if (action === 'split') handleSplit();
    else if (action === 'freeze') handleFreeze();
    else if (action === 'ripple') setRippleMode((r) => !r);
    else if (action === 'timelapse') handleTimelapse();
  };

  const toggleVisible = (trackId: string) => {
    const next = tracksRef.current.map((t) =>
      t.id === trackId ? { ...t, visible: !t.visible } : t
    );
    tracksRef.current = next;
    setTracks(next);
  };
  const toggleLocked = (trackId: string) => {
    const next = tracksRef.current.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t));
    tracksRef.current = next;
    setTracks(next);
  };

  const applyColorCorrection = (value: number) => {
    if (!selected) return;
    const next = tracksRef.current.map((t) =>
      t.id === selected.track.id
        ? {
            ...t,
            clips: t.clips.map((c) =>
              c.id === selected.clip.id ? { ...c, colorCorrection: value } : c
            ),
          }
        : t
    );
    tracksRef.current = next;
    setTracks(next);
  };
  const commitColorCorrection = (_value: number, previousValue: number) => {
    if (!selected) return;
    const before = tracksRef.current.map((t) =>
      t.id === selected.track.id
        ? {
            ...t,
            clips: t.clips.map((c) =>
              c.id === selected.clip.id ? { ...c, colorCorrection: previousValue } : c
            ),
          }
        : t
    );
    commitTracks(before, tracksRef.current);
  };

  // RF-049: playback speed — real, changes the clip's actual on-track duration
  // (clipDurationMs divides by speed), not just a cosmetic label.
  const applySpeed = (value: number) => {
    if (!selected) return;
    const next = tracksRef.current.map((t) =>
      t.id === selected.track.id
        ? {
            ...t,
            clips: t.clips.map((c) => (c.id === selected.clip.id ? { ...c, speed: value } : c)),
          }
        : t
    );
    tracksRef.current = next;
    setTracks(next);
  };
  const commitSpeed = (_value: number, previousValue: number) => {
    if (!selected) return;
    const before = tracksRef.current.map((t) =>
      t.id === selected.track.id
        ? {
            ...t,
            clips: t.clips.map((c) =>
              c.id === selected.clip.id ? { ...c, speed: previousValue } : c
            ),
          }
        : t
    );
    commitTracks(before, tracksRef.current);
  };

  // RF-036: volume + fade in/out for a background audio clip — same apply/commit pattern as
  // speed and color correction above.
  const setClipField = (
    field: 'volume' | 'fadeInMs' | 'fadeOutMs' | 'pipPosition' | 'pipSize',
    value: number | { x: number; y: number } | { width: number; height: number } | undefined
  ) => {
    if (!selected) return;
    const next = tracksRef.current.map((t) =>
      t.id === selected.track.id
        ? {
            ...t,
            clips: t.clips.map((c) => (c.id === selected.clip.id ? { ...c, [field]: value } : c)),
          }
        : t
    );
    tracksRef.current = next;
    setTracks(next);
  };
  const commitClipField = (
    field: 'volume' | 'fadeInMs' | 'fadeOutMs' | 'pipPosition' | 'pipSize',
    _value: number | { x: number; y: number } | { width: number; height: number } | undefined,
    previousValue: number | { x: number; y: number } | { width: number; height: number } | undefined
  ) => {
    if (!selected) return;
    const before = tracksRef.current.map((t) =>
      t.id === selected.track.id
        ? {
            ...t,
            clips: t.clips.map((c) =>
              c.id === selected.clip.id ? { ...c, [field]: previousValue } : c
            ),
          }
        : t
    );
    commitTracks(before, tracksRef.current);
  };

  const handleAddClip = (trackId: string, result: AddClipResult) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const before = tracksRef.current;
    const newClip = createClip({
      name: result.name,
      sourceUri: result.sourceUri,
      color: TRACK_COLORS[track.kind],
      startMs: 0,
      sourceDurationMs: result.sourceDurationMs,
    });
    const after = appendClip(before, trackId, newClip);
    commitTracks(before, after);
    setAddClipTrackId(null);
  };

  const previousOfSelected = selected ? previousClipOf(selected.track, selected.clip) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.navigate('Projects')} hitSlop={8}>
          <Icon name="chevronLeft" size={20} />
        </Pressable>
        <Text style={styles.fileName} numberOfLines={1}>
          {projectName} {history.canUndo && <Text style={styles.unsavedDot}>●</Text>}
        </Text>
        <Pressable onPress={handleUndo} disabled={!history.canUndo} hitSlop={6}>
          <Icon name="undo" size={18} color={history.canUndo ? colors.icone : colors.linha} />
        </Pressable>
        <Pressable onPress={handleRedo} disabled={!history.canRedo} hitSlop={6}>
          <Icon name="redo" size={18} color={history.canRedo ? colors.icone : colors.linha} />
        </Pressable>
        <Pressable style={styles.exportButton} onPress={() => setExportOpen(true)}>
          <Text style={styles.exportButtonText}>EXPORTAR</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} onLayout={onContentLayout}>
        <View style={[styles.previewPanel, { height: `${previewRatio * 100}%` }]}>
          {transitionBlend && (
            <Image source={{ uri: transitionBlend.fromUri }} style={styles.previewImage} />
          )}
          <Image
            source={{ uri: currentClip?.sourceUri ?? PLACEHOLDER_URI }}
            style={[
              styles.previewImage,
              transitionBlend?.type === 'fade' && { opacity: transitionBlend.progress },
              transitionBlend?.type === 'slide' && {
                transform: [{ translateX: (1 - transitionBlend.progress) * 100 }],
              },
              transitionBlend?.type === 'zoom' && {
                opacity: transitionBlend.progress,
                transform: [{ scale: 0.85 + transitionBlend.progress * 0.15 }],
              },
              transitionBlend?.type === 'wipe' && {
                opacity: transitionBlend.progress > 0.05 ? 1 : 0,
              },
            ]}
          />
          {currentClip?.colorCorrection ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: currentClip.colorCorrection > 0 ? colors.branco : colors.preto,
                  opacity: Math.min(0.5, Math.abs(currentClip.colorCorrection) / 200),
                },
              ]}
            />
          ) : null}
          <View style={styles.qualityBadge}>
            <Text style={styles.qualityBadgeText}>
              {project?.assets[0]?.metadata.width ?? 3840}×
              {project?.assets[0]?.metadata.height ?? 2160} · {DEFAULT_FPS} fps
            </Text>
          </View>
          <View style={styles.transportOverlay}>
            <View style={styles.timeRow}>
              <Text style={styles.timeCurrent}>{formatTimecode(currentTimeMs)}</Text>
              <Text style={styles.timeTotal}>{formatTimecode(totalDurationMs)}</Text>
            </View>
            <View style={styles.transportButtons}>
              <Pressable hitSlop={6} onPress={() => setCurrentTimeMs(0)}>
                <Icon name="skipBack" size={20} />
              </Pressable>
              <Pressable hitSlop={6} onPress={() => stepFrame(-1)}>
                <Icon name="rewindFrame" size={18} />
              </Pressable>
              <Pressable style={styles.playButton} onPress={() => setPlaying((p) => !p)}>
                <Icon name={playing ? 'pause' : 'play'} size={18} color={colors.texto} />
              </Pressable>
              <Pressable hitSlop={6} onPress={() => stepFrame(1)}>
                <Icon name="forwardFrame" size={18} />
              </Pressable>
              <Pressable hitSlop={6} onPress={() => setCurrentTimeMs(totalDurationMs)}>
                <Icon name="skipForward" size={20} />
              </Pressable>
            </View>
          </View>
        </View>

        <GestureDetector gesture={dividerGesture}>
          <View style={styles.dividerHandle} />
        </GestureDetector>

        <View style={styles.timelineSection}>
          <ScrollView style={{ flex: 1 }} onLayout={onBodyLayout}>
            <GestureDetector gesture={rulerGesture}>
              <View style={styles.ruler}>
                {Array.from({ length: 11 }).map((_, i) => (
                  <View key={i} style={styles.rulerTick}>
                    <Text style={styles.rulerLabel}>
                      {formatTimecode((totalDurationMs / 10) * i).slice(0, 5)}
                    </Text>
                  </View>
                ))}
                <View style={[styles.rulerPlayhead, { left: `${playheadPct}%` }]} />
              </View>
            </GestureDetector>

            {tracks.map((track) => {
              return (
                <View key={track.id} style={styles.trackRow}>
                  <View style={styles.trackHeader}>
                    <Pressable onPress={() => toggleVisible(track.id)} hitSlop={6}>
                      <Icon
                        name={track.visible ? 'eye' : 'eyeOff'}
                        size={12}
                        color={track.visible ? colors.texto2 : colors.linha}
                      />
                    </Pressable>
                    <Text style={styles.trackLabel}>{track.name}</Text>
                    <Pressable onPress={() => toggleLocked(track.id)} hitSlop={6}>
                      <Icon
                        name="lock"
                        size={10}
                        color={track.locked ? colors.perigo : colors.linha}
                      />
                    </Pressable>
                    <Pressable onPress={() => setAddClipTrackId(track.id)} hitSlop={6}>
                      <Icon name="plus" size={12} color={colors.texto2} />
                    </Pressable>
                  </View>

                  <View style={styles.clipArea}>
                    <View style={[styles.clipAreaPlayhead, { left: `${playheadPct}%` }]} />
                    {track.visible &&
                      track.clips.map((clip) => (
                        <ClipBlock
                          key={clip.id}
                          clip={clip}
                          track={track}
                          leftPct={(clip.startMs / totalDurationMs) * 100}
                          widthPct={(clipDurationMs(clip) / totalDurationMs) * 100}
                          isSelected={selectedClipId === clip.id}
                          msPerPx={msPerPx}
                          onSelect={() => {
                            setSelectedClipId((id) => (id === clip.id ? null : clip.id));
                            setClipTab('Aparar');
                          }}
                          onBeginDrag={beginDrag}
                          onMove={(delta) => updateDragMove(track.id, clip.id, delta)}
                          onTrimIn={(delta) => updateDragTrimIn(track.id, clip.id, delta)}
                          onTrimOut={(delta) => updateDragTrimOut(track.id, clip.id, delta)}
                          onEndDrag={endDrag}
                        />
                      ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {selected && (
          <View style={styles.clipPanel}>
            <View style={styles.clipTabsRow}>
              {CLIP_TABS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setClipTab(t)}
                  disabled={
                    (t === 'Transição' && !previousOfSelected) ||
                    (t === 'Áudio' && selected.track.kind !== 'audio')
                  }
                >
                  <Text
                    style={[
                      styles.clipTabText,
                      clipTab === t && styles.clipTabTextActive,
                      ((t === 'Transição' && !previousOfSelected) ||
                        (t === 'Áudio' && selected.track.kind !== 'audio')) &&
                        styles.clipTabTextDisabled,
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={{ marginLeft: 'auto' }}
                onPress={() => setSelectedClipId(null)}
                hitSlop={6}
              >
                <Icon name="x" size={16} color={colors.texto2} />
              </Pressable>
            </View>
            {clipTab === 'Aparar' && (
              <View style={styles.trimRow}>
                <Text style={styles.trimLabel}>Início</Text>
                <Pressable onPress={() => nudgeTrimIn(-1)} hitSlop={4}>
                  <Icon name="minus" size={12} color={colors.texto2} />
                </Pressable>
                <Text style={styles.trimValue}>{formatTimecode(selected.clip.inPointMs)}</Text>
                <Pressable onPress={() => nudgeTrimIn(1)} hitSlop={4}>
                  <Icon name="plus" size={12} color={colors.texto2} />
                </Pressable>
                <View style={{ flex: 1 }} />
                <Text style={styles.trimLabel}>Fim</Text>
                <Pressable onPress={() => nudgeTrimOut(-1)} hitSlop={4}>
                  <Icon name="minus" size={12} color={colors.texto2} />
                </Pressable>
                <Text style={styles.trimValue}>{formatTimecode(selected.clip.outPointMs)}</Text>
                <Pressable onPress={() => nudgeTrimOut(1)} hitSlop={4}>
                  <Icon name="plus" size={12} color={colors.texto2} />
                </Pressable>
              </View>
            )}
            {clipTab === 'Quadro' && (
              <View>
                <View style={styles.frameRow}>
                  <Pressable style={styles.frameButton} onPress={() => stepFrame(-1)}>
                    <Text style={styles.frameButtonText}>−1 quadro</Text>
                  </Pressable>
                  <Pressable style={styles.frameButton} onPress={() => stepFrame(1)}>
                    <Text style={styles.frameButtonText}>+1 quadro</Text>
                  </Pressable>
                  <View style={{ marginLeft: 8 }}>
                    <Switch value={loopReview} onChange={setLoopReview} label="Revisar em loop" />
                  </View>
                </View>
                <View style={[styles.frameRow, { marginTop: 8 }]}>
                  <Text style={styles.trimLabel}>Congelar por</Text>
                  <Pressable
                    onPress={() => setFreezeHoldMs((v) => Math.max(500, v - 500))}
                    hitSlop={4}
                  >
                    <Icon name="minus" size={12} color={colors.texto2} />
                  </Pressable>
                  <Text style={styles.trimValue}>{(freezeHoldMs / 1000).toFixed(1)}s</Text>
                  <Pressable onPress={() => setFreezeHoldMs((v) => v + 500)} hitSlop={4}>
                    <Icon name="plus" size={12} color={colors.texto2} />
                  </Pressable>
                  <Pressable style={styles.frameButton} onPress={handleFreeze}>
                    <Text style={styles.frameButtonText}>❄ Congelar aqui</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {clipTab === 'Transição' && previousOfSelected && (
              <View>
                <View style={styles.chipRow}>
                  {TRANSITION_TYPES.map((type) => {
                    const active = selected.clip.transitionIn?.type === type;
                    return (
                      <Pressable
                        key={type}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => {
                          const before = tracksRef.current;
                          const duration = clampTransitionDurationMs(
                            selected.clip.transitionIn?.durationMs ?? DEFAULT_TRANSITION_MS,
                            previousOfSelected,
                            selected.clip
                          );
                          const after = setTransition(before, selected.track.id, selected.clip.id, {
                            type,
                            durationMs: duration,
                          });
                          commitTracks(before, after);
                        }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {TRANSITION_LABELS[type]}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    style={styles.chip}
                    onPress={() => {
                      const before = tracksRef.current;
                      const after = setTransition(
                        before,
                        selected.track.id,
                        selected.clip.id,
                        undefined
                      );
                      commitTracks(before, after);
                    }}
                  >
                    <Text style={styles.chipText}>Nenhuma</Text>
                  </Pressable>
                </View>
                {selected.clip.transitionIn && (
                  <Slider
                    label="Duração"
                    value={selected.clip.transitionIn.durationMs}
                    min={100}
                    max={clampTransitionDurationMs(99999, previousOfSelected, selected.clip)}
                    onChange={(v) => applyTransitionDuration(v)}
                    onSlidingComplete={(v, from) => commitTransitionDuration(v, from)}
                  />
                )}
              </View>
            )}
            {clipTab === 'Velocidade' && (
              <View>
                <View style={styles.chipRow}>
                  {SPEED_PRESETS.map((preset) => (
                    <Pressable
                      key={preset}
                      style={[
                        styles.chip,
                        (selected.clip.speed ?? 1) === preset && styles.chipActive,
                      ]}
                      onPress={() => {
                        const before = tracksRef.current;
                        const after = before.map((t) =>
                          t.id === selected.track.id
                            ? {
                                ...t,
                                clips: t.clips.map((c) =>
                                  c.id === selected.clip.id ? { ...c, speed: preset } : c
                                ),
                              }
                            : t
                        );
                        commitTracks(before, after);
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          (selected.clip.speed ?? 1) === preset && styles.chipTextActive,
                        ]}
                      >
                        {preset}x
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Slider
                  label="Velocidade"
                  value={selected.clip.speed ?? 1}
                  min={0.25}
                  max={4}
                  step={0.25}
                  unit="x"
                  onChange={applySpeed}
                  onSlidingComplete={commitSpeed}
                />
              </View>
            )}
            {clipTab === 'Correção' && (
              <Slider
                label="Brilho"
                value={selected.clip.colorCorrection ?? 0}
                min={-100}
                max={100}
                bipolar
                showSign
                onChange={applyColorCorrection}
                onSlidingComplete={commitColorCorrection}
              />
            )}
            {clipTab === 'Áudio' && selected.track.kind === 'audio' && (
              <View style={{ gap: 4 }}>
                <Slider
                  label="Volume"
                  value={selected.clip.volume ?? 100}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => setClipField('volume', v)}
                  onSlidingComplete={(v, from) => commitClipField('volume', v, from)}
                />
                <Slider
                  label="Fade in"
                  value={selected.clip.fadeInMs ?? 0}
                  min={0}
                  max={clampFadeMs(99999, selected.clip)}
                  step={100}
                  unit=" ms"
                  onChange={(v) => setClipField('fadeInMs', v)}
                  onSlidingComplete={(v, from) => commitClipField('fadeInMs', v, from)}
                />
                <Slider
                  label="Fade out"
                  value={selected.clip.fadeOutMs ?? 0}
                  min={0}
                  max={clampFadeMs(99999, selected.clip)}
                  step={100}
                  unit=" ms"
                  onChange={(v) => setClipField('fadeOutMs', v)}
                  onSlidingComplete={(v, from) => commitClipField('fadeOutMs', v, from)}
                />
              </View>
            )}
            {clipTab === 'Sobreposição' && (
              <View style={{ gap: 4 }}>
                {pipClipId === selected.clip.id ? (
                  <>
                    <Text style={{ color: colors.texto, fontSize: 12, fontWeight: '600' }}>
                      Este clip é sobreposição (PIP)
                    </Text>
                    <Slider
                      label="Posição X"
                      value={pipX}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={setPipX}
                      onSlidingComplete={(v) => {
                        const clip = selected.clip;
                        const updated = setPipTransform(
                          clip,
                          { x: v, y: pipY },
                          { width: pipWidth, height: pipHeight }
                        );
                        setClipField('pipPosition', updated.pipPosition);
                      }}
                    />
                    <Slider
                      label="Posição Y"
                      value={pipY}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={setPipY}
                      onSlidingComplete={(v) => {
                        const clip = selected.clip;
                        const updated = setPipTransform(
                          clip,
                          { x: pipX, y: v },
                          { width: pipWidth, height: pipHeight }
                        );
                        setClipField('pipPosition', updated.pipPosition);
                      }}
                    />
                    <Slider
                      label="Largura"
                      value={pipWidth}
                      min={0.1}
                      max={1}
                      step={0.05}
                      onChange={setPipWidth}
                      onSlidingComplete={(v) => {
                        const clip = selected.clip;
                        const updated = setPipTransform(
                          clip,
                          { x: pipX, y: pipY },
                          { width: v, height: pipHeight }
                        );
                        setClipField('pipSize', updated.pipSize);
                      }}
                    />
                    <Slider
                      label="Altura"
                      value={pipHeight}
                      min={0.1}
                      max={1}
                      step={0.05}
                      onChange={setPipHeight}
                      onSlidingComplete={(v) => {
                        const clip = selected.clip;
                        const updated = setPipTransform(
                          clip,
                          { x: pipX, y: pipY },
                          { width: pipWidth, height: v }
                        );
                        setClipField('pipSize', updated.pipSize);
                      }}
                    />
                    <Pressable
                      onPress={() => setPipClipId(null)}
                      style={[styles.button, { backgroundColor: colors.perigo }]}
                    >
                      <Text style={{ color: colors.branco, fontWeight: '600', fontSize: 12 }}>
                        Remover Sobreposição
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      setPipClipId(selected.clip.id);
                      setPipX(0.65);
                      setPipY(0.65);
                      setPipWidth(0.3);
                      setPipHeight(0.3);
                    }}
                    style={[styles.button, { backgroundColor: colors.acento }]}
                  >
                    <Text style={{ color: '#0D2036', fontWeight: '600', fontSize: 12 }}>
                      Usar como Sobreposição
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.bottomToolbar}>
          <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
            {TOOLBAR_ITEMS.map(({ icon, label, action }) => (
              <Pressable
                key={label}
                style={[
                  styles.toolItem,
                  action === 'ripple' && rippleMode && styles.toolItemActive,
                ]}
                onPress={() => handleToolbarAction(action)}
                disabled={
                  (action === 'cut' || action === 'split' || action === 'freeze') && !selected
                }
              >
                <Icon
                  name={icon}
                  size={18}
                  color={
                    (action === 'cut' || action === 'split' || action === 'freeze') && !selected
                      ? colors.linha
                      : action === 'ripple' && rippleMode
                        ? colors.acento
                        : colors.icone
                  }
                />
                <Text style={styles.toolLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.timelineZoomRow}>
            <Icon name="search" size={12} color={colors.texto2} />
            <View style={{ width: 64 }}>
              <Slider
                label=""
                value={timelineZoom}
                min={10}
                max={200}
                onChange={setTimelineZoom}
                labelWidth={0}
              />
            </View>
          </View>
        </View>
      </View>

      {addClipTrackId && (
        <AddClipSheet
          trackName={tracks.find((t) => t.id === addClipTrackId)?.name ?? ''}
          trackKind={tracks.find((t) => t.id === addClipTrackId)?.kind}
          onClose={() => setAddClipTrackId(null)}
          onConfirm={(result) => handleAddClip(addClipTrackId, result)}
        />
      )}

      {exportOpen && <ExportSheet onClose={() => setExportOpen(false)} mediaKind="video" />}
    </SafeAreaView>
  );

  function applyTransitionDuration(value: number) {
    if (!selected || !selected.clip.transitionIn) return;
    const next = tracksRef.current.map((t) =>
      t.id === selected.track.id
        ? {
            ...t,
            clips: t.clips.map((c) =>
              c.id === selected.clip.id && c.transitionIn
                ? { ...c, transitionIn: { ...c.transitionIn, durationMs: value } }
                : c
            ),
          }
        : t
    );
    tracksRef.current = next;
    setTracks(next);
  }

  function commitTransitionDuration(_value: number, previousValue: number) {
    if (!selected || !selected.clip.transitionIn) return;
    const before = tracksRef.current.map((t) =>
      t.id === selected!.track.id
        ? {
            ...t,
            clips: t.clips.map((c) =>
              c.id === selected!.clip.id && c.transitionIn
                ? { ...c, transitionIn: { ...c.transitionIn, durationMs: previousValue } }
                : c
            ),
          }
        : t
    );
    commitTracks(before, tracksRef.current);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topBar: {
    height: 48,
    backgroundColor: colors.barra,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    elevation: 4,
  },
  fileName: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  unsavedDot: {
    color: colors.perigo,
  },
  exportButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.acento,
  },
  exportButtonText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#0D2036',
  },
  previewPanel: {
    backgroundColor: colors.preto,
    position: 'relative',
    overflow: 'hidden',
  },
  previewImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  qualityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  qualityBadgeText: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.ok,
  },
  transportOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeCurrent: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  timeTotal: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.md,
    color: colors.texto2,
  },
  transportButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  playButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.texto,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerHandle: {
    height: 10,
    backgroundColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineSection: {
    flex: 1,
  },
  ruler: {
    height: 24,
    backgroundColor: colors.faixa,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    flexDirection: 'row',
    paddingLeft: TRACK_HEADER_WIDTH,
    position: 'relative',
  },
  rulerTick: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: colors.linha,
    paddingLeft: 3,
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  rulerLabel: {
    fontFamily: monoFontFamily,
    fontSize: 9,
    color: colors.texto2,
  },
  rulerPlayhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.perigo,
  },
  trackRow: {
    height: 48,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  trackHeader: {
    width: TRACK_HEADER_WIDTH,
    backgroundColor: colors.barra,
    borderRightWidth: 1,
    borderRightColor: colors.linha,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    gap: 3,
  },
  trackLabel: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.texto2,
    fontWeight: '500',
    flex: 1,
  },
  clipArea: {
    flex: 1,
    backgroundColor: colors.canvas,
    position: 'relative',
  },
  clipAreaPlayhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(210,82,82,0.4)',
    zIndex: 2,
  },
  clip: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.15)',
    borderRightColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  clipSelected: {
    borderWidth: 1,
    borderColor: colors.acento,
  },
  clipFrozen: {
    borderStyle: 'dashed',
  },
  clipName: {
    fontSize: 9,
    color: 'rgba(228,228,228,0.65)',
    padding: 2,
    paddingHorizontal: 4,
  },
  waveform: {
    position: 'absolute',
    bottom: 2,
    left: 4,
    right: 4,
    height: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  waveformBar: {
    flex: 1,
    backgroundColor: colors.ok,
    opacity: 0.6,
  },
  transitionMarker: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(58,143,222,0.25)',
  },
  trimHandleLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
  },
  trimHandleRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 10,
  },
  clipPanel: {
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clipTabsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  clipTabText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  clipTabTextActive: {
    color: colors.acento,
  },
  clipTabTextDisabled: {
    color: colors.linha,
  },
  trimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trimLabel: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  trimValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.acento,
  },
  frameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  frameButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  frameButtonText: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  chipActive: {
    borderColor: colors.acento,
  },
  chipText: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  chipTextActive: {
    color: colors.acento,
  },
  bottomToolbar: {
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  toolItem: {
    alignItems: 'center',
    gap: 2,
  },
  toolItemActive: {
    opacity: 1,
  },
  toolLabel: {
    fontSize: 9,
    color: colors.texto2,
  },
  timelineZoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 88,
  },
  button: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
