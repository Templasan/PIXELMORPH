import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, SideDrawer } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Presets'>;

const TABS = ['MEUS PRESETS', 'DA COMUNIDADE'] as const;

interface Preset {
  id: number;
  name: string;
  adjustments: number;
  uses: number;
  img: string;
  details: { label: string; value: string }[];
}

// TODO: replace with the real saved-presets list from storage.
const PRESETS: Preset[] = [
  {
    id: 1,
    name: 'Praia Quente',
    adjustments: 6,
    uses: 23,
    img: 'photo-1507525428034-b723cf961d3e',
    details: [
      { label: 'Temperatura', value: '+12' },
      { label: 'Saturação', value: '+25' },
      { label: 'Vibração', value: '+8' },
      { label: 'Exposição', value: '-0,3' },
      { label: 'Vinheta', value: '40' },
      { label: 'Granulado', value: '15' },
    ],
  },
  {
    id: 2,
    name: 'Preto e Branco',
    adjustments: 3,
    uses: 11,
    img: 'photo-1531746020798-e6953c6e8e04',
    details: [
      { label: 'Saturação', value: '-100' },
      { label: 'Contraste', value: '+15' },
      { label: 'Vinheta', value: '25' },
    ],
  },
  {
    id: 3,
    name: 'Retrô 400',
    adjustments: 8,
    uses: 7,
    img: 'photo-1469474968028-56623f02e42e',
    details: [
      { label: 'Temperatura', value: '+8' },
      { label: 'Saturação', value: '-25' },
      { label: 'Contraste', value: '+12' },
      { label: 'Exposição', value: '+0,2' },
      { label: 'Desvanecer', value: '20' },
      { label: 'Vinheta', value: '30' },
      { label: 'Granulado', value: '40' },
      { label: 'Matiz', value: '+5' },
    ],
  },
  {
    id: 4,
    name: 'Alto Contraste',
    adjustments: 4,
    uses: 4,
    img: 'photo-1504700610630-ac6aba3536d3',
    details: [
      { label: 'Contraste', value: '+50' },
      { label: 'Exposição', value: '-0,5' },
      { label: 'Realces', value: '-30' },
      { label: 'Sombras', value: '+20' },
    ],
  },
  {
    id: 5,
    name: 'Pele Suave',
    adjustments: 5,
    uses: 19,
    img: 'photo-1558618666-fcd25c85cd64',
    details: [
      { label: 'Temperatura', value: '+5' },
      { label: 'Saturação', value: '-10' },
      { label: 'Suavidade', value: '60' },
      { label: 'Clareza', value: '-15' },
      { label: 'Exposição', value: '+0,1' },
    ],
  },
  {
    id: 6,
    name: 'Luz Dourada',
    adjustments: 7,
    uses: 15,
    img: 'photo-1555396273-367ea4eb4db5',
    details: [
      { label: 'Temperatura', value: '+22' },
      { label: 'Tinta', value: '+4' },
      { label: 'Exposição', value: '+0,3' },
      { label: 'Realces', value: '-20' },
      { label: 'Saturação', value: '+18' },
      { label: 'Vibração', value: '+12' },
      { label: 'Vinheta', value: '20' },
    ],
  },
];

const CONTEXT_ACTIONS = ['Renomear', 'Duplicar', 'Exportar'];

