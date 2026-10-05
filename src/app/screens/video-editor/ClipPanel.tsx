import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, Slider, Switch } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { useStore, shallowEqual } from '@core/state';
import {
  type VideoEditorStore,
  selectedClipOf,
  previousClipOf,
  TRANSITION_TYPES,
  TRANSITION_LABELS,
  DEFAULT_TRANSITION_MS,
  clampTransitionDurationMs,
  setTransition,
  clampFadeMs,
  setPipTransform,
  setStabilization,
  rotateClip,
  describeFileOrientation,
  formatTimecode,
  setSphericalOrientation,
} from '@modules/video-editor';
import { applySpeedRamp } from '@modules/video-editor/domain/speedRamp';
import type { SphericalInfo } from '@modules/video-editor/domain/spherical';

const CLIP_TABS = [
  'Aparar',
  'Quadro',
  'Transição',
  'Velocidade',
  'Correção',
  'Áudio',
  'Sobreposição',
] as const;
type ClipTab = (typeof CLIP_TABS)[number];

const SPEED_PRESETS = [0.25, 0.5, 1, 2, 4] as const;
const ONE_FRAME_MS = 1000 / 30; // DEFAULT_FPS = 30

export interface ClipPanelProps {
  editor: VideoEditorStore;
  stepFrame: (direction: 1 | -1) => void;
  handleFreeze: () => void;
  fileRotation: number | null;
  sphericalInfo: SphericalInfo;
  pipClipId: string | null;
  setPipClipId: (id: string | null) => void;
}

