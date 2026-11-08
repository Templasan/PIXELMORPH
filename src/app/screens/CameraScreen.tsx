import * as FileSystem from 'expo-file-system/legacy';
import { motionFileOf, startMotionRecording } from './camera/motionRecorder';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';

import {
  Camera,
  type CameraRef,
  type Photo,
  type Recorder,
  type TargetCameraPosition,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import * as NavigationBar from 'expo-navigation-bar';
import { setStatusBarHidden } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon } from '@core/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppModules } from '../hooks';
import { colors } from '@core/theme';
import { createMediaAsset, createMediaMetadata } from '@modules/projects';
import { errorLogger } from '@core/reliability';
import { probeFileMetadata, uprightDimensions } from '@modules/device-media';
import { probeVideoRotation } from '../../../modules/pixelmorph-video-export/src';
import { type ARSession } from '@modules/camera/ar';
import {
  FILTER_PRESETS,
  FLASH_LABEL,
  ONION_DEFAULT,
  adjustmentsToOverlayColor,
  nextFlash,
  nextOnion,
  nextStopFps,
  nextTimer,
  nextTorch,
  quarterTurnsOf,
  timerLabel,
  type CameraMode,
  type FlashMode,
} from './camera/cameraFormat';
import CameraTopBar, { type TopControl } from './camera/CameraTopBar';
import { CameraButton } from './camera/CameraButton';
import { LastCaptureThumb, ShutterButton, ShutterRow, type LastCapture } from './camera/ShutterRow';
import ModeCarousel from './camera/ModeCarousel';
import FiltersSheet from './camera/FiltersSheet';
import FocusSquare from './camera/FocusSquare';
import FilterTint from './camera/FilterTint';
import CountdownOverlay from './camera/CountdownOverlay';
import AudioMeter from './camera/AudioMeter';
import StopMotionFrameStrip from './camera/StopMotionFrameStrip';
import GridOverlay from './camera/GridOverlay';
import OnionSkin from './camera/OnionSkin';
import RecordingPill from './camera/RecordingPill';
import { ScrimGradient } from './camera/ScrimGradient';
import AROverlay from './camera/AROverlay';
import { ARAnchorsLayer } from './camera/ARAnchorsLayer';
import { LocalHistoryRepository } from '@core/history';
import { presetStep } from './photo-editor/batchPreset';
import ARControlPanel from './camera/ARControlPanel';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

/** Long edge of a stop-motion frame: the composed video is 1080p. */
const STOP_MOTION_EDGE = 1920;

// A stable, module-level constant — passing a fresh object literal to useAudioRecorder on
// every render made it recreate (and prematurely release) the native recorder each time.
// It only feeds the level meter (the video's own sound is recorded by the camera), so it records
// at low quality: encoding high-quality sound nonstop while framing kept the camera near 50% CPU.
const AUDIO_RECORDER_OPTIONS = { ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true };

/** Top of the row under the top bar: 8 px pad, 44 px buttons, 8 px gap. */
const ROW_BELOW_TOP = 60;

/**
 * RF-018: real camera capture (VisionCamera). The photo and video outputs are both attached to
 * one camera session, so switching FOTO/VÍDEO does not restart the camera; video recording
 * includes a real embedded audio track. Before recording, a real mic level meter (expo-audio, metering
 * enabled) lets the user check their audio — "monitoramento em tempo real". There is no
 * manual input-gain API exposed by either module on a managed Expo build, so that part of
 * RF-018 is left out rather than faked with a slider that would not do anything.
 */
