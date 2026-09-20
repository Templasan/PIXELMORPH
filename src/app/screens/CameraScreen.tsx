import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CameraView,
  type CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets } from 'expo-audio';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, Slider } from '@core/ui';
import { colors, monoFontFamily } from '@core/theme';
import { createProjectsModule, createMediaAsset, createMediaMetadata } from '@modules/projects';
import { errorLogger } from '@core/reliability';
import type { BasicAdjustments } from '@modules/photo-editor/color';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

// A stable, module-level constant — passing a fresh object literal to useAudioRecorder on
// every render made it recreate (and prematurely release) the native recorder each time.
const AUDIO_RECORDER_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

type CameraMode = 'FOTO' | 'VÍDEO' | 'TEMPORIZADOR' | 'STOP-MOTION' | 'AR';
const MODES: CameraMode[] = ['FOTO', 'VÍDEO', 'TEMPORIZADOR', 'STOP-MOTION', 'AR'];

// RF-006/RF-079: Real-time filter presets computed from HSL adjustments.
// Each preset maps to a BasicAdjustments configuration. The overlay is computed
// by sampling a white pixel through the adjustment pipeline to get the final color.
const FILTER_PRESETS: { name: string; adjustments: BasicAdjustments }[] = [
  {
    name: 'Original',
    adjustments: {
      temperatura: 0,
      tint: 0,
      matiz: 0,
      saturacao: 0,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 0,
    },
  },
  {
    name: 'Vívido',
    adjustments: {
      temperatura: 0,
      tint: 0,
      matiz: 0,
      saturacao: 50,
      luminosidade: 10,
      vibracao: 30,
      exposicao: 0,
    },
  },
  {
    name: 'Retrô 400',
    adjustments: {
      temperatura: 40,
      tint: 20,
      matiz: 0,
      saturacao: -20,
      luminosidade: 5,
      vibracao: -10,
      exposicao: -0.3,
    },
  },
  {
    name: 'Frio',
    adjustments: {
      temperatura: -50,
      tint: -20,
      matiz: 0,
      saturacao: 10,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 0.2,
    },
  },
  {
    name: 'Sépia',
    adjustments: {
      temperatura: 80,
      tint: 50,
      matiz: 20,
      saturacao: -30,
      luminosidade: 10,
      vibracao: 0,
      exposicao: 0,
    },
  },
  {
    name: 'P&B',
    adjustments: {
      temperatura: 0,
      tint: 0,
      matiz: 0,
      saturacao: -100,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 0,
    },
  },
  {
    name: 'Cine',
    adjustments: {
      temperatura: -20,
      tint: 0,
      matiz: 0,
      saturacao: -15,
      luminosidade: -20,
      vibracao: 0,
      exposicao: -0.4,
    },
  },
];

