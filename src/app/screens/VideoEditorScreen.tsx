import { useCallback, useState } from 'react';
import {
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

type Props = NativeStackScreenProps<RootStackParamList, 'VideoEditor'>;

const DURATION = 154; // 2:34 in seconds, matches the example "Viagem Litoral" clip
const TRACK_HEADER_WIDTH = 72;

function formatTimecode(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const fr = Math.floor((s % 1) * 30);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
}

interface Clip {
  start: number;
  end: number;
  name: string;
  color: string;
}
interface Track {
  id: string;
  label: string;
  type: 'video' | 'text' | 'audio';
  clips: Clip[];
}

// TODO: replace with the real timeline/tracks for the open project.
const TRACKS: Track[] = [
  {
    id: 'v2',
    label: 'V2',
    type: 'video',
    clips: [{ start: 0.08, end: 0.45, name: 'B-roll Praia', color: '#1E3A5C' }],
  },
  {
    id: 'v1',
    label: 'V1',
    type: 'video',
    clips: [{ start: 0, end: 1, name: 'Viagem Litoral', color: '#152C44' }],
  },
  {
    id: 'txt',
    label: 'TXT',
    type: 'text',
    clips: [{ start: 0.18, end: 0.62, name: 'Legenda principal', color: '#1E1E40' }],
  },
  {
    id: 'a1',
    label: 'A1',
    type: 'audio',
    clips: [{ start: 0, end: 1, name: 'Trilha principal', color: '#122A1E' }],
  },
  {
    id: 'a2',
    label: 'A2',
    type: 'audio',
    clips: [{ start: 0.04, end: 0.55, name: 'Ambient ocean', color: '#0E1F16' }],
  },
];

const TOOLBAR_ITEMS = [
  { icon: 'scissors', label: 'Selecionar' },
  { icon: 'crop', label: 'Cortar' },
  { icon: 'zap', label: 'Dividir' },
  { icon: 'ripple', label: 'Ripple' },
  { icon: 'sun', label: 'Zoom' },
];

const CLIP_TABS = ['Aparar', 'Quadro', 'Correção'] as const;
type ClipTab = (typeof CLIP_TABS)[number];

const PREVIEW_URI =
  'https://images.unsplash.com/photo-1504700610630-ac6aba3536d3?w=780&h=440&fit=crop&auto=format';

export default function VideoEditorScreen({ navigation }: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(134.27);
  const [timelineZoom, setTimelineZoom] = useState(50);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [clipTab, setClipTab] = useState<ClipTab>('Aparar');
  const [trackVis, setTrackVis] = useState<Record<string, boolean>>({
    v2: true,
    v1: true,
    txt: true,
    a1: true,
    a2: true,
  });
  const [loopReview, setLoopReview] = useState(false);
  const [correctionBrightness, setCorrectionBrightness] = useState(0);
  const [bodyWidth, setBodyWidth] = useState(0);

  const onBodyLayout = useCallback((e: LayoutChangeEvent) => {
    setBodyWidth(e.nativeEvent.layout.width - TRACK_HEADER_WIDTH);
  }, []);

  const updateTimeFromX = useCallback(
    (x: number) => {
      if (bodyWidth <= 0) return;
      const pct = Math.max(0, Math.min(1, (x - TRACK_HEADER_WIDTH) / bodyWidth));
      setCurrentTime(pct * DURATION);
    },
    [bodyWidth]
  );

  const scrubGesture = Gesture.Pan().onUpdate((e) => {
    runOnJS(updateTimeFromX)(e.x);
  });
  const scrubTap = Gesture.Tap().onEnd((e) => {
    runOnJS(updateTimeFromX)(e.x);
  });
  const timelineGesture = Gesture.Race(scrubGesture, scrubTap);

  const playheadPct = (currentTime / DURATION) * 100;

  // TODO: this screen covers the scope actually shipped in the prototype (preview + timeline +
  // trim/frame/correction on a selected clip). The broader spec states — transitions library,
  // speed curve, full audio mixer, AI captions, PiP/360/stabilization — are not implemented here.

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.navigate('Projects')} hitSlop={8}>
          <Icon name="chevronLeft" size={20} />
        </Pressable>
        <Text style={styles.fileName} numberOfLines={1}>
          Viagem Litoral <Text style={styles.unsavedDot}>●</Text>
        </Text>
        <Pressable hitSlop={6}>
          <Icon name="undo" size={18} />
        </Pressable>
        <Pressable hitSlop={6}>
          <Icon name="redo" size={18} />
        </Pressable>
        <Pressable style={styles.exportButton} onPress={() => setExportOpen(true)}>
          <Text style={styles.exportButtonText}>EXPORTAR</Text>
        </Pressable>
      </View>

      <View style={styles.previewPanel}>
        {/* TODO: replace with a real video player (expo-av / expo-video) synced to currentTime. */}
        <Image source={{ uri: PREVIEW_URI }} style={styles.previewImage} />
        <View style={styles.qualityBadge}>
          <Text style={styles.qualityBadgeText}>4K · 30 fps</Text>
        </View>
        <View style={styles.transportOverlay}>
          <View style={styles.timeRow}>
            <Text style={styles.timeCurrent}>{formatTimecode(currentTime)}</Text>
            <Text style={styles.timeTotal}>{formatTimecode(DURATION)}</Text>
          </View>
          <View style={styles.transportButtons}>
            {/* TODO: wire transport controls to the real player. */}
            <Pressable hitSlop={6}>
              <Icon name="skipBack" size={20} />
            </Pressable>
            <Pressable hitSlop={6}>
              <Icon name="rewindFrame" size={18} />
            </Pressable>
            <Pressable style={styles.playButton} onPress={() => setPlaying((p) => !p)}>
              <Icon name={playing ? 'pause' : 'play'} size={18} color={colors.texto} />
            </Pressable>
            <Pressable hitSlop={6}>
              <Icon name="forwardFrame" size={18} />
            </Pressable>
            <Pressable hitSlop={6}>
              <Icon name="skipForward" size={20} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* TODO: draggable divider to resize preview vs. timeline is not implemented (fixed split here). */}
      <View style={styles.dividerHandle} />

      <View style={styles.timelineSection}>
        <GestureDetector gesture={timelineGesture}>
          <ScrollView style={{ flex: 1 }} onLayout={onBodyLayout}>
            <View style={styles.ruler}>
              {Array.from({ length: 11 }).map((_, i) => (
                <View key={i} style={styles.rulerTick}>
                  <Text style={styles.rulerLabel}>
                    {formatTimecode((DURATION / 10) * i).slice(0, 5)}
                  </Text>
                </View>
              ))}
              <View style={[styles.rulerPlayhead, { left: `${playheadPct}%` }]} />
            </View>

            {TRACKS.map((track) => (
              <View key={track.id} style={styles.trackRow}>
                <View style={styles.trackHeader}>
                  <Pressable
                    onPress={() => setTrackVis((v) => ({ ...v, [track.id]: !v[track.id] }))}
                    hitSlop={6}
                  >
                    <Icon
                      name={trackVis[track.id] ? 'eye' : 'eyeOff'}
                      size={12}
                      color={trackVis[track.id] ? colors.texto2 : colors.linha}
                    />
                  </Pressable>
                  <Text style={styles.trackLabel}>{track.label}</Text>
                  {/* TODO: real lock-track behavior. */}
                  <Icon name="lock" size={10} color={colors.linha} />
                </View>

                <View style={styles.clipArea}>
                  <View style={[styles.clipAreaPlayhead, { left: `${playheadPct}%` }]} />
                  {trackVis[track.id] &&
                    track.clips.map((clip, ci) => {
                      const clipId = `${track.id}-${ci}`;
                      const isSelected = selectedClip === clipId;
                      return (
                        <Pressable
                          key={ci}
                          onPress={() => setSelectedClip(isSelected ? null : clipId)}
                          style={[
                            styles.clip,
                            {
                              left: `${clip.start * 100}%`,
                              width: `${(clip.end - clip.start) * 100}%`,
                              backgroundColor: clip.color,
                            },
                            isSelected && styles.clipSelected,
                          ]}
                        >
                          <Text style={styles.clipName} numberOfLines={1}>
                            {clip.name}
                          </Text>
                          {track.type === 'audio' && (
                            <View style={styles.waveform}>
                              {Array.from({ length: 40 }).map((_, j) => (
                                <View
                                  key={j}
                                  style={[
                                    styles.waveformBar,
                                    { height: `${30 + Math.sin(j * 0.7) * 65}%` },
                                  ]}
                                />
                              ))}
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                </View>
              </View>
            ))}
          </ScrollView>
        </GestureDetector>

        {selectedClip && (
          <View style={styles.clipPanel}>
            <View style={styles.clipTabsRow}>
              {CLIP_TABS.map((t) => (
                <Pressable key={t} onPress={() => setClipTab(t)}>
                  <Text style={[styles.clipTabText, clipTab === t && styles.clipTabTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={{ marginLeft: 'auto' }}
                onPress={() => setSelectedClip(null)}
                hitSlop={6}
              >
                <Icon name="x" size={16} color={colors.texto2} />
              </Pressable>
            </View>
            {clipTab === 'Aparar' && (
              // TODO: draggable trim handles on the clip itself; these are read-only timecodes.
              <View style={styles.trimRow}>
                <Text style={styles.trimLabel}>Início</Text>
                <Text style={styles.trimValue}>00:00:12:00</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.trimLabel}>Fim</Text>
                <Text style={styles.trimValue}>00:02:34:00</Text>
              </View>
            )}
            {clipTab === 'Quadro' && (
              <View style={styles.frameRow}>
                {/* TODO: real frame-by-frame navigation. */}
                <Pressable style={styles.frameButton}>
                  <Text style={styles.frameButtonText}>−1 quadro</Text>
                </Pressable>
                <Pressable style={styles.frameButton}>
                  <Text style={styles.frameButtonText}>+1 quadro</Text>
                </Pressable>
                <View style={{ marginLeft: 8 }}>
                  <Switch value={loopReview} onChange={setLoopReview} label="Revisar em loop" />
                </View>
              </View>
            )}
            {clipTab === 'Correção' && (
              // TODO: real per-clip color correction.
              <Slider
                label="Brilho"
                value={correctionBrightness}
                min={-100}
                max={100}
                bipolar
                showSign
                onChange={setCorrectionBrightness}
              />
            )}
          </View>
        )}

        <View style={styles.bottomToolbar}>
          <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
            {TOOLBAR_ITEMS.map(({ icon, label }) => (
              // TODO: wire up select/cut/split/ripple/zoom timeline tools.
              <Pressable key={label} style={styles.toolItem}>
                <Icon name={icon} size={18} />
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

      {exportOpen && <ExportSheet onClose={() => setExportOpen(false)} />}
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
    height: '34%',
    backgroundColor: colors.preto,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
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
    height: 3,
    backgroundColor: colors.linha,
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
    paddingHorizontal: 6,
    gap: 4,
  },
  trackLabel: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
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
  trimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
