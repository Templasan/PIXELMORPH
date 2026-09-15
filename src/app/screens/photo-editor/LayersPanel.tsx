import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, Slider } from '@core/ui';
import { colors, fontSize } from '@core/theme';

interface LayerDef {
  key: string;
  name: string;
  type: string;
  img: string;
  locked?: boolean;
  group?: boolean;
  child?: boolean;
}

// TODO: replace with the real layer stack for the open project.
const LAYER_DEFS: LayerDef[] = [
  { key: 'texto', name: 'Texto', type: 'Texto', img: 'photo-1611532736597-de2d4265fba3' },
  { key: 'pintura', name: 'Pintura à mão', type: 'Normal', img: 'photo-1558618666-fcd25c85cd64' },
  {
    key: 'efeitos',
    name: 'Efeitos',
    type: 'Grupo',
    img: 'photo-1504701954957-2010ec3bcec1',
    group: true,
  },
  {
    key: 'vinheta',
    name: 'Vinheta',
    type: 'Efeito',
    img: 'photo-1507525428034-b723cf961d3e',
    child: true,
  },
  {
    key: 'granulado',
    name: 'Granulado',
    type: 'Efeito',
    img: 'photo-1469474968028-56623f02e42e',
    child: true,
  },
  { key: 'mascara', name: 'Máscara céu', type: 'Máscara', img: 'photo-1507525428034-b723cf961d3e' },
  {
    key: 'ajustes',
    name: 'Ajustes de cor',
    type: 'Ajuste',
    img: 'photo-1531746020798-e6953c6e8e04',
  },
  {
    key: 'fundo',
    name: 'Fundo',
    type: 'Normal',
    img: 'photo-1507525428034-b723cf961d3e',
    locked: true,
  },
];

const ACTIONS = [
  { title: 'Adicionar', symbol: '+', danger: false },
  { title: 'Duplicar', symbol: '⧉', danger: false },
  { title: 'Mesclar visíveis', symbol: '⊕', danger: false },
  { title: 'Agrupar', symbol: '▣', danger: false },
  { title: 'Excluir', symbol: '✕', danger: true },
];

interface LayersPanelProps {
  visibility: Record<string, boolean>;
  onToggleVisibility: (key: string) => void;
  groupExpanded: boolean;
  onToggleGroup: () => void;
  opacity: number;
  onOpacityChange: (value: number) => void;
}

/** Camadas panel: 220px side panel (not a bottom drawer), per spec. Eyes really toggle visibility. */
export function LayersPanel({
  visibility,
  onToggleVisibility,
  groupExpanded,
  onToggleGroup,
  opacity,
  onOpacityChange,
}: LayersPanelProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Camadas</Text>
      </View>
      <View style={styles.actionBar}>
        {ACTIONS.map(({ title, symbol, danger }) => (
          // TODO: implement add/duplicate/merge/group/delete layer actions.
          <Pressable key={title} style={styles.actionButton}>
            <Text style={[styles.actionSymbol, danger && styles.actionSymbolDanger]}>{symbol}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={{ flex: 1 }}>
        {LAYER_DEFS.map((layer) => {
          if (layer.child && !groupExpanded) return null;
          const visible = visibility[layer.key] ?? true;
          return (
            <View
              key={layer.key}
              style={[styles.row, layer.child && styles.rowChild, !visible && { opacity: 0.4 }]}
            >
              <Pressable onPress={() => onToggleVisibility(layer.key)} hitSlop={6}>
                <Icon
                  name={visible ? 'eye' : 'eyeOff'}
                  size={13}
                  color={visible ? colors.icone : colors.linha}
                />
              </Pressable>
              {layer.group && (
                <Pressable onPress={onToggleGroup} hitSlop={6}>
                  <Text style={styles.groupCaret}>{groupExpanded ? '▾' : '▸'}</Text>
                </Pressable>
              )}
              <Image
                source={{
                  uri: `https://images.unsplash.com/${layer.img}?w=52&h=52&fit=crop&auto=format`,
                }}
                style={[styles.layerThumb, !visible && { opacity: 0.3 }]}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.layerName, !visible && styles.layerNameDim]} numberOfLines={1}>
                  {layer.name}
                </Text>
                <Text style={styles.layerType}>{layer.type}</Text>
              </View>
              {layer.locked && <Icon name="lock" size={11} color={colors.texto2} />}
            </View>
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
              value={opacity}
              min={0}
              max={100}
              onChange={onOpacityChange}
              labelWidth={0}
            />
          </View>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Modo</Text>
          {/* TODO: real blend-mode picker (Normal, Multiply, Screen, etc.). */}
          <View style={styles.modeBox}>
            <Text style={styles.modeText}>Normal</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  rowChild: {
    paddingLeft: 22,
  },
  groupCaret: {
    fontSize: 8,
    color: colors.texto2,
  },
  layerThumb: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: colors.linha,
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
  modeBox: {
    flex: 1,
    fontSize: fontSize.xs,
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  modeText: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
});