export default function CameraScreen({ navigation }: Props) {
  // The preview fills the screen; the controls float over it, clear of the status and nav bars.
  const insets = useSafeAreaInsets();
  const { projects } = useAppModules();
  const [activeFilter, setActiveFilter] = useState(0);
  const [intensity, setIntensity] = useState(100);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState<CameraMode>('FOTO');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [stopFrames, setStopFrames] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stopFps, setStopFps] = useState(6);
  const [onionPercent, setOnionPercent] = useState(ONION_DEFAULT);
  const [gridOn, setGridOn] = useState(false);
  const [zoom, setZoom] = useState<1 | 2>(1);
  // Escala do AR: valor local durante o arraste, aplicado ao fim do gesto.
  const [arScaleDraft, setArScaleDraft] = useState<{ id: string; v: number } | null>(null);
  const [facing, setFacing] = useState<TargetCameraPosition>('back');
  // One flash state: photo flash in FOTO, the torch in VÍDEO.
  const [flash, setFlash] = useState<FlashMode>('off');
  const [busy, setBusy] = useState(false);
  const [lastCapture, setLastCapture] = useState<LastCapture | null>(null);
  // RF-024: AR anchoring system
  const [arSession, setArSession] = useState<ARSession>({
    anchors: [],
    gyroOffsetX: 0,
    gyroOffsetY: 0,
    enabled: false,
  });
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);

  // Tap-to-focus: the square shows where, the camera really refocuses there.
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef<CameraRef | null>(null);
  const handleFocusTap = useCallback(
    (event: GestureResponderEvent) => {
      const { locationX, locationY } = event.nativeEvent;
      cameraRef.current?.focusTo({ x: locationX, y: locationY }).catch(() => {});
      setFocusPoint({ x: locationX, y: locationY });
      focusAnim.setValue(1);
      Animated.timing(focusAnim, {
        toValue: 0,
        duration: 400,
        delay: 500,
        useNativeDriver: true,
      }).start(() => setFocusPoint(null));
    },
    [focusAnim]
  );

  const cameraPermission = useCameraPermission();
  const micPermission = useMicrophonePermission();
  // Both outputs stay attached: the mode only decides what the shutter does.
  const photoOutput = usePhotoOutput();
  const videoOutput = useVideoOutput({ enableAudio: micPermission.hasPermission });
  const recorderRef = useRef<Recorder | null>(null);
  // The camera runs only while this screen is shown (it stays mounted under the editor).
  const isFocused = useIsFocused();

  // A camera app is full screen: the status and navigation bars go away while this screen is
  // shown, and come back when it is left. Swipe-from-edge overlay is not in this version's API.
  useFocusEffect(
    useCallback(() => {
      setStatusBarHidden(true, 'fade');
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      return () => {
        setStatusBarHidden(false, 'fade');
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
      };
    }, [])
  );

  const audioRecorder = useAudioRecorder(AUDIO_RECORDER_OPTIONS);
  // RF-018: gain for the recorded sound, applied to its own audio track in the editor.
  const [micGain, setMicGain] = useState(1);

  // Asked only once the status is known and missing: asking while it loads (null) opened the
  // system's permission activity on every visit, even with both already granted.
  useEffect(() => {
    if (!cameraPermission.hasPermission && cameraPermission.canRequestPermission)
      cameraPermission.requestPermission().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPermission.hasPermission, cameraPermission.canRequestPermission]);
  useEffect(() => {
    if (!micPermission.hasPermission && micPermission.canRequestPermission)
      micPermission.requestPermission().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micPermission.hasPermission, micPermission.canRequestPermission]);

  // RF-018 "monitoramento em tempo real": a real mic level meter, running while framing a
  // shot in VÍDEO mode (not during the recording itself — CameraView takes exclusive mic
  // access once `recordAsync` starts).
  useEffect(() => {
    if (mode !== 'VÍDEO' || recording || !micPermission.hasPermission) return;
    // The prepare is async: if the screen leaves first (recording done -> editor), the hook has
    // already released the recorder and touching it crashes the app.
    let active = true;
    audioRecorder
      .prepareToRecordAsync()
      .then(() => {
        if (active) audioRecorder.record();
      })
      .catch(() => {});
    return () => {
      active = false;
      try {
        if (audioRecorder.isRecording) audioRecorder.stop();
      } catch {
        // Already released by useAudioRecorder on unmount.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, recording, micPermission.hasPermission]);

  // The clock counts only while a take is running and not paused.
  useEffect(() => {
    if (!recording || paused) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording, paused]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      takePhoto();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const openInEditor = useCallback(
    async (
      uri: string,
      kind: 'image' | 'video',
      width: number,
      height: number,
      look?: Record<string, number>,
      motion?: string | null
    ) => {
      const probed = await probeFileMetadata(uri, kind);
      // Camera videos are stored sideways with a rotation tag; keep the upright size.
      const rotation = kind === 'video' ? await probeVideoRotation(uri).catch(() => null) : null;
      ({ width, height } = uprightDimensions(width, height, rotation));
      const project = await projects.createProjectWithMedia.execute(
        kind === 'video' ? 'Vídeo da câmera' : 'Foto da câmera',
        kind === 'video' ? 'video' : 'photo',
        [
          createMediaAsset(
            `asset_${Date.now()}`,
            kind,
            uri,
            uri,
            createMediaMetadata(kind === 'video' ? 'video/mp4' : 'image/jpeg', {
              width,
              height,
              fileSizeBytes: probed.fileSizeBytes,
              ...(kind === 'video' && { audioGain: micGain }),
            })
          ),
        ]
      );
      // RF-009: a video without its motion still works, it just cannot be steadied later.
      const stored = project.assets[0]?.workingUri || project.assets[0]?.originalUri;
      if (motion && stored) {
        await FileSystem.writeAsStringAsync(motionFileOf(stored), motion).catch((error) =>
          errorLogger.log(error, 'CameraScreen.saveMotion')
        );
      }
      // The filter seen while shooting becomes the photo's first edit: it can be changed or undone.
      if (look && Object.keys(look).length > 0) {
        await new LocalHistoryRepository().save(project.id, {
          past: [presetStep([], look)],
          future: [],
        });
      }
      navigation.navigate(kind === 'video' ? 'VideoEditor' : 'PhotoEditor', {
        projectId: project.id,
      });
    },
    [projects, navigation, micGain]
  );

  const composeStopMotionVideo = useCallback(async () => {
    if (stopFrames.length === 0 || busy) return;
    setBusy(true);
    try {
      const project = await projects.createProjectWithMedia.execute(
        'Stop-motion',
        'video',
        stopFrames.map((frame, i) =>
          createMediaAsset(
            `stopmotion_${i}`,
            'image',
            frame,
            frame,
            createMediaMetadata('image/jpeg', {
              width: 1920,
              height: 1080,
              frameMs: 1000 / stopFps,
            })
          )
        )
      );

      setStopFrames([]);
      navigation.navigate('VideoEditor', { projectId: project.id });
    } catch (error) {
      errorLogger.log(error, 'CameraScreen.composeStopMotionVideo');
      Alert.alert('Não foi possível compor o vídeo', 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }, [stopFrames, stopFps, busy, projects, navigation]);

  const takePhoto = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    let photo: Photo | null = null;
    try {
      // The flash belongs to the back camera's FOTO only: the front one has no flash unit, and
      // AR keeps the light off.
      const photoFlash: FlashMode = facing === 'back' && mode === 'FOTO' ? flash : 'off';
      // The camera's own JPEG is kept as is: both editors turn it upright from its EXIF tag.
      photo = await photoOutput.capturePhoto({ flashMode: photoFlash }, {});
      const uri = `file://${await photo.saveToTemporaryFileAsync()}`;
      const turned = quarterTurnsOf(photo.orientation) % 2 === 1;
      const width = turned ? photo.height : photo.width;
      const height = turned ? photo.width : photo.height;
      setLastCapture({ uri, kind: 'image' });
      const k = intensity / 100;
      const look = Object.fromEntries(
        Object.entries(FILTER_PRESETS[activeFilter].adjustments)
          .filter(([, value]) => value !== 0)
          .map(([field, value]) => [field, (value as number) * k])
      );
      await openInEditor(uri, 'image', width, height, look);
    } catch (error) {
      errorLogger.log(error, 'CameraScreen.takePhoto');
      Alert.alert('Não foi possível capturar a foto', 'Tente novamente.');
    } finally {
      photo?.dispose();
      setBusy(false);
    }
  }, [busy, photoOutput, openInEditor, activeFilter, intensity, facing, mode, flash]);

  const toggleVideoRecording = useCallback(async () => {
    if (recording) {
      // Not gated behind `busy` — that stays true for the whole recording, and this is the only
      // way to end it.
      recorderRef.current?.stopRecording().catch(() => {});
      return;
    }
    if (busy) return;
    if (audioRecorder.isRecording) audioRecorder.stop();
    setElapsed(0);
    setPaused(false);
    setRecording(true);
    setBusy(true);
    const motion = startMotionRecording();
    let recorded: string | null = null;
    try {
      const recorder = await videoOutput.createRecorder({});
      recorderRef.current = recorder;
      // Resolves when the file is finished (stop pressed), rejects on a recording error.
      const path = await new Promise<string>((resolve, reject) => {
        recorder.startRecording((filePath) => resolve(filePath), reject).catch(reject);
      }).finally(() => {
        recorderRef.current = null;
        recorded = motion.stop();
      });
      setRecording(false);
      setBusy(false);
      const uri = `file://${path}`;
      setLastCapture({ uri, kind: 'video' });
      await openInEditor(uri, 'video', 1920, 1080, undefined, recorded);
    } catch (error) {
      setRecording(false);
      setBusy(false);
      errorLogger.log(error, 'CameraScreen.toggleVideoRecording');
      Alert.alert('Não foi possível gravar o vídeo', 'Tente novamente.');
    }
  }, [recording, busy, audioRecorder, videoOutput, openInEditor]);

  const togglePause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    const next = !paused;
    (next ? recorder.pauseRecording() : recorder.resumeRecording())
      .then(() => setPaused(next))
      .catch((error) => errorLogger.log(error, 'CameraScreen.togglePause'));
  }, [paused]);

  const handleShutter = useCallback(async () => {
    if (mode === 'FOTO' && timerSeconds > 0) {
      // A second press while it counts calls the photo off.
      setCountdown((c) => (c === null ? timerSeconds : null));
    } else if (mode === 'STOP-MOTION') {
      if (busy) return;
      setBusy(true);
      let photo: Photo | null = null;
      try {
        // The native video exporter ignores EXIF: frames are turned upright here, and kept at
        // video size (the composed clip is 1080p).
        photo = await photoOutput.capturePhoto({ enableShutterSound: false }, {});
        const image = await photo.toImageAsync();
        const upright = await image.rotateAsync(quarterTurnsOf(photo.orientation) * 90);
        const k = Math.min(1, STOP_MOTION_EDGE / Math.max(upright.width, upright.height));
        const small =
          k < 1
            ? await upright.resizeAsync(
                Math.round(upright.width * k),
                Math.round(upright.height * k)
              )
            : upright;
        const path = await small.saveToTemporaryFileAsync('jpg', 90);
        setStopFrames((prev) => [...prev, `file://${path}`]);
      } catch (error) {
        errorLogger.log(error, 'CameraScreen.handleShutter.stopMotion');
      } finally {
        photo?.dispose();
        setBusy(false);
      }
    } else if (mode === 'VÍDEO') {
      toggleVideoRecording();
    } else {
      takePhoto();
    }
  }, [mode, busy, timerSeconds, photoOutput, toggleVideoRecording, takePhoto]);

  // Changing mode closes the filter sheet: it belongs to the photo modes.
  const changeMode = useCallback((next: CameraMode) => {
    setFiltersOpen(false);
    setMode(next);
  }, []);

  const filterPreset = FILTER_PRESETS[activeFilter];
  const filterOverlayColor = adjustmentsToOverlayColor(filterPreset.adjustments);
  const permissionsReady = cameraPermission.hasPermission && micPermission.hasPermission;

  if (!permissionsReady) {
    return (
      <View style={[styles.container, styles.permissionWrap]}>
        <Icon name="camera" size={32} color={colors.texto2} />
        <Text style={styles.permissionText}>
          O PixelMorph precisa de acesso à câmera e ao microfone para fotografar e gravar vídeo com
          áudio.
        </Text>
        <Pressable
          style={styles.permissionButton}
          onPress={() => {
            cameraPermission.requestPermission().catch(() => {});
            micPermission.requestPermission().catch(() => {});
          }}
        >
          <Text style={styles.permissionButtonText}>Permitir acesso</Text>
        </Pressable>
      </View>
    );
  }

  const torchOn = flash === 'on';
  const lastFrame = stopFrames[stopFrames.length - 1];

  // Top bar toggles. Each one shows only in the modes it affects.
  let flashControl: TopControl | null = null;
  if (facing === 'back' && mode === 'VÍDEO') {
    flashControl = {
      icon: 'flash',
      label: torchOn ? 'ON' : 'OFF',
      active: torchOn,
      accessibilityLabel: 'Lanterna',
      onPress: () => setFlash(nextTorch(flash)),
    };
  } else if (facing === 'back' && mode === 'FOTO') {
    flashControl = {
      icon: 'flash',
      label: FLASH_LABEL[flash],
      active: flash !== 'off',
      accessibilityLabel: 'Flash',
      onPress: () => setFlash(nextFlash(flash)),
    };
  }
  const timerControl: TopControl | null =
    mode === 'FOTO'
      ? {
          icon: 'clock',
          label: timerLabel(timerSeconds),
          active: timerSeconds > 0,
          accessibilityLabel: 'Temporizador',
          onPress: () => setTimerSeconds(nextTimer(timerSeconds)),
        }
      : null;
  const gridControl: TopControl = {
    icon: 'grid',
    active: gridOn,
    accessibilityLabel: 'Grade de linhas',
    onPress: () => setGridOn((on) => !on),
  };
  const onionControl: TopControl | null =
    mode === 'STOP-MOTION'
      ? {
          icon: 'layers',
          label: `${onionPercent}%`,
          active: onionPercent > 0,
          accessibilityLabel: 'Quadro anterior',
          onPress: () => setOnionPercent(nextOnion(onionPercent)),
        }
      : null;
  const topControls = [flashControl, timerControl, gridControl, onionControl].filter(
    (c): c is TopControl => c !== null
  );

  // One centred pill under the top bar at a time.
  let topRowPill: ReactNode;
  if (filtersOpen) {
    topRowPill = (
      <View style={styles.pill}>
        <Text style={styles.pillText}>{`${filterPreset.name} · ${intensity}%`}</Text>
      </View>
    );
  } else if (recording) {
    topRowPill = <RecordingPill seconds={elapsed} />;
  } else if (mode === 'STOP-MOTION') {
    topRowPill = (
      <Pressable
        onPress={() => setStopFps(nextStopFps(stopFps))}
        accessibilityRole="button"
        accessibilityLabel={`Taxa de quadros: ${stopFps} fps`}
        hitSlop={4}
        style={styles.pill}
      >
        <Text style={styles.pillText}>
          {`${stopFrames.length} ${stopFrames.length === 1 ? 'quadro' : 'quadros'} · ${stopFps} fps`}
        </Text>
      </Pressable>
    );
  } else {
    topRowPill = (
      <Pressable
        onPress={() => setZoom((z) => (z === 1 ? 2 : 1))}
        accessibilityRole="button"
        accessibilityLabel={`Zoom ${zoom} vez${zoom === 1 ? '' : 'es'}`}
        hitSlop={4}
        style={styles.pill}
      >
        <Text style={styles.pillText}>{`${zoom}×`}</Text>
      </Pressable>
    );
  }

  // Shutter row: the sides change with the mode and with recording; the slots keep their width.
  let leftSlot: ReactNode;
  let centerSlot: ReactNode;
  let rightSlot: ReactNode = null;
  if (mode === 'STOP-MOTION') {
    const noFrames = stopFrames.length === 0;
    const composeReady = stopFrames.length >= 2 && !busy;
    leftSlot = (
      <CameraButton
        icon="undo"
        accessibilityLabel="Desfazer último quadro"
        disabled={busy || noFrames}
        onPress={() => setStopFrames((prev) => prev.slice(0, -1))}
        size={52}
      />
    );
    centerSlot = (
      <ShutterButton
        variant="photo"
        accessibilityLabel="Capturar quadro"
        disabled={busy}
        onPress={handleShutter}
      />
    );
    rightSlot = (
      <Pressable
        onPress={composeStopMotionVideo}
        disabled={!composeReady}
        accessibilityRole="button"
        accessibilityLabel="Montar vídeo"
        style={[styles.compose, !composeReady && styles.dim]}
      >
        <Text style={styles.composeText}>Montar</Text>
      </Pressable>
    );
  } else if (recording) {
    leftSlot = (
      <CameraButton
        icon={paused ? 'play' : 'pause'}
        accessibilityLabel={paused ? 'Retomar gravação' : 'Pausar gravação'}
        onPress={togglePause}
        size={52}
      />
    );
    centerSlot = (
      <ShutterButton
        variant="recording"
        accessibilityLabel="Parar gravação"
        onPress={handleShutter}
      />
    );
  } else {
    leftSlot = <LastCaptureThumb capture={lastCapture} />;
    centerSlot = (
      <ShutterButton
        variant={mode === 'VÍDEO' ? 'video' : 'photo'}
        accessibilityLabel={mode === 'VÍDEO' ? 'Gravar vídeo' : 'Tirar foto'}
        disabled={busy}
        onPress={handleShutter}
      />
    );
    rightSlot = (
      <CameraButton
        icon="rotate"
        accessibilityLabel="Trocar câmera"
        onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        size={52}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.preview} onPress={handleFocusTap}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          isActive={isFocused}
          device={facing}
          outputs={[photoOutput, videoOutput]}
          // Stop-motion stays at 1×, so its frames match each other.
          zoom={mode === 'STOP-MOTION' ? 1 : zoom}
          // The front camera has no flash unit: even setting the torch off throws, so it is left unset.
          torchMode={facing === 'back' ? (mode === 'VÍDEO' && torchOn ? 'on' : 'off') : undefined}
        />
      </Pressable>
      <FilterTint
        filterName={filterPreset.name}
        filterOverlayColor={filterOverlayColor}
        intensity={intensity}
      />
      <FocusSquare focusPoint={focusPoint} focusAnim={focusAnim} />

      {gridOn && <GridOverlay />}
      {mode === 'STOP-MOTION' && lastFrame !== undefined && onionPercent > 0 && (
        <OnionSkin uri={lastFrame} opacity={onionPercent / 100} />
      )}

      <ScrimGradient edge="top" height={insets.top + 100} />
      <CountdownOverlay countdown={countdown} />

      {mode === 'AR' && <AROverlay />}
      {mode === 'AR' && (
        <ARAnchorsLayer anchors={arSession.anchors} selectedId={selectedAnchorId} />
      )}

      {/* RF-018: a real mic level meter while framing a video shot. */}
      {mode === 'VÍDEO' && !recording && micPermission.hasPermission && (
        <View
          style={[styles.meterSlot, { top: insets.top + ROW_BELOW_TOP }]}
          pointerEvents="box-none"
        >
          <AudioMeter recorder={audioRecorder} gain={micGain} onGain={setMicGain} />
        </View>
      )}

      <CameraTopBar
        topInset={insets.top}
        onClose={() => navigation.navigate('Projects')}
        controls={topControls}
      />

      <View style={[styles.topRow, { top: insets.top + ROW_BELOW_TOP }]} pointerEvents="box-none">
        {topRowPill}
      </View>

      <ScrimGradient edge="bottom" height={300 + insets.bottom} />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
        {mode === 'STOP-MOTION' && <StopMotionFrameStrip stopFrames={stopFrames} />}

        {mode === 'AR' ? (
          <ARControlPanel
            arSession={arSession}
            onSessionChange={setArSession}
            selectedAnchorId={selectedAnchorId}
            onAnchorSelect={setSelectedAnchorId}
            arScaleDraft={arScaleDraft}
            onScaleDraftChange={setArScaleDraft}
          />
        ) : filtersOpen ? (
          <FiltersSheet
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            intensity={intensity}
            onIntensityChange={setIntensity}
            onDone={() => setFiltersOpen(false)}
          />
        ) : (
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir filtros"
            hitSlop={4}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{`Filtro: ${filterPreset.name}`}</Text>
          </Pressable>
        )}

        <ModeCarousel mode={mode} onModeChange={changeMode} disabled={recording} />

        <ShutterRow left={leftSlot} center={centerSlot} right={rightSlot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.preto,
    overflow: 'hidden',
  },
  permissionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  permissionText: {
    color: colors.texto2,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    height: 44,
    paddingHorizontal: 24,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#0D2036',
  },
  preview: {
    ...StyleSheet.absoluteFill,
  },
  meterSlot: {
    position: 'absolute',
    right: 12,
  },
  topRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    color: colors.branco,
    fontSize: 13,
    fontWeight: '600',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 8,
  },
  chip: {
    alignSelf: 'center',
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    color: colors.branco,
    fontSize: 13,
  },
  compose: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeText: {
    color: '#0D2036',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  dim: {
    opacity: 0.4,
  },
});
