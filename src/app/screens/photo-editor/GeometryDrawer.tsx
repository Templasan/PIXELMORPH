import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, Slider } from '@core/ui';
import { colors, fontSize } from '@core/theme';

const ROTATE_PRESETS = [90, 180, 270] as const;
const IDENTITY_PERSPECTIVE = {
  perspX0: 0,
  perspY0: 0,
  perspX1: 1,
  perspY1: 0,
  perspX2: 1,
  perspY2: 1,
  perspX3: 0,
  perspY3: 1,
};

interface GeometryAdjustments {
  rotation90: number;
  fineRotation: number;
  flipH: number;
  flipV: number;
  mirrorOpacity: number;
  perspX0: number;
  perspY0: number;
  perspX1: number;
  perspY1: number;
  perspX2: number;
  perspY2: number;
  perspX3: number;
  perspY3: number;
  [key: string]: number;
}

interface GeometryDrawerProps {
  adjustments: GeometryAdjustments;
  setField: (field: string, value: number) => void;
  onCommit: (field: string, value: number, previousValue: number) => void;
  perspectiveEditMode: boolean;
  onTogglePerspectiveEditMode: () => void;
  onApplyExif: () => void;
}

/** Geometria drawer: real rotation/mirror/perspective (US-05), not mocked placeholders. */
export function GeometryDrawer({
  adjustments,
  setField,
  onCommit,
  perspectiveEditMode,
  onTogglePerspectiveEditMode,
  onApplyExif,
}: GeometryDrawerProps) {
  const toggleRotation = (deg: number) => {
    const next = adjustments.rotation90 === deg ? 0 : deg;
    onCommit('rotation90', next, adjustments.rotation90);
  };

  const toggleFlip = (field: 'flipH' | 'flipV') => {
    const active = adjustments[field] > 0;
    onCommit(field, active ? 0 : 1, adjustments[field]);
  };

  const resetPerspective = () => {
    (Object.keys(IDENTITY_PERSPECTIVE) as (keyof typeof IDENTITY_PERSPECTIVE)[]).forEach(
      (field) => {
        onCommit(field, IDENTITY_PERSPECTIVE[field], adjustments[field]);
      }
    );
  };

  return (
    <View>
      <View style={styles.chipRow}>
        {ROTATE_PRESETS.map((deg) => {
          const active = adjustments.rotation90 === deg;
          return (
            <Pressable
              key={deg}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleRotation(deg)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{deg}°</Text>
            </Pressable>
          );
        })}
        <Pressable style={styles.chip} onPress={onApplyExif}>
          <Text style={styles.chipText}>Auto EXIF</Text>
        </Pressable>
      </View>

      <View style={styles.mirrorRow}>
        <Pressable
          style={[styles.mirrorButton, adjustments.flipH > 0 && styles.mirrorButtonActive]}
          onPress={() => toggleFlip('flipH')}
        >
          <Icon
            name="flipHorizontal"
            size={14}
            color={adjustments.flipH > 0 ? colors.acento : colors.texto2}
          />
          <Text style={[styles.mirrorText, adjustments.flipH > 0 && styles.mirrorTextActive]}>
            Espelhar H
          </Text>
        </Pressable>
        <Pressable
          style={[styles.mirrorButton, adjustments.flipV > 0 && styles.mirrorButtonActive]}
          onPress={() => toggleFlip('flipV')}
        >
          <Icon
            name="flipHorizontal"
            size={14}
            color={adjustments.flipV > 0 ? colors.acento : colors.texto2}
          />
          <Text style={[styles.mirrorText, adjustments.flipV > 0 && styles.mirrorTextActive]}>
            Espelhar V
          </Text>
        </Pressable>
      </View>

      <Slider
        label="Rotação"
        value={adjustments.fineRotation}
        min={-45}
        max={45}
        bipolar
        showSign
        onChange={(v) => setField('fineRotation', v)}
        onSlidingComplete={(v, from) => onCommit('fineRotation', v, from)}
      />
      <Slider
        label="Opac. espelho"
        value={adjustments.mirrorOpacity}
        min={0}
        max={100}
        onChange={(v) => setField('mirrorOpacity', v)}
        onSlidingComplete={(v, from) => onCommit('mirrorOpacity', v, from)}
      />

      <View style={styles.perspectiveSection}>
        <Pressable
          style={[styles.perspectiveButton, perspectiveEditMode && styles.perspectiveButtonActive]}
          onPress={onTogglePerspectiveEditMode}
        >
          <Icon name="crop" size={14} color={perspectiveEditMode ? colors.acento : colors.texto2} />
          <Text
            style={[
              styles.perspectiveButtonText,
              perspectiveEditMode && styles.perspectiveButtonTextActive,
            ]}
          >
            {perspectiveEditMode ? 'Editando perspectiva' : 'Corrigir perspectiva'}
          </Text>
        </Pressable>
        {perspectiveEditMode && (
          <Pressable style={styles.resetButton} onPress={resetPerspective}>
            <Text style={styles.resetButtonText}>Redefinir</Text>
          </Pressable>
        )}
      </View>
      {perspectiveEditMode && (
        <Text style={styles.hintText}>
          Arraste os quatro pontos na foto para endireitar linhas distorcidas.
        </Text>
      )}
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
  chipActive: {
    borderColor: colors.acento,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  chipTextActive: {
    color: colors.acento,
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
  mirrorButtonActive: {
    borderColor: colors.acento,
  },
  mirrorText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  mirrorTextActive: {
    color: colors.acento,
  },
  perspectiveSection: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  perspectiveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  perspectiveButtonActive: {
    borderColor: colors.acento,
  },
  perspectiveButtonText: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  perspectiveButtonTextActive: {
    color: colors.acento,
  },
  resetButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  resetButtonText: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  hintText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
});
