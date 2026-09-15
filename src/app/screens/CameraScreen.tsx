import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, Slider } from '@core/ui';
import { colors, monoFontFamily } from '@core/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

type CameraMode = 'FOTO' | 'VÍDEO' | 'TEMPORIZADOR' | 'STOP-MOTION' | 'AR';
const MODES: CameraMode[] = ['FOTO', 'VÍDEO', 'TEMPORIZADOR', 'STOP-MOTION', 'AR'];

// TODO: these are visual stand-ins (tint overlays) for real per-pixel filters.
// A production build needs a GPU pipeline (Skia runtime shaders or a GL filter chain)
// applied to the live `expo-camera` feed.
const FILTERS: { name: string; tint: string | null }[] = [
  { name: 'Original', tint: null },
  { name: 'Vívido', tint: 'rgba(255,140,0,0.08)' },
  { name: 'Retrô 400', tint: 'rgba(150,105,60,0.22)' },
  { name: 'Frio', tint: 'rgba(60,110,180,0.2)' },
  { name: 'Sépia', tint: 'rgba(112,66,20,0.35)' },
  { name: 'P&B', tint: 'rgba(0,0,0,0.001)' },
  { name: 'Cine', tint: 'rgba(20,20,30,0.3)' },
];

const PREVIEW_URI =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=780&h=1200&fit=crop&auto=format';

export default function CameraScreen({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState(0);
  const [intensity, setIntensity] = useState(100);
  const [mode, setMode] = useState<CameraMode>('FOTO');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stopFrames, setStopFrames] = useState<number[]>([]);
  const [recording, setRecording] = useState(false);
  const [stopFps, setStopFps] = useState(6);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleShutter = () => {
    if (mode === 'TEMPORIZADOR') {
      setCountdown(3);
    } else if (mode === 'STOP-MOTION') {
      setStopFrames((prev) => [...prev, prev.length + 1]);
    } else if (mode === 'VÍDEO') {
      setRecording((r) => !r);
    } else {
      // TODO: pass the actually-captured photo into the editor instead of navigating blind.
      navigation.navigate('PhotoEditor');
    }
  };

  const filter = FILTERS[activeFilter];

  return (
    <View style={styles.container}>
      <View style={styles.previewWrap}>
        {/* TODO: replace with a live expo-camera feed; this is a static stand-in image. */}
        <Image source={{ uri: PREVIEW_URI }} style={styles.preview} />
        {filter.tint && (
          <View
            pointerEvents="none"
            style={[styles.filterTint, { backgroundColor: filter.tint, opacity: intensity / 100 }]}
          />
        )}

        <View style={styles.topControls}>
          <Pressable onPress={() => navigation.navigate('Projects')} hitSlop={8}>
            <Icon name="chevronLeft" size={24} color={colors.branco} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            {/* TODO: wire flash / grid / camera-flip controls to expo-camera. */}
            <Icon name="flash" size={20} color={colors.branco} />
            <Icon name="grid" size={20} color={colors.branco} />
            <Icon name="rotate" size={20} color={colors.branco} />
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
          {FILTERS.map((f, i) => (
            <Pressable key={f.name} style={styles.filterItem} onPress={() => setActiveFilter(i)}>
              <View
                style={[styles.filterThumbWrap, activeFilter === i && styles.filterThumbActive]}
              >
                <Image source={{ uri: PREVIEW_URI }} style={styles.filterThumb} />
                {f.tint && <View style={[StyleSheet.absoluteFill, { backgroundColor: f.tint }]} />}
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
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=96&h=96&fit=crop&auto=format',
            }}
            style={styles.lastCapture}
          />
        </View>

        <Pressable
          onPress={handleShutter}
          style={[
            styles.shutter,
            (mode === 'STOP-MOTION' || (mode === 'VÍDEO' && recording)) && styles.shutterRecording,
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

        <Pressable onPress={() => navigation.navigate('Projects')} hitSlop={8}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.preto,
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
  filterThumb: {
    width: '100%',
    height: '100%',
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
  lastCapture: {
    width: '100%',
    height: '100%',
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
