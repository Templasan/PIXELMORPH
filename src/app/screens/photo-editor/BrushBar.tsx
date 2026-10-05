import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import type { BrushShape } from '@modules/photo-editor';
import { BRUSH_SHAPES } from '@modules/photo-editor';

const BRUSH_COLORS = ['#E5484D', '#F5A623', '#F5D90A', '#30A46C', '#3B82F6', '#FFFFFF', '#000000'];

interface BrushBarProps {
  brushColor: string;
  brushSize: number;
  brushShape: BrushShape;
  brushOpacity: number;
  maxWidth: number;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onShapeChange: (shape: BrushShape) => void;
  onOpacityChange: (opacity: number) => void;
}

export const BrushBar = memo(function BrushBar({
  brushColor,
  brushSize,
  brushShape,
  brushOpacity,
  maxWidth,
  onColorChange,
  onSizeChange,
  onShapeChange,
  onOpacityChange,
}: BrushBarProps) {
  return (
    <>
      <View style={[styles.brushBar, { maxWidth }]}>
        {BRUSH_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => onColorChange(c)}
            style={[
              styles.brushSwatch,
              { backgroundColor: c },
              brushColor === c && styles.brushSwatchActive,
            ]}
          />
        ))}
        <Pressable onPress={() => onSizeChange(Math.max(2, brushSize - 2))} hitSlop={6}>
          <Icon name="minus" size={14} color={colors.texto} />
        </Pressable>
        <Text style={styles.brushSizeText}>{brushSize}px</Text>
        <Pressable onPress={() => onSizeChange(Math.min(40, brushSize + 2))} hitSlop={6}>
          <Icon name="plus" size={14} color={colors.texto} />
        </Pressable>
      </View>

      <View style={[styles.brushBar, { maxWidth }]}>
        {BRUSH_SHAPES.map((shape) => (
          <Pressable
            key={shape.id}
            onPress={() => onShapeChange(shape.id)}
            accessibilityLabel={shape.name}
            style={[styles.brushShapeChip, brushShape === shape.id && styles.brushShapeChipActive]}
          >
            <Text
              numberOfLines={1}
              style={[styles.brushSizeText, brushShape === shape.id && { color: colors.acento }]}
            >
              {shape.glyph}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={() => onOpacityChange(Math.max(10, brushOpacity - 10))} hitSlop={6}>
          <Icon name="minus" size={14} color={colors.texto} />
        </Pressable>
        <Text style={styles.brushSizeText}>{brushOpacity}%</Text>
        <Pressable onPress={() => onOpacityChange(Math.min(100, brushOpacity + 10))} hitSlop={6}>
          <Icon name="plus" size={14} color={colors.texto} />
        </Pressable>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  brushBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(37,37,37,0.92)',
    borderWidth: 1,
    borderColor: colors.linha,
  },
  brushSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  brushSwatchActive: {
    borderColor: colors.acento,
    borderWidth: 2,
  },
  brushShapeChip: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  brushShapeChipActive: {
    borderColor: colors.acento,
  },
  brushSizeText: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto,
    width: 32,
    textAlign: 'center',
  },
});
