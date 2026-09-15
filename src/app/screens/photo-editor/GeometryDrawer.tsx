import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, Slider } from '@core/ui';
import { colors, fontSize } from '@core/theme';

const ROTATE_OPTIONS = ['90°', '180°', '270°', 'Auto EXIF'];

/** Geometria drawer: rotate/mirror actions, perspective sliders, crop suggestion. */
export function GeometryDrawer() {
  const [rotation, setRotation] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [horizontal, setHorizontal] = useState(0);

  return (
    <View>
      {/* TODO: draggable four-point perspective overlay on the canvas is not implemented yet. */}
      <View style={styles.chipRow}>
        {ROTATE_OPTIONS.map((r) => (
          // TODO: apply the real rotation/EXIF-orientation transform.
          <Pressable key={r} style={styles.chip}>
            <Text style={styles.chipText}>{r}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.mirrorRow}>
        {/* TODO: apply real horizontal/vertical mirroring to the canvas. */}
        <Pressable style={styles.mirrorButton}>
          <Icon name="flipHorizontal" size={14} color={colors.texto2} />
          <Text style={styles.mirrorText}>Espelhar H</Text>
        </Pressable>
        <Pressable style={styles.mirrorButton}>
          <Icon name="flipHorizontal" size={14} color={colors.texto2} />
          <Text style={styles.mirrorText}>Espelhar V</Text>
        </Pressable>
      </View>
      <Slider
        label="Rotação"
        value={rotation}
        min={-45}
        max={45}
        bipolar
        showSign
        onChange={setRotation}
      />
      <Slider
        label="Vertical"
        value={vertical}
        min={-100}
        max={100}
        bipolar
        showSign
        onChange={setVertical}
      />
      <Slider
        label="Horizontal"
        value={horizontal}
        min={-100}
        max={100}
        bipolar
        showSign
        onChange={setHorizontal}
      />
      <View style={styles.suggestionCard}>
        <Icon name="sun" size={14} color={colors.alerta} />
        <Text style={styles.suggestionText}>Sugestão: recorte 3:2 pela regra dos terços</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  mirrorRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  mirrorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  mirrorText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(210,160,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(210,160,94,0.3)',
  },
  suggestionText: {
    fontSize: fontSize.xs,
    color: colors.alerta,
  },
});
