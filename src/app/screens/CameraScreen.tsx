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
  CameraView,
  type CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets } from 'expo-audio';
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
import { FILTER_PRESETS, adjustmentsToOverlayColor, type CameraMode } from './camera/cameraFormat';
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
import ARControlPanel from './camera/ARControlPanel';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

// A stable, module-level constant — passing a fresh object literal to useAudioRecorder on
// every render made it recreate (and prematurely release) the native recorder each time.
const AUDIO_RECORDER_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/**
 * RF-018: real camera capture. Photo and video both use a live `expo-camera` feed and save
 * a real file — video recording includes a real embedded audio track (CameraView's `mute`
 * defaults to false). Before recording, a real mic level meter (expo-audio, metering
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
  const [stopFrames, setStopFrames] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [stopFps, setStopFps] = useState(6);
  // Escala do AR: valor local durante o arraste, aplicado ao fim do gesto.
  const [arScaleDraft, setArScaleDraft] = useState<{ id: string; v: number } | null>(null);
  const [facing, setFacing] = useState<CameraType>('back');
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

  // Tap-to-focus square: expo-camera's Android backend has no manual focus-point API
  // (CameraX already runs continuous autofocus on its own), so this is the visual
  // affordance without a native refocus call behind it — same honesty as the AR
  // "static illustration" note below.
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const handleFocusTap = useCallback(
    (event: GestureResponderEvent) => {
      const { locationX, locationY } = event.nativeEvent;
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

  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const audioRecorder = useAudioRecorder(AUDIO_RECORDER_OPTIONS);
  const audioState = useAudioRecorderState(audioRecorder, 100);

  useEffect(() => {
    if (!cameraPermission) requestCameraPermission();
    if (!micPermission) requestMicPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RF-018 "monitoramento em tempo real": a real mic level meter, running while framing a
  // shot in VÍDEO mode (not during the recording itself — CameraView takes exclusive mic
  // access once `recordAsync` starts).
  useEffect(() => {
    if (mode !== 'VÍDEO' || recording || !micPermission?.granted) return;
    audioRecorder.prepareToRecordAsync().then(() => audioRecorder.record());
    return () => {
      if (audioRecorder.isRecording) audioRecorder.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, recording, micPermission?.granted]);

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
    async (uri: string, kind: 'image' | 'video', width: number, height: number) => {
      const project = await projects.createProject.execute(
        kind === 'video' ? 'Vídeo da câmera' : 'Foto da câmera',
        kind === 'video' ? 'video' : 'photo'
      );
      const probed = await probeFileMetadata(uri, kind);
      // Camera videos are stored sideways with a rotation tag; keep the upright size.
      const rotation = kind === 'video' ? await probeVideoRotation(uri).catch(() => null) : null;
      ({ width, height } = uprightDimensions(width, height, rotation));
      await projects.addMediaAsset.execute(
        project.id,
        createMediaAsset(
          `asset_${Date.now()}`,
          kind,
          uri,
          uri,
          createMediaMetadata(kind === 'video' ? 'video/mp4' : 'image/jpeg', {
            width,
            height,
            fileSizeBytes: probed.fileSizeBytes,
          })
        )
      );
      navigation.navigate(kind === 'video' ? 'VideoEditor' : 'PhotoEditor', {
        projectId: project.id,
      });
    },
    [projects, navigation]
  );

  const composeStopMotionVideo = useCallback(async () => {
    if (stopFrames.length === 0 || busy) return;
    setBusy(true);
    try {
      const project = await projects.createProject.execute('Stop-motion', 'video');

      for (let i = 0; i < stopFrames.length; i++) {
        await projects.addMediaAsset.execute(
          project.id,
          createMediaAsset(
            `stopmotion_${i}`,
            'image',
            stopFrames[i],
            stopFrames[i],
            createMediaMetadata('image/jpeg', { width: 1920, height: 1080 })
          )
        );
      }

      setStopFrames([]);
      navigation.navigate('VideoEditor', { projectId: project.id });
    } catch (error) {
      errorLogger.log(error, 'CameraScreen.composeStopMotionVideo');
      Alert.alert('Não foi possível compor o vídeo', 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }, [stopFrames, busy, projects, navigation]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (!photo) return;
      setLastCaptureUri(photo.uri);
      await openInEditor(photo.uri, 'image', photo.width, photo.height);
    } catch (error) {
      errorLogger.log(error, 'CameraScreen.takePhoto');
      Alert.alert('Não foi possível capturar a foto', 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }, [busy, openInEditor]);

  const toggleVideoRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    if (recording) {
      // Not gated behind `busy` — that stays true for the whole recordAsync() call below,
      // and this is the only way to end it.
      cameraRef.current.stopRecording();
      return;
    }
    if (busy) return;
    if (audioRecorder.isRecording) audioRecorder.stop();
    setRecording(true);
    setBusy(true);
    try {
      const video = await cameraRef.current.recordAsync();
      setRecording(false);
      setBusy(false);
      if (!video) return;
      setLastCaptureUri(video.uri);
      await openInEditor(video.uri, 'video', 1920, 1080);
    } catch (error) {
      setRecording(false);
      setBusy(false);
      errorLogger.log(error, 'CameraScreen.toggleVideoRecording');
      Alert.alert('Não foi possível gravar o vídeo', 'Tente novamente.');
    }
  }, [recording, busy, audioRecorder, openInEditor]);

  const handleShutter = useCallback(async () => {
    if (mode === 'TEMPORIZADOR') {
      setCountdown(3);
    } else if (mode === 'STOP-MOTION') {
      if (!cameraRef.current || busy) return;
      setBusy(true);
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo) {
          setStopFrames((prev) => [...prev, photo.uri]);
        }
      } catch (error) {
        errorLogger.log(error, 'CameraScreen.handleShutter.stopMotion');
      } finally {
        setBusy(false);
      }
    } else if (mode === 'VÍDEO') {
      toggleVideoRecording();
    } else {
      takePhoto();
    }
  }, [mode, busy, toggleVideoRecording, takePhoto]);

  const filterPreset = FILTER_PRESETS[activeFilter];
  const filterOverlayColor = adjustmentsToOverlayColor(filterPreset.adjustments);
  const permissionsReady = cameraPermission?.granted && micPermission?.granted;

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
            requestCameraPermission();
            requestMicPermission();
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
          <CameraView
            ref={cameraRef}
            style={styles.preview}
            facing={facing}
            enableTorch={torch}
            mode={mode === 'VÍDEO' ? 'video' : 'picture'}
            mute={false}
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
        {mode === 'VÍDEO' && !recording && micPermission?.granted && (
          <AudioMeter metering={audioState.metering} />
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
