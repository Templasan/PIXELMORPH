import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, Slider } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { usePersistedHistory } from '@core/history';
import { type Project } from '@modules/projects';
import { useAppModules } from '../hooks';
import { errorLogger } from '@core/reliability';
import { LiveTimecode } from './video-editor/LiveTimecode';
import { Playhead } from './video-editor/Playhead';
import { LiveClipVideo, PreviewDerived } from './video-editor/PreviewDerived';
import { createTimeStore } from './video-editor/timeStore';
import { ClipPanel } from './video-editor/ClipPanel';
import { useStore } from '@core/state';
import { probeVideoRotation } from '../../../modules/pixelmorph-video-export/src';
import { VideoExportSheet } from './video-editor/VideoExportSheet';
import {
  type Track,
  type Clip,
  createClip,
  clipDurationMs,
  findClip,
  timelineDurationMs,
  DEFAULT_FPS,
  stepFrameMs,
  formatTimecode,
  buildTimelapseTrack,
  advancePlayhead,
  loopBounds,
  createVideoEditorStore,
  clipEndMs,
  ensureImageTrack,
  moveClip,
  trimClipIn,
  trimClipOut,
} from '@modules/video-editor';
import { detectSphericalFromUri, type SphericalInfo } from '@modules/video-editor/domain/spherical';
import { AddClipSheet, type AddClipResult } from './video-editor/AddClipSheet';
import { copyToAppStorage, pickMultipleImagesFromGallery } from '@modules/device-media';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoEditor'>;

const TRACK_HEADER_WIDTH = 92;
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

// TODO(RF-013): removing unwanted objects from video frames (inpainting) is not implemented — it
// needs a segmentation + inpainting model run per frame; see funcionalidades_faltantes/US-15.

/** US-14: seeds a real starting timeline from the open project's own asset (real durationMs). */
/** RF-078: style that turns the preview frame by the clip's rotation, refitting it to the panel. */
function rotatedFrameStyle(rotation: number | undefined, panel: { width: number; height: number }) {
  if (!rotation) return null;
  if (rotation === 180) return { transform: [{ rotate: '180deg' }] };
  // A quarter turn swaps the frame's box (height becomes width) so 'contain' still fits it.
  return {
    left: (panel.width - panel.height) / 2,
    top: (panel.height - panel.width) / 2,
    right: undefined,
    bottom: undefined,
    width: panel.height,
    height: panel.width,
    transform: [{ rotate: `${rotation}deg` }],
  };
}

function buildInitialTracks(project: Project | null): Track[] {
  const asset = project?.assets[0];
  // The clip must point at the real media file. It used to prefer the project's thumbnail
  // (a JPEG), so the player and frame extraction never saw the actual video.
  const uri = asset?.workingUri || asset?.originalUri || project?.thumbnailUri;
  const sourceDurationMs = asset?.metadata.durationMs || 10000;
  const v1: Track = {
    id: 'v1',
    name: 'V1',
    kind: 'video',
    visible: true,
    locked: false,
    // No media (project without an asset): an empty track, never a stand-in picture.
    clips: uri
      ? [
          createClip({
            name: project?.name ?? 'Clipe principal',
            sourceUri: uri,
            color: TRACK_COLORS.video,
            startMs: 0,
            sourceDurationMs,
          }),
        ]
      : [],
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
  return ensureImageTrack([v1, txt, a1]);
}

interface ClipBlockProps {
  clip: Clip;
  track: Track;
  leftPct: number;
  widthPct: number;
  isSelected: boolean;
  msPerPx: number;
  onSelect: (clipId: string) => void;
  onBeginDrag: () => void;
  onMove: (trackId: string, clipId: string, deltaMs: number) => void;
  onTrimIn: (trackId: string, clipId: string, deltaMs: number) => void;
  onTrimOut: (trackId: string, clipId: string, deltaMs: number) => void;
  onEndDrag: () => void;
}

/** One draggable, trimmable clip block (RF-005 move, RF-035 frame-precise trim handles). */
const ClipBlock = memo(function ClipBlock({
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
  const trackId = track.id;
  const clipId = clip.id;
  const enabled = !track.locked;
  const trimEnabled = !track.locked && !clip.frozen;
  const moveGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(10)
        .enabled(enabled)
        .onBegin(() => runOnJS(onBeginDrag)())
        .onUpdate((e) => runOnJS(onMove)(trackId, clipId, e.translationX * msPerPx))
        .onEnd(() => runOnJS(onEndDrag)()),
    [enabled, trackId, clipId, msPerPx, onBeginDrag, onMove, onEndDrag]
  );
  const trimInGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .enabled(trimEnabled)
        .onBegin(() => runOnJS(onBeginDrag)())
        .onUpdate((e) => runOnJS(onTrimIn)(trackId, clipId, e.translationX * msPerPx))
        .onEnd(() => runOnJS(onEndDrag)()),
    [trimEnabled, trackId, clipId, msPerPx, onBeginDrag, onTrimIn, onEndDrag]
  );
  const trimOutGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .enabled(trimEnabled)
        .onBegin(() => runOnJS(onBeginDrag)())
        .onUpdate((e) => runOnJS(onTrimOut)(trackId, clipId, e.translationX * msPerPx))
        .onEnd(() => runOnJS(onEndDrag)()),
    [trimEnabled, trackId, clipId, msPerPx, onBeginDrag, onTrimOut, onEndDrag]
  );

  return (
    <GestureDetector gesture={moveGesture}>
      <Pressable
        onPress={() => onSelect(clipId)}
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
});