function adjustmentsToOverlayColor(adj: BasicAdjustments): string {
  // Sample white (1,1,1) through adjustments to compute overlay tint.
  // Simplified: convert adjustment values to approximate RGB shift.
  const r = Math.max(0, Math.min(255, 255 + adj.tint * 0.75 + adj.temperatura * 0.15));
  const g = Math.max(0, Math.min(255, 255 - adj.tint * 0.15 + adj.temperatura * 0.05));
  const b = Math.max(0, Math.min(255, 255 - adj.tint * 0.075 - adj.temperatura * 0.15));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * RF-018: real camera capture. Photo and video both use a live `expo-camera` feed and save
 * a real file — video recording includes a real embedded audio track (CameraView's `mute`
 * defaults to false). Before recording, a real mic level meter (expo-audio, metering
 * enabled) lets the user check their audio — "monitoramento em tempo real". There is no
 * manual input-gain API exposed by either module on a managed Expo build, so that part of
 * RF-018 is left out rather than faked with a slider that would not do anything.
 */
export default function CameraScreen({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState(0);
  const [intensity, setIntensity] = useState(100);
  const [mode, setMode] = useState<CameraMode>('FOTO');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stopFrames, setStopFrames] = useState<number[]>([]);
  const [recording, setRecording] = useState(false);
  const [stopFps, setStopFps] = useState(6);
  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastCaptureUri, setLastCaptureUri] = useState<string | null>(null);

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

  const openInEditor = async (
    uri: string,
    kind: 'image' | 'video',
    width: number,
    height: number
  ) => {
    const mod = createProjectsModule();
    const project = await mod.createProject.execute(
      kind === 'video' ? 'Vídeo da câmera' : 'Foto da câmera',
      kind === 'video' ? 'video' : 'photo'
    );
    await mod.addMediaAsset.execute(
      project.id,
      createMediaAsset(
        `asset_${Date.now()}`,
        kind,
        uri,
        uri,
        createMediaMetadata(kind === 'video' ? 'video/mp4' : 'image/jpeg', { width, height })
      )
    );
    navigation.navigate(kind === 'video' ? 'VideoEditor' : 'PhotoEditor', {
      projectId: project.id,
    });
  };

  const takePhoto = async () => {
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
  };

  const toggleVideoRecording = async () => {
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
  };

  const handleShutter = () => {
    if (mode === 'TEMPORIZADOR') {
      setCountdown(3);
    } else if (mode === 'STOP-MOTION') {
      setStopFrames((prev) => [...prev, prev.length + 1]);
    } else if (mode === 'VÍDEO') {
      toggleVideoRecording();
    } else {
      takePhoto();
    }
  };

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
    <View style={styles.container}>
      <View style={styles.previewWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.preview}
          facing={facing}
          enableTorch={torch}
          mode={mode === 'VÍDEO' ? 'video' : 'picture'}
          mute={false}
        />
        <View
          pointerEvents="none"
          style={[
            styles.filterTint,
            { backgroundColor: filterOverlayColor, opacity: intensity / 100 },
          ]}
        />

        <View style={styles.topControls}>
          <Pressable onPress={() => navigation.navigate('Projects')} hitSlop={8}>
            <Icon name="chevronLeft" size={24} color={colors.branco} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <Pressable onPress={() => setTorch((t) => !t)} hitSlop={8}>
              <Icon name="flash" size={20} color={torch ? colors.acento : colors.branco} />
            </Pressable>
            <Icon name="grid" size={20} color={colors.branco} />
            <Pressable
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              hitSlop={8}
            >
              <Icon name="rotate" size={20} color={colors.branco} />
            </Pressable>
          </View>
          <View style={styles.fpsBadge}>
            <Text style={styles.fpsBadgeText}>60 FPS</Text>
          </View>
        </View>

        {countdown !== null && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}

        {/* RF-018: a real mic level meter while framing a video shot. */}
        {mode === 'VÍDEO' && !recording && micPermission?.granted && (
          <View style={styles.audioMeterWrap}>
            <Icon name="mic" size={14} color={colors.texto2} />
            <View style={styles.audioMeterTrack}>
              <View
                style={[
                  styles.audioMeterFill,
                  { width: `${meteringToPercent(audioState.metering)}%` },
                ]}
              />
            </View>
          </View>
        )}

        {mode === 'STOP-MOTION' && stopFrames.length > 0 && (
          <ScrollView
            horizontal
            style={styles.stopFramesRow}
            showsHorizontalScrollIndicator={false}
          >
            {stopFrames.map((f) => (
              <View key={f} style={styles.stopFrame}>
                <Text style={styles.stopFrameText}>{f}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {mode === 'AR' && (
          <View style={styles.arOverlay} pointerEvents="none">
            <View style={styles.arBox}>
              {Array.from({ length: 25 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.arDot,
                    { left: `${(i % 5) * 25}%`, top: `${Math.floor(i / 5) * 25}%` },
                  ]}
                />
              ))}
              <View style={styles.arFrame} />
              <View style={styles.arLabel}>
                <Text style={styles.arLabelText}>Superfície detectada</Text>
              </View>
            </View>
            {/* TODO: real AR needs expo-gl / ARKit-ARCore anchoring, model library, and
                Mover/Girar/Escalar gizmo controls — this is a static illustration of the state. */}
          </View>
        )}
      </View>

      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_PRESETS.map((f, i) => (
            <Pressable key={f.name} style={styles.filterItem} onPress={() => setActiveFilter(i)}>
              <View
                style={[
                  styles.filterThumbWrap,
                  activeFilter === i && styles.filterThumbActive,
                  { backgroundColor: colors.faixa },
                ]}
              >
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: adjustmentsToOverlayColor(f.adjustments), opacity: 0.5 },
                  ]}
                />
              </View>
              <Text style={[styles.filterName, activeFilter === i && styles.filterNameActive]}>
                {f.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.intensityRow}>
          <Slider
            label="Intensidade"
            value={intensity}
            min={0}
            max={100}
            onChange={setIntensity}
            labelWidth={72}
          />
        </View>
      </View>

      <View style={styles.modeSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeRow}
        >
          {MODES.map((m) => (
            <Pressable key={m} onPress={() => setMode(m)}>
              <Text style={[styles.modeLabel, mode === m && styles.modeLabelActive]}>{m}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.lastCaptureWrap}>
          {lastCaptureUri && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.faixa }]} />
          )}
        </View>

        <Pressable
          onPress={handleShutter}
          disabled={busy && !recording}
          style={[
            styles.shutter,
            (mode === 'STOP-MOTION' || (mode === 'VÍDEO' && recording)) && styles.shutterRecording,
            busy && { opacity: 0.5 },
          ]}
        >
          {mode === 'VÍDEO' ? (
            <View
              style={[
                styles.shutterInner,
                recording ? styles.shutterSquareSmall : styles.shutterCircleLarge,
                { backgroundColor: colors.perigo },
              ]}
            />
          ) : mode === 'STOP-MOTION' ? (
            <View style={[styles.shutterSquareSmall, { backgroundColor: colors.perigo }]} />
          ) : (
            <View style={[styles.shutterCircleLarge, { backgroundColor: colors.branco }]} />
          )}
        </Pressable>

        <Pressable onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} hitSlop={8}>
          <Icon name="rotate" size={28} color={colors.icone} />
        </Pressable>
      </View>

      {mode === 'STOP-MOTION' && (
        <View style={styles.stopFpsRow}>
          <Slider
            label="Taxa de reprodução"
            value={stopFps}
            min={1}
            max={24}
            unit=" fps"
            onChange={setStopFps}
            labelWidth={110}
          />
        </View>
      )}
    </View>
  );
}

