import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { createPhotoEditorModule } from '@modules/photo-editor';
import { createMask, clearMask, invertMask, type Mask } from '@modules/photo-editor/domain';

interface MaskPainterSheetProps {
  onClose: () => void;
  onApplyMask: (mask: Mask) => void;
  photoWidth: number;
  photoHeight: number;
}

export function MaskPainterSheet({
  onClose,
  onApplyMask,
  photoWidth,
  photoHeight,
}: MaskPainterSheetProps) {
  const [mask, setMask] = useState<Mask | null>(null);
  const [radius, setRadius] = useState(15);
  const [hardness, setHardness] = useState(100);
  const [erase, setErase] = useState(false);
  const canvasRef = useRef<View>(null);
  const photoMod = createPhotoEditorModule();

  // Initialize mask on first render
  const initMask = () => {
    if (!mask) {
      setMask(createMask('mask_0', photoWidth, photoHeight));
    }
  };

  const handlePan = (e: any) => {
    if (!mask || !canvasRef.current) return;

    const { locationX, locationY } = e.nativeEvent;
    const updated = photoMod.applyBrushStroke.execute(
      mask,
      Math.round(locationX),
      Math.round(locationY),
      Math.round(locationX),
      Math.round(locationY),
      radius,
      hardness,
      0.5,
      erase
    );
    setMask({ ...updated });
  };

  const handleClear = () => {
    if (mask) {
      clearMask(mask);
      setMask({ ...mask });
    }
  };

  const handleInvert = () => {
    if (mask) {
      invertMask(mask);
      setMask({ ...mask });
    }
  };

  const handleApply = () => {
    if (mask) {
      onApplyMask(mask);
      onClose();
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Pincel de máscara</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="x" size={18} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Canvas preview */}
        <Pressable
          ref={canvasRef}
          onTouchMove={handlePan}
          onPress={initMask}
          style={[styles.canvas, { aspectRatio: photoWidth / photoHeight }]}
        >
          <Text style={styles.canvasHint}>Toque para desenhar</Text>
        </Pressable>

        {/* Controls */}
        <View style={styles.controlSection}>
          <Text style={styles.label}>Tamanho: {radius}px</Text>
          <View style={styles.sliderFake}>
            <Pressable
              onPress={() => setRadius(Math.max(5, radius - 5))}
              style={styles.sliderButton}
            >
              <Icon name="minus" size={16} color={colors.acento} />
            </Pressable>
            <Pressable
              onPress={() => setRadius(Math.min(50, radius + 5))}
              style={styles.sliderButton}
            >
              <Icon name="plus" size={16} color={colors.acento} />
            </Pressable>
          </View>
        </View>

        <View style={styles.controlSection}>
          <Text style={styles.label}>Dureza: {hardness}%</Text>
          <View style={styles.sliderFake}>
            <Pressable
              onPress={() => setHardness(Math.max(0, hardness - 10))}
              style={styles.sliderButton}
            >
              <Icon name="minus" size={16} color={colors.acento} />
            </Pressable>
            <Pressable
              onPress={() => setHardness(Math.min(100, hardness + 10))}
              style={styles.sliderButton}
            >
              <Icon name="plus" size={16} color={colors.acento} />
            </Pressable>
          </View>
        </View>

        {/* Mode toggle */}
        <Pressable
          style={[styles.modeButton, erase && styles.modeButtonActive]}
          onPress={() => setErase(!erase)}
        >
          <Icon name={erase ? 'eraser' : 'paintbrush'} size={16} color={colors.acento} />
          <Text style={styles.modeButtonText}>{erase ? 'Borrador ativado' : 'Pincel ativo'}</Text>
        </Pressable>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          <Pressable style={styles.actionButton} onPress={handleClear}>
            <Icon name="trash2" size={16} color={colors.texto} />
            <Text style={styles.actionButtonText}>Limpar</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={handleInvert}>
            <Icon name="layers" size={16} color={colors.texto} />
            <Text style={styles.actionButtonText}>Inverter</Text>
          </Pressable>
        </View>

        {/* Apply button */}
        <Pressable style={styles.applyButton} onPress={handleApply}>
          <Icon name="check" size={16} color={colors.acento} />
          <Text style={styles.applyButtonText}>Aplicar máscara</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '30%',
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.texto,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  canvas: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.linha,
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvasHint: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  controlSection: {
    gap: 8,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.texto,
    fontWeight: '500',
  },
  sliderFake: {
    flexDirection: 'row',
    gap: 8,
  },
  sliderButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.acento,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.texto2,
    borderRadius: 4,
  },
  modeButtonActive: {
    borderColor: colors.acento,
    backgroundColor: colors.acento + '20',
  },
  modeButtonText: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.linha,
    borderRadius: 4,
  },
  actionButtonText: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.acento,
    borderRadius: 4,
  },
  applyButtonText: {
    fontSize: fontSize.sm,
    color: colors.acento,
    fontWeight: '500',
  },
});