export default function VideoEditorScreen({ navigation, route }: Props) {
  const projectId = route.params?.projectId;
  const sessionId = projectId ?? 'unsaved-video-session';
  const history = usePersistedHistory(sessionId);
  const { projects: projectsModule } = useAppModules();

  const [project, setProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('Novo projeto');
  // Timeline, selection, playback and tool state live in the video editor store; the screen
  // and its parts subscribe by selector. The history adapter reads the latest hook value.
  const historyRef = useRef(history);
  historyRef.current = history;
  const editor = useMemo(
    () =>
      createVideoEditorStore({
        push: (type, from, to) => historyRef.current.push(type, from, to),
        undo: () => historyRef.current.undo(),
        redo: () => historyRef.current.redo(),
      }),
    []
  );
  const tracks = useStore(editor.store, (st) => st.tracks);
  const selectedClipId = useStore(editor.store, (st) => st.selectedClipId);
  const playing = useStore(editor.store, (st) => st.playing);
  const rippleMode = useStore(editor.store, (st) => st.rippleMode);
  const loopReview = useStore(editor.store, (st) => st.loopReview);
  const timelineZoom = useStore(editor.store, (st) => st.timelineZoom);

  const previewShotRef = useRef<any>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const playerTimeRef = useRef<(() => number | null) | null>(null);
  const currentClipRef = useRef<Clip | null>(null);
  // Playhead lives in a store, not state: only the components that draw it subscribe.
  const timeStore = useRef(createTimeStore(0)).current;
  const setCurrentTimeMs = timeStore.set;
  // Last manual seek (ruler drag/tap, frame step): the play clock must not snap back to a stale player position.
  const lastSeekAtRef = useRef(0);
  const selected = selectedClipId ? findClip(tracks, selectedClipId) : null;
  const [bodyWidth, setBodyWidth] = useState(0);
  // RF-053: the divider between preview and timeline is draggable from 0.15 to 0.75; default
  // near the top of that range so a portrait clip (tall content in a wide, short-by-default
  // panel) isn't rendered tiny before the user ever touches the divider.
  const [previewRatio, setPreviewRatio] = useState(0.7);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [contentHeight, setContentHeight] = useState(1);
  const [addClipTrackId, setAddClipTrackId] = useState<string | null>(null);
  const [pipClipId, setPipClipId] = useState<string | null>(null);
  const [pipX, setPipX] = useState(0.7);
  const [pipY, setPipY] = useState(0.7);
  const [pipWidth, setPipWidth] = useState(0.3);
  const [pipHeight, setPipHeight] = useState(0.3);
  // RF-021: 360° video detection

  useEffect(() => {
    if (!projectId) return;
    const { getProject } = projectsModule;
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
    // The store ignores this mid-gesture, so a late replay can't clobber a drag or slider.
    const state = history.reconstructState({ tracks: initialTracks } as unknown as Record<
      string,
      unknown
    >);
    editor.hydrate(state.tracks as Track[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.ready, initialTracks]);

  const handleUndo = editor.undo;
  const handleRedo = editor.redo;

  const totalDurationMs = Math.max(1000, timelineDurationMs(tracks));
  const msPerPx = bodyWidth > 0 ? totalDurationMs / bodyWidth : 0;

  // A real (if approximated) playhead — this app has no video decoder installed, so play
  // advances elapsed time and swaps the poster image per clip rather than decoding frames.
  // Memoised: a fresh object each render re-created the playhead interval on every tick
  // (resetting its clock), which also made the whole screen churn at 10 Hz.
  const selStart = selected?.clip.startMs;
  const selEnd = selected ? clipEndMs(selected.clip) : undefined;
  const loopRange = useMemo(
    () =>
      loopReview
        ? loopBounds(
            selStart !== undefined && selEnd !== undefined
              ? { startMs: selStart, endMs: selEnd }
              : null,
            totalDurationMs
          )
        : null,
    [loopReview, selStart, selEnd, totalDurationMs]
  );
  useEffect(() => {
    if (!playing) return;
    // Real elapsed time, not a fixed 100 ms: timers run late, and a clock slower than the
    // video player drifts until ClipVideo has to seek (a black frame).
    let last = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const dt = now - last;
      last = now;
      {
        const t = timeStore.get();
        // The video player is the clock when it is running: counter and picture can't part.
        let base = t;
        let step = dt;
        const clip = currentClipRef.current;
        const src = playerTimeRef.current?.();
        // Right after a manual seek the player still reports the old position: don't follow it.
        const seeking = now - lastSeekAtRef.current < 600;
        if (seeking) step = 0;
        else if (clip && !clip.frozen && src != null) {
          const fromPlayer = clip.startMs + (src - clip.inPointMs) / (clip.speed ?? 1);
          if (Math.abs(fromPlayer - t) < 1500) {
            base = fromPlayer;
            step = 0;
          }
        }
        const result = advancePlayhead(base, step, totalDurationMs, loopRange);
        if (result.ended) editor.setPlaying(false);
        timeStore.set(result.timeMs);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [playing, totalDurationMs, loopRange]);

  // RF-021: detect if selected clip is 360° video
  // Derived from the clip's URI, not stored: `selected` is a fresh object every render, so an
  // effect keyed on it that sets state re-rendered forever ("Maximum update depth exceeded").
  const selectedSourceUri = selected?.clip.sourceUri;
  // RF-078: what orientation the file was recorded with (the player/export already honour it).
  const [fileRotation, setFileRotation] = useState<number | null>(null);
  useEffect(() => {
    setFileRotation(null);
    if (!selectedSourceUri) return;
    let cancelled = false;
    probeVideoRotation(selectedSourceUri)
      .then((r) => {
        if (!cancelled) setFileRotation(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedSourceUri]);
  const sphericalInfo = useMemo<SphericalInfo>(
    () => (selectedSourceUri ? detectSphericalFromUri(selectedSourceUri) : { isSpherical: false }),
    [selectedSourceUri]
  );

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
      lastSeekAtRef.current = Date.now();
      setCurrentTimeMs(pct * totalDurationMs);
    },
    [bodyWidth, totalDurationMs]
  );

  // Tap-to-jump lives only on the ruler (nothing else to tap there); track rows only scrub
  // on drag so a plain tap can still reach a clip's own Pressable underneath to select it.
  const rulerGesture = useMemo(
    () =>
      Gesture.Race(
        Gesture.Pan().onUpdate((e) => runOnJS(updateTimeFromX)(e.x)),
        Gesture.Tap().onEnd((e) => runOnJS(updateTimeFromX)(e.x))
      ),
    [updateTimeFromX]
  );

  // RF-053: a real draggable divider between the preview and timeline panels.
  const dividerStartRatio = useRef(previewRatio);
  const previewRatioRef = useRef(previewRatio);
  previewRatioRef.current = previewRatio;
  const contentHeightRef = useRef(contentHeight);
  contentHeightRef.current = contentHeight;
  const dividerGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          dividerStartRatio.current = previewRatioRef.current;
        })
        .onUpdate((e) => {
          const next = Math.max(
            0.15,
            Math.min(0.75, dividerStartRatio.current + e.translationY / contentHeightRef.current)
          );
          runOnJS(setPreviewRatio)(next);
        }),
    []
  );

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      lastSeekAtRef.current = Date.now();
      setCurrentTimeMs((t) => stepFrameMs(t, direction, totalDurationMs, DEFAULT_FPS));
    },
    [totalDurationMs]
  );

  const pipClip = useMemo(() => {
    if (!pipClipId) return null;
    const clip = findClip(tracks, pipClipId);
    return clip?.clip ?? null;
  }, [tracks, pipClipId]);

  // Clip drags are gestures: live updates from the drag-start snapshot, one undo entry on release.
  const beginDrag = editor.beginGesture;
  const endDrag = editor.endGesture;
  const updateDragMove = useCallback(
    (trackId: string, clipId: string, deltaMs: number) =>
      editor.live((start) => {
        const orig = findClip(start, clipId);
        return orig ? moveClip(start, trackId, clipId, orig.clip.startMs + deltaMs) : start;
      }),
    [editor]
  );
  const updateDragTrimIn = useCallback(
    (trackId: string, clipId: string, deltaMs: number) =>
      editor.live((start) => {
        const orig = findClip(start, clipId);
        return orig ? trimClipIn(start, trackId, clipId, orig.clip.inPointMs + deltaMs) : start;
      }),
    [editor]
  );
  const updateDragTrimOut = useCallback(
    (trackId: string, clipId: string, deltaMs: number) =>
      editor.live((start) => {
        const orig = findClip(start, clipId);
        return orig ? trimClipOut(start, trackId, clipId, orig.clip.outPointMs + deltaMs) : start;
      }),
    [editor]
  );

  const onSelectClip = useCallback(
    (id: string) => {
      editor.toggleSelect(id);
    },
    [editor]
  );

  const handleSplit = () => editor.split(timeStore.get());
  const handleCut = () => editor.cut(timeStore.get());
  const handleFreeze = useCallback(() => editor.freeze(timeStore.get()), [editor, timeStore]);

  // RF-023: a time-lapse is a real image track built from photos the user actually picks —
  // each photo a short still clip, sequenced back-to-back (see buildTimelapseTrack).
  const handleTimelapse = async () => {
    try {
      const picked = await pickMultipleImagesFromGallery();
      if (picked.length === 0) return;
      // Permanent copies: the picker's cache files can be wiped (see copyToAppStorage).
      const frames = await Promise.all(
        picked.map(async (p) => ({
          uri: await copyToAppStorage(p.uri, p.fileName),
          name: p.fileName ?? '',
        }))
      );
      editor.addTrack(buildTimelapseTrack(frames, 200, TRACK_COLORS.image));
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
    else if (action === 'ripple') editor.toggleRipple();
    else if (action === 'timelapse') handleTimelapse();
  };

  const toggleVisible = editor.toggleVisible;
  const toggleLocked = editor.toggleLocked;

  const handleAddClip = (trackId: string, result: AddClipResult) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    editor.addClip(
      trackId,
      createClip({
        name: result.name,
        sourceUri: result.sourceUri,
        color: TRACK_COLORS[track.kind],
        startMs: 0,
        sourceDurationMs: result.sourceDurationMs,
      })
    );
    setAddClipTrackId(null);
  };

  const captureAndExportPip = useCallback(async () => {
    if (!previewShotRef.current) {
      Alert.alert('Erro', 'Preview não está pronta');
      return;
    }
    try {
      const uri = await previewShotRef.current.capture?.();
      if (!uri) {
        Alert.alert('Erro', 'Falha ao capturar preview');
        return;
      }
      Alert.alert('Sucesso', `Frame capturado: ${uri}`);
    } catch (error) {
      errorLogger.log(error, 'VideoEditorScreen.captureAndExportPip');
      Alert.alert('Erro', 'Falha ao exportar frame');
    }
  }, []);

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
        <ViewShot
          ref={previewShotRef}
          options={{ format: 'png', quality: 0.9 }}
          style={{ height: `${previewRatio * 100}%` }}
        >
          <View style={styles.previewPanel} onLayout={(e) => setPreviewSize(e.nativeEvent.layout)}>
            <PreviewDerived
              store={timeStore}
              tracks={tracks}
              playing={playing}
              clipRef={currentClipRef}
            >
              {({ currentClip, transitionBlend, previewFrameUri, fromFrameUri }) => (
                <>
                  {transitionBlend && (
                    <Image
                      source={{ uri: fromFrameUri ?? transitionBlend.fromUri }}
                      style={styles.previewImage}
                    />
                  )}
                  <Image
                    source={previewFrameUri ? { uri: previewFrameUri } : undefined}
                    style={[
                      styles.previewImage,
                      rotatedFrameStyle(currentClip?.rotation, previewSize),
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
                  {currentClip && !currentClip.frozen && (
                    <LiveClipVideo
                      store={timeStore}
                      clip={currentClip}
                      key={currentClip.sourceUri}
                      hidden={!!transitionBlend}
                      timeRef={playerTimeRef}
                      playing={playing}
                      rate={currentClip.speed ?? 1}
                      volume={(currentClip.volume ?? 100) / 100}
                      style={rotatedFrameStyle(currentClip.rotation, previewSize)}
                    />
                  )}
                  {currentClip?.colorCorrection ? (
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor:
                            currentClip.colorCorrection > 0 ? colors.branco : colors.preto,
                          opacity: Math.min(0.5, Math.abs(currentClip.colorCorrection) / 200),
                        },
                      ]}
                    />
                  ) : null}
                </>
              )}
            </PreviewDerived>
            {pipClip && pipClip.pipPosition && pipClip.pipSize && (
              <Image
                source={{ uri: pipClip.sourceUri }}
                style={[
                  styles.previewImage,
                  {
                    left: `${pipClip.pipPosition.x * 100}%`,
                    top: `${pipClip.pipPosition.y * 100}%`,
                    width: `${pipClip.pipSize.width * 100}%`,
                    height: `${pipClip.pipSize.height * 100}%`,
                    borderWidth: 2,
                    borderColor: colors.acento,
                  },
                ]}
              />
            )}
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityBadgeText}>
                {project?.assets[0]?.metadata.width ?? 3840}×
                {project?.assets[0]?.metadata.height ?? 2160} · {DEFAULT_FPS} fps
              </Text>
            </View>
            <Pressable style={styles.maximizeButton} onPress={() => setFullscreenPreview(true)}>
              <Icon name="maximize" size={16} color={colors.branco} />
            </Pressable>
            <View style={styles.transportOverlay}>
              <View style={styles.timeRow}>
                <LiveTimecode
                  store={timeStore}
                  totalMs={totalDurationMs}
                  playing={playing}
                  style={styles.timeCurrent}
                />
                <Text style={styles.timeTotal}>{formatTimecode(totalDurationMs)}</Text>
              </View>
              <View style={styles.transportButtons}>
                <Pressable hitSlop={6} onPress={() => setCurrentTimeMs(0)}>
                  <Icon name="skipBack" size={20} />
                </Pressable>
                <Pressable hitSlop={6} onPress={() => stepFrame(-1)}>
                  <Icon name="rewindFrame" size={18} />
                </Pressable>
                <Pressable style={styles.playButton} onPress={editor.togglePlaying}>
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
        </ViewShot>

        <GestureDetector gesture={dividerGesture}>
          <View style={styles.dividerHandle} />
        </GestureDetector>

        <View style={styles.timelineSection}>
          <ScrollView style={{ flex: 1 }} onLayout={onBodyLayout}>
            <GestureDetector gesture={rulerGesture}>
              <View style={styles.ruler}>
                {Array.from({ length: 11 }).map((_, i) => (
                  <View key={i} style={styles.rulerTick}>
                    {i % 2 === 0 && (
                      <Text style={styles.rulerLabel} numberOfLines={1}>
                        {formatTimecode((totalDurationMs / 10) * i).slice(3, 8)}
                      </Text>
                    )}
                  </View>
                ))}
                {/* Its own lane over the tick area: a %-left inside the ruler itself would count
                    from the ruler's edge, ignoring the track-header padding. */}
                <View style={styles.rulerPlayheadLane} pointerEvents="none">
                  <Playhead
                    store={timeStore}
                    totalMs={totalDurationMs}
                    style={styles.rulerPlayhead}
                  />
                </View>
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
                    <Text style={styles.trackLabel} numberOfLines={1}>
                      {track.name}
                    </Text>
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
                    <Playhead
                      store={timeStore}
                      totalMs={totalDurationMs}
                      style={styles.clipAreaPlayhead}
                    />
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
                          onSelect={onSelectClip}
                          onBeginDrag={beginDrag}
                          onMove={updateDragMove}
                          onTrimIn={updateDragTrimIn}
                          onTrimOut={updateDragTrimOut}
                          onEndDrag={endDrag}
                        />
                      ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <ClipPanel
          editor={editor}
          stepFrame={stepFrame}
          handleFreeze={handleFreeze}
          fileRotation={fileRotation}
          sphericalInfo={sphericalInfo}
          pipClipId={pipClipId}
          setPipClipId={setPipClipId}
          pipX={pipX}
          pipY={pipY}
          pipWidth={pipWidth}
          pipHeight={pipHeight}
          setPipX={setPipX}
          setPipY={setPipY}
          setPipWidth={setPipWidth}
          setPipHeight={setPipHeight}
          captureAndExportPip={captureAndExportPip}
        />

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
                onChange={editor.setTimelineZoom}
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

      {exportOpen && (
        <VideoExportSheet
          tracks={tracks}
          sourceWidth={project?.assets[0]?.metadata.width}
          sourceHeight={project?.assets[0]?.metadata.height}
          onClose={() => setExportOpen(false)}
        />
      )}

      <Modal
        visible={fullscreenPreview}
        animationType="fade"
        onRequestClose={() => setFullscreenPreview(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.fullscreenPreview} edges={['top', 'bottom']}>
          {fullscreenPreview && (
            <PreviewDerived store={timeStore} tracks={tracks} playing={playing} clipRef={null}>
              {({ transitionBlend, previewFrameUri, fromFrameUri }) => (
                <>
                  {transitionBlend && (
                    <Image
                      source={{ uri: fromFrameUri ?? transitionBlend.fromUri }}
                      style={styles.previewImage}
                    />
                  )}
                  <Image
                    source={previewFrameUri ? { uri: previewFrameUri } : undefined}
                    style={styles.previewImage}
                  />
                </>
              )}
            </PreviewDerived>
          )}
          <View style={styles.fullscreenTopBar}>
            <View style={[styles.qualityBadge, styles.qualityBadgeInline]}>
              <Text style={styles.qualityBadgeText}>
                {project?.assets[0]?.metadata.width ?? 3840}×
                {project?.assets[0]?.metadata.height ?? 2160} · {DEFAULT_FPS} fps
              </Text>
            </View>
            <Pressable
              style={styles.fullscreenCloseButton}
              onPress={() => setFullscreenPreview(false)}
              hitSlop={8}
            >
              <Icon name="x" size={22} color={colors.branco} />
            </Pressable>
          </View>
          <View style={styles.transportOverlay}>
            <View style={styles.timeRow}>
              <LiveTimecode
                store={timeStore}
                totalMs={totalDurationMs}
                playing={playing}
                style={styles.timeCurrent}
              />
              <Text style={styles.timeTotal}>{formatTimecode(totalDurationMs)}</Text>
            </View>
            <View style={styles.transportButtons}>
              <Pressable hitSlop={10} onPress={() => setCurrentTimeMs(0)}>
                <Icon name="skipBack" size={20} color={colors.icone} />
              </Pressable>
              <Pressable hitSlop={10} onPress={() => stepFrame(-1)}>
                <Icon name="rewindFrame" size={18} color={colors.icone} />
              </Pressable>
              <Pressable style={styles.playButton} onPress={editor.togglePlaying}>
                <Icon name={playing ? 'pause' : 'play'} size={18} color={colors.texto} />
              </Pressable>
              <Pressable hitSlop={10} onPress={() => stepFrame(1)}>
                <Icon name="forwardFrame" size={18} color={colors.icone} />
              </Pressable>
              <Pressable hitSlop={10} onPress={() => setCurrentTimeMs(totalDurationMs)}>
                <Icon name="skipForward" size={20} color={colors.icone} />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
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
    flex: 1,
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
    // Default resizeMode is 'cover', which crops the frame to fill the panel — a preview
    // should show the whole shot instead, letterboxed if the aspect ratio doesn't match.
    resizeMode: 'contain',
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
  maximizeButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 6,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  fullscreenPreview: {
    flex: 1,
    backgroundColor: colors.preto,
  },
  fullscreenTopBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qualityBadgeInline: {
    position: 'relative',
    top: 0,
    right: 0,
  },
  fullscreenCloseButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 20,
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
    width: 60,
    fontFamily: monoFontFamily,
    fontSize: 9,
    color: colors.texto2,
  },
  rulerPlayheadLane: {
    position: 'absolute',
    left: TRACK_HEADER_WIDTH,
    right: 0,
    top: 0,
    bottom: 0,
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
});