export const ClipPanel = memo(function ClipPanel({
  editor,
  stepFrame,
  handleFreeze,
  fileRotation,
  sphericalInfo,
  pipClipId,
  setPipClipId,
}: ClipPanelProps) {
  const selected = useStore(editor.store, selectedClipOf, shallowEqual);
  // PiP placement being edited: local to the panel so dragging these sliders re-renders the
  // panel only (it used to live in the screen and re-render the whole editor on every tick).
  const [pipX, setPipX] = useState(0.7);
  const [pipY, setPipY] = useState(0.7);
  const [pipWidth, setPipWidth] = useState(0.3);
  const [pipHeight, setPipHeight] = useState(0.3);
  const freezeHoldMs = useStore(editor.store, (st) => st.freezeHoldMs);
  const loopReview = useStore(editor.store, (st) => st.loopReview);

  const [clipTab, setClipTab] = useState<ClipTab>('Aparar');

  // Reset tab to 'Aparar' when selection changes
  useEffect(() => {
    setClipTab('Aparar');
  }, [selected?.clip.id]);

  if (!selected) return null;

  const previousOfSelected = previousClipOf(selected.track, selected.clip);

  const nudgeTrimIn = (deltaFrames: number) => editor.nudgeTrimIn(deltaFrames * ONE_FRAME_MS);
  const nudgeTrimOut = (deltaFrames: number) => editor.nudgeTrimOut(deltaFrames * ONE_FRAME_MS);
  const applyColorCorrection = (value: number) =>
    editor.liveClip((c) => ({ ...c, colorCorrection: value }));
  const applySpeed = (value: number) => editor.liveClip((c) => ({ ...c, speed: value }));
  const setClipField = (field: 'volume' | 'fadeInMs' | 'fadeOutMs', value: number) =>
    editor.liveClip((c) => ({ ...c, [field]: value }));
  const endSliderGesture = () => editor.endGesture();

  return (
    <View style={styles.clipPanel}>
      <View style={styles.clipTabsRow}>
        {CLIP_TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setClipTab(t)}
            disabled={
              (t === 'Transição' && !previousOfSelected) ||
              (t === 'Áudio' && selected.track.kind !== 'audio' && selected.track.kind !== 'video')
            }
          >
            <Text
              style={[
                styles.clipTabText,
                clipTab === t && styles.clipTabTextActive,
                ((t === 'Transição' && !previousOfSelected) ||
                  (t === 'Áudio' &&
                    selected.track.kind !== 'audio' &&
                    selected.track.kind !== 'video')) &&
                  styles.clipTabTextDisabled,
              ]}
            >
              {t}
            </Text>
          </Pressable>
        ))}
        <Pressable style={{ marginLeft: 'auto' }} onPress={editor.clearSelection} hitSlop={6}>
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
              <Switch value={loopReview} onChange={editor.setLoopReview} label="Revisar em loop" />
            </View>
          </View>
          <View style={[styles.frameRow, { marginTop: 8 }]}>
            <Text style={styles.trimLabel}>Congelar por</Text>
            <Pressable
              onPress={() => editor.setFreezeHoldMs(Math.max(500, freezeHoldMs - 500))}
              hitSlop={4}
            >
              <Icon name="minus" size={12} color={colors.texto2} />
            </Pressable>
            <Text style={styles.trimValue}>{(freezeHoldMs / 1000).toFixed(1)}s</Text>
            <Pressable onPress={() => editor.setFreezeHoldMs(freezeHoldMs + 500)} hitSlop={4}>
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
                  onPress={() =>
                    editor.commitOnSelected((t, trackId, clip) =>
                      setTransition(t, trackId, clip.id, {
                        type,
                        durationMs: clampTransitionDurationMs(
                          clip.transitionIn?.durationMs ?? DEFAULT_TRANSITION_MS,
                          previousOfSelected,
                          clip
                        ),
                      })
                    )
                  }
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {TRANSITION_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={styles.chip}
              onPress={() =>
                editor.commitOnSelected((t, trackId, clip) =>
                  setTransition(t, trackId, clip.id, undefined)
                )
              }
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
              onChange={(v) =>
                editor.liveClip((c) =>
                  c.transitionIn ? { ...c, transitionIn: { ...c.transitionIn, durationMs: v } } : c
                )
              }
              onSlidingComplete={endSliderGesture}
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
                style={[styles.chip, (selected.clip.speed ?? 1) === preset && styles.chipActive]}
                onPress={() => editor.commitClip((c) => ({ ...c, speed: preset }))}
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
            onSlidingComplete={endSliderGesture}
          />
          <Pressable
            style={[styles.chip, { alignSelf: 'flex-start', marginTop: 8 }]}
            accessibilityLabel="Suavizar o fim do clipe até 1x"
            onPress={() =>
              editor.commitOnSelected((t, trackId, clip) =>
                applySpeedRamp(t, trackId, clip.id, 1, 1500, 'end')
              )
            }
          >
            <Text style={styles.chipText}>Suavizar fim até 1x (1,5s)</Text>
          </Pressable>
        </View>
      )}
      {clipTab === 'Correção' && (
        <View style={{ gap: 8 }}>
          <View style={styles.frameRow}>
            <Text style={styles.trimLabel}>Rotação</Text>
            {([-90, 90] as const).map((delta) => (
              <Pressable
                key={delta}
                style={styles.frameButton}
                accessibilityLabel={delta < 0 ? 'Girar 90° à esquerda' : 'Girar 90° à direita'}
                onPress={() => editor.commitClip((c) => rotateClip(c, delta))}
              >
                <Text style={styles.frameButtonText}>{delta < 0 ? '⟲ 90°' : '⟳ 90°'}</Text>
              </Pressable>
            ))}
            <Text style={styles.trimValue}>{selected.clip.rotation ?? 0}°</Text>
          </View>
          {fileRotation !== null && (
            <Text style={styles.trimLabel}>{describeFileOrientation(fileRotation)}</Text>
          )}
          <Slider
            label="Brilho"
            value={selected.clip.colorCorrection ?? 0}
            min={-100}
            max={100}
            bipolar
            showSign
            onChange={applyColorCorrection}
            onSlidingComplete={endSliderGesture}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: colors.texto, fontSize: 12, fontWeight: '500' }}>
              Estabilização
            </Text>
            <Switch
              value={selected.clip.stabilization ?? false}
              onChange={(v: boolean) => editor.commitClip((c) => setStabilization(c, v))}
            />
          </View>
          {sphericalInfo.isSpherical && (
            <>
              <Text
                style={{
                  color: colors.texto,
                  fontSize: 11,
                  fontWeight: '600',
                  marginTop: 8,
                  marginBottom: 4,
                }}
              >
                📹 Orientação 360°
              </Text>
              <Slider
                label="Pitch (cima/baixo)"
                value={selected.clip.sphericalPitch ?? 0}
                min={-90}
                max={90}
                bipolar
                onChange={(v: number) =>
                  editor.liveClip((c) =>
                    setSphericalOrientation(c, v, c.sphericalYaw ?? 0, c.sphericalRoll ?? 0)
                  )
                }
                onSlidingComplete={endSliderGesture}
              />
              <Slider
                label="Yaw (esq/dir)"
                value={selected.clip.sphericalYaw ?? 0}
                min={-180}
                max={180}
                bipolar
                onChange={(v: number) =>
                  editor.liveClip((c) =>
                    setSphericalOrientation(c, c.sphericalPitch ?? 0, v, c.sphericalRoll ?? 0)
                  )
                }
                onSlidingComplete={endSliderGesture}
              />
              <Slider
                label="Roll (rotação)"
                value={selected.clip.sphericalRoll ?? 0}
                min={-180}
                max={180}
                bipolar
                onChange={(v: number) =>
                  editor.liveClip((c) =>
                    setSphericalOrientation(c, c.sphericalPitch ?? 0, c.sphericalYaw ?? 0, v)
                  )
                }
                onSlidingComplete={endSliderGesture}
              />
            </>
          )}
        </View>
      )}
      {clipTab === 'Áudio' && selected.track.kind === 'video' && (
        <View style={{ gap: 4 }}>
          <Slider
            label="Volume"
            value={selected.clip.volume ?? 100}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => setClipField('volume', v)}
            onSlidingComplete={endSliderGesture}
          />
        </View>
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
            onSlidingComplete={endSliderGesture}
          />
          <Slider
            label="Fade in"
            value={selected.clip.fadeInMs ?? 0}
            min={0}
            max={clampFadeMs(99999, selected.clip)}
            step={100}
            unit=" ms"
            onChange={(v) => setClipField('fadeInMs', v)}
            onSlidingComplete={endSliderGesture}
          />
          <Slider
            label="Fade out"
            value={selected.clip.fadeOutMs ?? 0}
            min={0}
            max={clampFadeMs(99999, selected.clip)}
            step={100}
            unit=" ms"
            onChange={(v) => setClipField('fadeOutMs', v)}
            onSlidingComplete={endSliderGesture}
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
                onSlidingComplete={(v) =>
                  editor.commitClip((c) =>
                    setPipTransform(c, { x: v, y: pipY }, { width: pipWidth, height: pipHeight })
                  )
                }
              />
              <Slider
                label="Posição Y"
                value={pipY}
                min={0}
                max={1}
                step={0.05}
                onChange={setPipY}
                onSlidingComplete={(v) =>
                  editor.commitClip((c) =>
                    setPipTransform(c, { x: pipX, y: v }, { width: pipWidth, height: pipHeight })
                  )
                }
              />
              <Slider
                label="Largura"
                value={pipWidth}
                min={0.1}
                max={1}
                step={0.05}
                onChange={setPipWidth}
                onSlidingComplete={(v) =>
                  editor.commitClip((c) =>
                    setPipTransform(c, { x: pipX, y: pipY }, { width: v, height: pipHeight })
                  )
                }
              />
              <Slider
                label="Altura"
                value={pipHeight}
                min={0.1}
                max={1}
                step={0.05}
                onChange={setPipHeight}
                onSlidingComplete={(v) =>
                  editor.commitClip((c) =>
                    setPipTransform(c, { x: pipX, y: pipY }, { width: pipWidth, height: v })
                  )
                }
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setPipClipId(null)}
                  style={[styles.button, { flex: 1, backgroundColor: colors.perigo }]}
                >
                  <Text style={{ color: colors.branco, fontWeight: '600', fontSize: 12 }}>
                    Remover
                  </Text>
                </Pressable>
              </View>
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
  );
});

const styles = StyleSheet.create({
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
  button: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
