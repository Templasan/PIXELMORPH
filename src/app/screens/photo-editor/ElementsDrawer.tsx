import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Slider, Tabs } from '@core/ui';
import { colors, fontSize } from '@core/theme';

const TABS = ['Texto', 'Formas', 'Adesivos', 'Meme', 'Colagem'] as const;
type ElementsTab = (typeof TABS)[number];

const FONTS = ['Roboto', 'Montserrat', 'Playfair', 'Bebas', 'Anton'];
const TEXT_COLORS = [colors.texto, colors.acento, colors.perigo, colors.ok, colors.alerta];

/**
 * Elementos drawer. TODO: on-canvas text/shape/sticker placement with drag handles and
 * magenta center-alignment guides is not implemented — this only covers the drawer controls.
 */
export function ElementsDrawer() {
  const [tab, setTab] = useState<ElementsTab>('Texto');
  const [font, setFont] = useState(FONTS[0]);
  const [color, setColor] = useState(TEXT_COLORS[0]);
  const [entrada, setEntrada] = useState(0);
  const [saida, setSaida] = useState(100);

  return (
    <View>
      <Tabs tabs={TABS} active={tab} onChange={setTab} scrollable />
      {tab === 'Texto' && (
        <View style={{ padding: 12 }}>
          <View style={styles.fontRow}>
            {FONTS.map((f) => (
              <Pressable
                key={f}
                style={[styles.fontChip, font === f && styles.fontChipActive]}
                onPress={() => setFont(f)}
              >
                <Text style={[styles.fontChipText, font === f && styles.fontChipTextActive]}>
                  {f}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.colorRow}>
            {TEXT_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  color === c && styles.colorSwatchActive,
                ]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>
          <Text style={styles.sectionLabel}>Animação</Text>
          <Slider label="Entrada" value={entrada} min={0} max={100} onChange={setEntrada} />
          <Slider label="Saída" value={saida} min={0} max={100} onChange={setSaida} />
        </View>
      )}
      {tab === 'Colagem' && (
        <View style={styles.collageGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.collageCard}>
              <View style={[styles.collageCell, i % 2 === 0 && styles.collageCellTall]} />
              <View style={styles.collageCell} />
              {i % 2 !== 0 && <View style={styles.collageCell} />}
            </View>
          ))}
        </View>
      )}
      {(tab === 'Formas' || tab === 'Adesivos' || tab === 'Meme') && (
        <Text style={styles.placeholderText}>Selecione um elemento para inserir no canvas.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fontRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  fontChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  fontChipActive: {
    borderColor: colors.acento,
  },
  fontChipText: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  fontChipTextActive: {
    color: colors.acento,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  colorSwatchActive: {
    borderColor: colors.texto,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginBottom: 6,
  },
  collageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  collageCard: {
    width: '30%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: colors.linha,
    backgroundColor: colors.faixa,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    padding: 4,
  },
  collageCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.linha,
  },
  collageCellTall: {
    minHeight: '100%',
  },
  placeholderText: {
    padding: 16,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
});
