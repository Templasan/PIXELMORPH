import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { Slider } from '@core/ui/Slider';

interface PanoramaImage {
  uri: string;
  id: string;
}

interface PanoramaDrawerProps {
  selectedImages: PanoramaImage[];
  onAddImage: () => void;
  onRemoveImage: (id: string) => void;
  onOffsetChange: (imageIndex: number, offset: number) => void;
  onOverlapChange: (overlap: number) => void;
  onStitch: () => void;
  overlapWidth: number;
  offsets: number[];
  isStitching: boolean;
}

export function PanoramaDrawer({
  selectedImages,
  onAddImage,
  onRemoveImage,
  onOffsetChange,
  onOverlapChange,
  onStitch,
  overlapWidth,
  offsets,
  isStitching,
}: PanoramaDrawerProps) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📸 Imagens</Text>
          <Pressable
            style={styles.addButton}
            onPress={onAddImage}
            disabled={isStitching}
          >
            <Icon name="plus" size={16} color={colors.acento} />
          </Pressable>
        </View>
        {selectedImages.length === 0 ? (
          <Text style={styles.emptyText}>Selecione imagens para iniciar</Text>
        ) : (
          <View style={styles.imageList}>
            {selectedImages.map((img, idx) => (
              <View key={img.id} style={styles.imageItem}>
                <View>
                  <Text style={styles.imageLabel}>Imagem {idx + 1}</Text>
                  {idx < selectedImages.length - 1 && (
                    <View style={styles.offsetControl}>
                      <Text style={styles.offsetLabel}>Deslocamento:</Text>
                      <Text style={styles.offsetValue}>{offsets[idx] || 0}px</Text>
                      <Slider
                        value={offsets[idx] || 0}
                        onValueChange={(val) => onOffsetChange(idx, val)}
                        minimumValue={-200}
                        maximumValue={200}
                        step={5}
                        disabled={isStitching}
                      />
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => onRemoveImage(img.id)}
                  disabled={isStitching}
                >
                  <Icon name="trash" size={14} color={colors.erro} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {selectedImages.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Parâmetros</Text>
          <View style={styles.paramControl}>
            <Text style={styles.paramLabel}>Largura de Sobreposição:</Text>
            <Text style={styles.paramValue}>{overlapWidth}px</Text>
            <Slider
              value={overlapWidth}
              onValueChange={onOverlapChange}
              minimumValue={0}
              maximumValue={200}
              step={5}
              disabled={isStitching}
            />
          </View>
        </View>
      )}

      {selectedImages.length > 1 && (
        <View style={styles.stitchButton}>
          <Pressable
            style={[
              styles.stitchButtonContent,
              isStitching && styles.stitchButtonDisabled,
            ]}
            onPress={onStitch}
            disabled={isStitching}
          >
            <Icon
              name={isStitching ? 'loader' : 'check'}
              size={16}
              color={colors.fundo}
            />
            <Text style={styles.stitchButtonText}>
              {isStitching ? 'Costurando...' : 'Costurar Panorama'}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  section: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    paddingBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.texto,
  },
  addButton: {
    padding: 6,
    borderWidth: 1,
    borderColor: colors.acento,
    borderRadius: 4,
  },
  emptyText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    fontStyle: 'italic',
  },
  imageList: {
    gap: 10,
  },
  imageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 10,
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
    borderRadius: 4,
  },
  imageLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.texto,
    marginBottom: 8,
  },
  offsetControl: {
    marginTop: 8,
  },
  offsetLabel: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginBottom: 4,
  },
  offsetValue: {
    fontFamily: monoFontFamily,
    fontSize: 12,
    color: colors.acento,
    marginBottom: 6,
  },
  paramControl: {
    paddingHorizontal: 8,
  },
  paramLabel: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginBottom: 4,
  },
  paramValue: {
    fontFamily: monoFontFamily,
    fontSize: 12,
    color: colors.acento,
    marginBottom: 8,
  },
  stitchButton: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  stitchButtonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.acento,
    borderRadius: 4,
  },
  stitchButtonDisabled: {
    opacity: 0.6,
  },
  stitchButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.fundo,
  },
});
