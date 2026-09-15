import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, Tabs } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';

const TABS = ['Recorte', 'Retrato', 'Sugestões', 'Artístico'] as const;
type AITab = (typeof TABS)[number];

const ACTIONS = ['Remover fundo', 'Substituir fundo', 'Remover objeto', 'Preencher área'];
// TODO: replace with the real dominant-palette extraction from the current photo.
const DOMINANT_COLORS = ['#3A5F8A', '#C4A86B', '#7BA3C2', '#8B7355', '#E8D5B0'];

/** IA drawer. All actions below are placeholders — no on-device model is wired up yet. */
export function AIDrawer() {
  const [tab, setTab] = useState<AITab>('Recorte');

  return (
    <View>
      <View style={styles.tabsRow}>
        <View style={{ flex: 1 }}>
          <Tabs tabs={TABS} active={tab} onChange={setTab} scrollable />
        </View>
        <View style={styles.onDeviceBadge}>
          <View style={styles.onDeviceDot} />
          <Text style={styles.onDeviceText}>No dispositivo</Text>
        </View>
      </View>
      <View style={styles.actionGrid}>
        {ACTIONS.map((a) => (
          // TODO: hook up the real on-device model (background removal, inpainting, etc.).
          <Pressable key={a} style={styles.actionButton}>
            <Icon name="zap" size={16} color={colors.acento} />
            <Text style={styles.actionText}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.sceneSection}>
        <View style={styles.sceneRow}>
          <Text style={styles.sceneLabel}>Cena detectada:</Text>
          {/* TODO: real scene-detection result instead of this static chip. */}
          <View style={styles.sceneChip}>
            <Text style={styles.sceneChipText}>Praia ao pôr do sol</Text>
          </View>
        </View>
        <View style={styles.paletteRow}>
          {DOMINANT_COLORS.map((c) => (
            <View key={c} style={styles.paletteItem}>
              <View style={[styles.paletteSwatch, { backgroundColor: c }]} />
              <Text style={styles.paletteHex}>{c}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    paddingRight: 12,
  },
  onDeviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onDeviceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.ok,
  },
  onDeviceText: {
    fontSize: 10,
    color: colors.ok,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
    paddingHorizontal: 12,
  },
  actionButton: {
    width: '47%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  sceneSection: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  sceneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sceneLabel: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  sceneChip: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(58,143,222,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(58,143,222,0.4)',
  },
  sceneChipText: {
    fontSize: fontSize.xs,
    color: colors.acento,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 4,
  },
  paletteItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  paletteSwatch: {
    width: '100%',
    height: 20,
  },
  paletteHex: {
    fontFamily: monoFontFamily,
    fontSize: 9,
    color: colors.texto2,
  },
});
