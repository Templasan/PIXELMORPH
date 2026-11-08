import * as FileSystem from 'expo-file-system/legacy';
import { motionFileOf, startMotionRecording } from './camera/motionRecorder';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useIsFocused } from '@react-navigation/native';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
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
  adjustmentsToOverlayColor,
  quarterTurnsOf,
  type CameraMode,
} from './camera/cameraFormat';
import CameraTopBar from './camera/CameraTopBar';
import FilterStrip from './camera/FilterStrip';
import ModeTabs from './camera/ModeTabs';
import CaptureControls from './camera/CaptureControls';
import FocusSquare from './camera/FocusSquare';
import FilterTint from './camera/FilterTint';
import CountdownOverlay from './camera/CountdownOverlay';
import AudioMeter from './camera/AudioMeter';
import StopMotionFrameStrip from './camera/StopMotionFrameStrip';
import AROverlay from './camera/AROverlay';
import { ARAnchorsLayer } from './camera/ARAnchorsLayer';
import StopMotionPanel from './camera/StopMotionPanel';
import TimerPanel from './camera/TimerPanel';
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

/**
 * RF-018: real camera capture (VisionCamera). The photo and video outputs are both attached to
 * one camera session, so switching FOTO/VÍDEO does not restart the camera; video recording
 * includes a real embedded audio track. Before recording, a real mic level meter (expo-audio, metering
 * enabled) lets the user check their audio — "monitoramento em tempo real". There is no
 * manual input-gain API exposed by either module on a managed Expo build, so that part of
 * RF-018 is left out rather than faked with a slider that would not do anything.
 */
export default function CameraScreen({ navigation }: Props) {
  // The app draws edge to edge: keep the controls clear of the status and navigation bars.
  const insets = useSafeAreaInsets();
  const { projects } = useAppModules();
  const [activeFilter, setActiveFilter] = useState(0);
  const [intensity, setIntensity] = useState(100);
  const [mode, setMode] = useState<CameraMode>('FOTO');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(3);
  const [stopFrames, setStopFrames] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [stopFps, setStopFps] = useState(6);
  // Escala do AR: valor local durante o arraste, aplicado ao fim do gesto.
  const [arScaleDraft, setArScaleDraft] = useState<{ id: string; v: number } | null>(null);
  const [facing, setFacing] = useState<TargetCameraPosition>('back');
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastCaptureUri, setLastCaptureUri] = useState<string | null>(null);
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
      // The camera's own JPEG is kept as is: both editors turn it upright from its EXIF tag.
      photo = await photoOutput.capturePhoto({}, {});
      const uri = `file://${await photo.saveToTemporaryFileAsync()}`;
      const turned = quarterTurnsOf(photo.orientation) % 2 === 1;
      const width = turned ? photo.height : photo.width;
      const height = turned ? photo.width : photo.height;
      setLastCaptureUri(uri);
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
  }, [busy, photoOutput, openInEditor, activeFilter, intensity]);

  const toggleVideoRecording = useCallback(async () => {
    if (recording) {
      // Not gated behind `busy` — that stays true for the whole recording, and this is the only
      // way to end it.
      recorderRef.current?.stopRecording().catch(() => {});
      return;
    }
    if (busy) return;
    if (audioRecorder.isRecording) audioRecorder.stop();
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
      setLastCaptureUri(uri);
      await openInEditor(uri, 'video', 1920, 1080, undefined, recorded);
    } catch (error) {
      setRecording(false);
      setBusy(false);
      errorLogger.log(error, 'CameraScreen.toggleVideoRecording');
      Alert.alert('Não foi possível gravar o vídeo', 'Tente novamente.');
    }
  }, [recording, busy, audioRecorder, videoOutput, openInEditor]);

  const handleShutter = useCallback(async () => {
    if (mode === 'TEMPORIZADOR') {
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

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.previewWrap}>
        <Pressable style={styles.preview} onPress={handleFocusTap}>
          <Camera
            ref={cameraRef}
            style={styles.preview}
            isActive={isFocused}
            device={facing}
            outputs={[photoOutput, videoOutput]}
            torchMode={torch ? 'on' : 'off'}
          />
        </Pressable>
        <FilterTint
          filterName={filterPreset.name}
          filterOverlayColor={filterOverlayColor}
          intensity={intensity}
        />
        <FocusSquare focusPoint={focusPoint} focusAnim={focusAnim} />

        <CameraTopBar
          torch={torch}
          onTorchChange={setTorch}
          facing={facing}
          onFacingChange={setFacing}
          onBack={() => navigation.navigate('Projects')}
        />

        <CountdownOverlay countdown={countdown} />

        {/* RF-018: a real mic level meter while framing a video shot. */}
        {mode === 'VÍDEO' && !recording && micPermission.hasPermission && (
          <AudioMeter recorder={audioRecorder} gain={micGain} onGain={setMicGain} />
        )}

        {mode === 'STOP-MOTION' && <StopMotionFrameStrip stopFrames={stopFrames} />}

        {mode === 'AR' && <AROverlay />}
        {mode === 'AR' && (
          <ARAnchorsLayer anchors={arSession.anchors} selectedId={selectedAnchorId} />
        )}
      </View>

      <FilterStrip
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        intensity={intensity}
        onIntensityChange={setIntensity}
      />

      <ModeTabs mode={mode} onModeChange={setMode} />

      <CaptureControls
        lastCaptureUri={lastCaptureUri}
        onShutter={handleShutter}
        facing={facing}
        onFacingChange={setFacing}
        busy={busy}
        recording={recording}
        mode={mode}
      />

      {mode === 'TEMPORIZADOR' && <TimerPanel seconds={timerSeconds} onChange={setTimerSeconds} />}

      {mode === 'STOP-MOTION' && (
        <StopMotionPanel
          stopFps={stopFps}
          onFpsChange={setStopFps}
          stopFramesCount={stopFrames.length}
          onClear={() => setStopFrames([])}
          onCompose={composeStopMotionVideo}
          busy={busy}
        />
      )}

      {mode === 'AR' && (
        <ARControlPanel
          arSession={arSession}
          onSessionChange={setArSession}
          selectedAnchorId={selectedAnchorId}
          onAnchorSelect={setSelectedAnchorId}
          arScaleDraft={arScaleDraft}
          onScaleDraftChange={setArScaleDraft}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.preto,
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
  previewWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
});
