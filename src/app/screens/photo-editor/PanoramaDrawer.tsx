import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';

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
                      <View style={styles.offsetHeader}>
                        <Text style={styles.offsetLabel}>Deslocamento:</Text>
                        <Text style={styles.offsetValue}>{offsets[idx] || 0}px</Text>
                      </View>
                      <View style={styles.offsetButtons}>
                        <Pressable
                          style={styles.adjustButton}
                          onPress={() => onOffsetChange(idx, (offsets[idx] || 0) - 10)}
                          disabled={isStitching}
                        >
                          <Text style={styles.adjustButtonText}>−</Text>
                        </Pressable>
                        <Pressable
                          style={styles.adjustButton}
                          onPress={() => onOffsetChange(idx, (offsets[idx] || 0) + 10)}
                          disabled={isStitching}
                        >
                          <Text style={styles.adjustButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => onRemoveImage(img.id)}
                  disabled={isStitching}
                >
                  <Icon name="trash" size={14} color={colors.perigo} />
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
            <View style={styles.paramHeader}>
              <Text style={styles.paramLabel}>Largura de Sobreposição:</Text>
              <Text style={styles.paramValue}>{overlapWidth}px</Text>
            </View>
            <View style={styles.paramButtons}>
              <Pressable
                style={styles.adjustButton}
                onPress={() => onOverlapChange(Math.max(0, overlapWidth - 10))}
                disabled={isStitching}
              >
                <Text style={styles.adjustButtonText}>−</Text>
              </Pressable>
              <Pressable
                style={styles.adjustButton}
                onPress={() => onOverlapChange(Math.min(200, overlapWidth + 10))}
                disabled={isStitching}
              >
                <Text style={styles.adjustButtonText}>+</Text>
              </Pressable>
            </View>
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
              color={colors.canvas}
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
  offsetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  offsetLabel: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  offsetValue: {
    fontFamily: monoFontFamily,
    fontSize: 12,
    color: colors.acento,
  },
  offsetButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paramControl: {
    paddingHorizontal: 8,
  },
  paramHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paramLabel: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  paramValue: {
    fontFamily: monoFontFamily,
    fontSize: 12,
    color: colors.acento,
  },
  paramButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  adjustButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.linha,
    borderRadius: 4,
    minWidth: 44,
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.texto,
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
    color: colors.canvas,
  },
});