export default function PresetsScreen({ navigation }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('MEUS PRESETS');
  const [contextPreset, setContextPreset] = useState<Preset | null>(null);
  const [sheetPreset, setSheetPreset] = useState<Preset | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setDrawerOpen(true)} hitSlop={8}>
          <Icon name="menu" size={22} />
        </Pressable>
        <Text style={styles.topBarTitle}>Presets</Text>
        {/* TODO: real preset search. */}
        <Icon name="search" size={20} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} style={styles.tab} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabLabel, activeTab === t && styles.tabLabelActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
        {PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            style={styles.card}
            onPress={() => setSheetPreset(preset)}
            onLongPress={() => setContextPreset(preset)}
          >
            {/* TODO: real per-pixel preset preview instead of a plain stock photo. */}
            <Image
              source={{
                uri: `https://images.unsplash.com/${preset.img}?w=360&h=200&fit=crop&auto=format`,
              }}
              style={styles.cardThumb}
            />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{preset.name}</Text>
              <Text style={styles.cardMeta}>
                {preset.adjustments} ajustes · usado {preset.uses}x
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* TODO: real "create preset from current adjustments" flow. */}
      <Pressable style={styles.fab}>
        <Icon name="plus" size={16} color={colors.branco} />
        <Text style={styles.fabText}>Novo preset</Text>
      </Pressable>

      {contextPreset && (
        <Pressable style={styles.modalOverlay} onPress={() => setContextPreset(null)}>
          <Pressable style={styles.contextMenu}>
            <Text style={styles.contextMenuTitle}>{contextPreset.name}</Text>
            {CONTEXT_ACTIONS.map((label) => (
              // TODO: implement rename/duplicate/export actions.
              <Pressable
                key={label}
                style={styles.contextMenuItem}
                onPress={() => setContextPreset(null)}
              >
                <Text style={styles.contextMenuItemText}>{label}</Text>
              </Pressable>
            ))}
            {/* TODO: implement delete with confirmation. */}
            <Pressable style={styles.contextMenuItemLast} onPress={() => setContextPreset(null)}>
              <Text style={styles.contextMenuDelete}>Excluir</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {sheetPreset && (
        <Pressable style={styles.modalOverlay} onPress={() => setSheetPreset(null)}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{sheetPreset.name}</Text>
              <Pressable onPress={() => setSheetPreset(null)} hitSlop={8}>
                <Icon name="x" size={18} color={colors.texto2} />
              </Pressable>
            </View>
            <View style={{ paddingVertical: 8 }}>
              {sheetPreset.details.map((d) => (
                <View key={d.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{d.label}</Text>
                  <Text style={styles.detailValue}>{d.value}</Text>
                </View>
              ))}
            </View>
            <View style={styles.sheetFooter}>
              {/* TODO: real "apply to a media" flow. */}
              <Pressable style={styles.sheetButtonSecondary} onPress={() => setSheetPreset(null)}>
                <Text style={styles.sheetButtonSecondaryText}>Aplicar a uma mídia</Text>
              </Pressable>
              {/* TODO: real batch-apply flow. */}
              <Pressable style={styles.sheetButtonPrimary} onPress={() => setSheetPreset(null)}>
                <Text style={styles.sheetButtonPrimaryText}>Aplicar em lote</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigation={navigation}
        current="Presets"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topBar: {
    height: 52,
    backgroundColor: colors.barra,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  topBarTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.texto,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.barra,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  tab: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: colors.texto2,
  },
  tabLabelActive: {
    color: colors.acento,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
  },
  card: {
    width: '47%',
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  cardThumb: {
    height: 100,
    width: '100%',
  },
  cardInfo: {
    padding: 8,
    paddingHorizontal: 10,
  },
  cardName: {
    fontSize: fontSize.sm,
    color: colors.texto,
    marginBottom: 3,
  },
  cardMeta: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: colors.acento,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fabText: {
    fontSize: fontSize.sm,
    color: colors.branco,
    fontWeight: '500',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.veu,
    zIndex: 50,
  },
  contextMenu: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 200,
    marginLeft: -100,
    marginTop: -100,
    backgroundColor: colors.barra,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  contextMenuTitle: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    fontSize: fontSize.md,
    color: colors.texto,
    fontWeight: '500',
  },
  contextMenuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  contextMenuItemLast: {
    padding: 16,
  },
  contextMenuItemText: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  contextMenuDelete: {
    fontSize: fontSize.md,
    color: colors.perigo,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  sheetHeader: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.texto,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  detailLabel: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  detailValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.md,
    color: colors.acento,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 20,
  },
  sheetButtonSecondary: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetButtonSecondaryText: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  sheetButtonPrimary: {
    flex: 1,
    height: 40,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetButtonPrimaryText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.branco,
  },
});
