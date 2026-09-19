import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, Slider } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import type { EditorLayer } from '@modules/photo-editor/layers';

const KIND_ICON: Record<EditorLayer['kind'], string> = {
  background: 'image',
  adjustments: 'sliders',
  paint: 'wand',
  text: 'type',
  shape: 'triangle',
};

const KIND_LABEL: Record<EditorLayer['kind'], string> = {
  background: 'Normal',
  adjustments: 'Ajuste',
  paint: 'Pintura',
  text: 'Texto',
  shape: 'Forma',
};

interface LayersPanelProps {
  layers: EditorLayer[];
  selectedLayerId: string;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onOpacityChange: (id: string, value: number) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onMergeVisible: () => void;
  onDelete: (id: string) => void;
}

/** Camadas panel (RF-002/RF-052): a real, small layer stack — not mocked layer names. */
export function LayersPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onToggleVisibility,
  onOpacityChange,
  onAdd,
  onDuplicate,
  onMergeVisible,
  onDelete,
}: LayersPanelProps) {
  const selected = layers.find((l) => l.id === selectedLayerId);
  const canDuplicate = !!selected && selected.kind === 'paint';
  const canDelete = !!selected && !selected.locked && selected.kind !== 'background';
  const visiblePaintCount = layers.filter((l) => l.kind === 'paint' && l.visible).length;

  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Camadas</Text>
      </View>
      <View style={styles.actionBar}>
        <Pressable style={styles.actionButton} onPress={onAdd}>
          <Text style={styles.actionSymbol}>+</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => canDuplicate && onDuplicate(selectedLayerId)}
          disabled={!canDuplicate}
        >
          <Text style={[styles.actionSymbol, !canDuplicate && styles.actionSymbolDisabled]}>⧉</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={onMergeVisible}
          disabled={visiblePaintCount < 2}
        >
          <Text style={[styles.actionSymbol, visiblePaintCount < 2 && styles.actionSymbolDisabled]}>
            ⊕
          </Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => canDelete && onDelete(selectedLayerId)}
          disabled={!canDelete}
        >
          <Text
            style={[
              styles.actionSymbol,
              canDelete ? styles.actionSymbolDanger : styles.actionSymbolDisabled,
            ]}
          >
            ✕
          </Text>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {[...layers].reverse().map((layer) => {
          const isSelected = layer.id === selectedLayerId;
          return (
            <Pressable
              key={layer.id}
              onPress={() => onSelectLayer(layer.id)}
              style={[
                styles.row,
                isSelected && styles.rowSelected,
                !layer.visible && { opacity: 0.4 },
              ]}
            >
              <Pressable onPress={() => onToggleVisibility(layer.id)} hitSlop={6}>
                <Icon
                  name={layer.visible ? 'eye' : 'eyeOff'}
                  size={13}
                  color={layer.visible ? colors.icone : colors.linha}
                />
              </Pressable>
              <View style={styles.layerThumb}>
                <Icon name={KIND_ICON[layer.kind]} size={14} color={colors.texto2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.layerName, !layer.visible && styles.layerNameDim]}
                  numberOfLines={1}
                >
                  {layer.name}
                </Text>
                <Text style={styles.layerType}>
                  {KIND_LABEL[layer.kind]}
                  {layer.kind === 'paint' ? ` · ${layer.strokes?.length ?? 0} traços` : ''}
                </Text>
              </View>
              {layer.locked && <Icon name="lock" size={11} color={colors.texto2} />}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel} numberOfLines={1}>
            Opacidade
          </Text>
          <View style={{ flex: 1 }}>
            <Slider
              label=""
              value={selected?.opacity ?? 100}
              min={0}
              max={100}
              onChange={(v) => onOpacityChange(selectedLayerId, v)}
              labelWidth={0}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const PANEL_WIDTH = 220;

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: colors.barra,
    borderLeftWidth: 1,
    borderLeftColor: colors.linha,
    zIndex: 20,
  },
  titleRow: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  title: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.texto2,
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    backgroundColor: colors.faixa,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 3,
  },
  actionSymbol: {
    fontSize: 13,
    color: colors.icone,
  },
  actionSymbolDanger: {
    color: colors.perigo,
  },
  actionSymbolDisabled: {
    color: colors.linha,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  rowSelected: {
    backgroundColor: colors.faixa,
  },
  layerThumb: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerName: {
    fontSize: 10,
    color: colors.texto,
  },
  layerNameDim: {
    color: colors.texto2,
  },
  layerType: {
    fontSize: 9,
    color: colors.texto2,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    padding: 8,
    gap: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerLabel: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    width: 64,
    flexShrink: 0,
  },
});