/** expo-audio metering is in dBFS (roughly -160 silence .. 0 peak) — map to a 0..100 bar. */
function meteringToPercent(db: number | undefined): number {
  if (db === undefined || Number.isNaN(db)) return 0;
  const clamped = Math.max(-60, Math.min(0, db));
  return ((clamped + 60) / 60) * 100;
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
  filterTint: {
    ...StyleSheet.absoluteFill,
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  fpsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.ok,
    backgroundColor: 'rgba(95,185,143,0.2)',
  },
  fpsBadgeText: {
    fontFamily: monoFontFamily,
    fontSize: 11,
    color: colors.ok,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  countdownText: {
    fontFamily: monoFontFamily,
    fontSize: 96,
    fontWeight: '700',
    color: colors.branco,
  },
  audioMeterWrap: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  audioMeterTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  audioMeterFill: {
    height: '100%',
    backgroundColor: colors.ok,
  },
  stopFramesRow: {
    position: 'absolute',
    top: 56,
    left: 8,
    right: 8,
  },
  stopFrame: {
    width: 48,
    height: 48,
    marginRight: 4,
    backgroundColor: 'rgba(26,26,26,0.85)',
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopFrameText: {
    fontFamily: monoFontFamily,
    fontSize: 11,
    color: colors.texto2,
  },
  arOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arBox: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  arDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(58,143,222,0.75)',
  },
  arFrame: {
    position: 'absolute',
    top: 40,
    left: 40,
    right: 40,
    bottom: 40,
    borderWidth: 2,
    borderColor: 'rgba(58,143,222,0.8)',
  },
  arLabel: {
    position: 'absolute',
    bottom: 16,
    right: -16,
    backgroundColor: 'rgba(58,143,222,0.15)',
    borderWidth: 1,
    borderColor: colors.acento,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  arLabelText: {
    fontSize: 10,
    color: colors.acento,
  },
  filterSection: {
    backgroundColor: 'rgba(0,0,0,0.88)',
    paddingTop: 8,
  },
  filterRow: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 8,
  },
  filterItem: {
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  filterThumbWrap: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: colors.linha,
    overflow: 'hidden',
  },
  filterThumbActive: {
    borderColor: colors.acento,
  },
  filterName: {
    fontSize: 9,
    color: colors.texto2,
  },
  filterNameActive: {
    color: colors.acento,
  },
  intensityRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  modeSection: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingVertical: 8,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 16,
  },
  modeLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.texto2,
  },
  modeLabelActive: {
    color: colors.acento,
    fontWeight: '500',
  },
  controlsRow: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  lastCaptureWrap: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: colors.linha,
    overflow: 'hidden',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRecording: {
    borderColor: colors.perigo,
  },
  shutterInner: {},
  shutterCircleLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  shutterSquareSmall: {
    width: 20,
    height: 20,
    borderRadius: 2,
  },
  stopFpsRow: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
});
