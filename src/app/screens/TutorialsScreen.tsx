import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, SideDrawer } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Tutorials'>;

const TABS = ['TRILHAS', 'POR FERRAMENTA', 'CONCLUÍDOS'] as const;

// TODO: replace with a real tutorials catalog + per-user progress.
const TUTORIALS = [
  {
    id: 1,
    title: 'Céu dramático',
    steps: 7,
    minutes: 4,
    done: 3,
    img: 'photo-1507525428034-b723cf961d3e',
  },
  {
    id: 2,
    title: 'Remover objeto com IA',
    steps: 5,
    minutes: 3,
    done: 0,
    img: 'photo-1558618666-fcd25c85cd64',
  },
  {
    id: 3,
    title: 'Corrigir perspectiva',
    steps: 4,
    minutes: 2,
    done: 0,
    img: 'photo-1504701954957-2010ec3bcec1',
  },
  {
    id: 4,
    title: 'Montar time-lapse',
    steps: 6,
    minutes: 5,
    done: 2,
    img: 'photo-1469474968028-56623f02e42e',
  },
  {
    id: 5,
    title: 'Máscara de céu em retrato',
    steps: 5,
    minutes: 3,
    done: 0,
    img: 'photo-1531746020798-e6953c6e8e04',
  },
];

type Tutorial = (typeof TUTORIALS)[number];

// TODO: real step-by-step content authored per tutorial; this is one shared script.
const STEP_DESCS = [
  {
    title: 'Abrir projeto',
    text: 'Selecione um projeto na tela de Projetos para começar a edição.',
  },
  {
    title: 'Acessar ajustes',
    text: 'Toque no ícone de sliders na barra inferior para abrir os ajustes.',
  },
  {
    title: 'Abrir as máscaras',
    text: 'Toque em Máscaras para pintar um ajuste apenas no céu desta foto.',
  },
  {
    title: 'Selecionar pincéis',
    text: 'Escolha o tamanho e a dureza do pincel para mascarar a área desejada.',
  },
  {
    title: 'Ajustar temperatura',
    text: 'Arraste o slider de temperatura para deixar o céu mais frio.',
  },
  { title: 'Revisar máscara', text: 'Ative "Mostrar máscara" para verificar as bordas pintadas.' },
  { title: 'Exportar', text: 'Toque em Exportar e escolha o formato e resolução.' },
];

function TutorialOverlay({ tutorial, onClose }: { tutorial: Tutorial; onClose: () => void }) {
  const [step, setStep] = useState(tutorial.done > 0 ? tutorial.done - 1 : 0);
  const total = tutorial.steps;
  const desc = STEP_DESCS[step] ?? STEP_DESCS[0];

  return (
    <View style={styles.overlay}>
      {/* TODO: this shows a stock photo instead of the real editor canvas underneath. */}
      <Image
        source={{
          uri: `https://images.unsplash.com/${tutorial.img}?w=780&h=1400&fit=crop&auto=format`,
        }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.overlayVeil} />
      <View pointerEvents="none" style={styles.spotlight} />

      <View style={styles.balloon}>
        <View style={styles.balloonHeader}>
          <Text style={styles.stepCounter}>
            PASSO {step + 1} DE {total}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="x" size={16} color={colors.texto2} />
          </Pressable>
        </View>
        <Text style={styles.stepTitle}>{desc.title}</Text>
        <Text style={styles.stepText}>{desc.text}</Text>
        <View style={styles.progressRow}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[styles.progressSegment, i <= step && styles.progressSegmentActive]}
            />
          ))}
        </View>
        <View style={styles.balloonFooter}>
          <Pressable onPress={onClose}>
            <Text style={styles.skipText}>Pular tutorial</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              disabled={step === 0}
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              style={styles.navButton}
            >
              <Text style={[styles.navButtonText, step === 0 && styles.navButtonTextDisabled]}>
                Anterior
              </Text>
            </Pressable>
            <Pressable
              style={styles.nextButton}
              onPress={() => (step < total - 1 ? setStep((s) => s + 1) : onClose())}
            >
              <Text style={styles.nextButtonText}>
                {step === total - 1 ? 'Concluir' : 'Próximo'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function TutorialsScreen({ navigation }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('TRILHAS');
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);

  const list = activeTab === 'CONCLUÍDOS' ? TUTORIALS.filter((t) => t.done === t.steps) : TUTORIALS;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setDrawerOpen(true)} hitSlop={8}>
          <Icon name="menu" size={22} />
        </Pressable>
        <Text style={styles.topBarTitle}>Tutoriais</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} style={styles.tab} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabLabel, activeTab === t && styles.tabLabelActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
        {list.map((t) => (
          <Pressable key={t.id} style={styles.row} onPress={() => setActiveTutorial(t)}>
            <Image
              source={{
                uri: `https://images.unsplash.com/${t.img}?w=144&h=112&fit=crop&auto=format`,
              }}
              style={styles.thumb}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{t.title}</Text>
              <Text style={styles.rowMeta}>
                {t.steps} passos · {t.minutes} min
                {t.done === 0 && <Text style={styles.notStarted}> · Não iniciado</Text>}
              </Text>
              {t.done > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.doneText}>
                    {t.done} de {t.steps} concluídos
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {Array.from({ length: t.steps }).map((_, i) => (
                      <View key={i} style={[styles.stepBar, i < t.done && styles.stepBarActive]} />
                    ))}
                  </View>
                </View>
              )}
            </View>
            <Icon name="chevronRight" size={16} color={colors.linha} />
          </Pressable>
        ))}
      </ScrollView>

      {activeTutorial && (
        <TutorialOverlay tutorial={activeTutorial} onClose={() => setActiveTutorial(null)} />
      )}

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigation={navigation}
        current="Tutorials"
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  thumb: {
    width: 72,
    height: 56,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  rowTitle: {
    fontSize: fontSize.md,
    color: colors.texto,
    marginBottom: 4,
  },
  rowMeta: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  notStarted: {
    color: colors.ok,
  },
  doneText: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.acento,
    marginBottom: 4,
  },
  stepBar: {
    flex: 1,
    height: 3,
    backgroundColor: colors.linha,
  },
  stepBarActive: {
    backgroundColor: colors.acento,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
  },
  overlayVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.70)',
  },
  spotlight: {
    position: 'absolute',
    left: '50%',
    top: '55%',
    marginLeft: -48,
    marginTop: -48,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.acento,
  },
  balloon: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 160,
    backgroundColor: colors.barra,
    borderWidth: 1,
    borderColor: colors.linha,
    padding: 14,
    paddingBottom: 12,
  },
  balloonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stepCounter: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.texto2,
    letterSpacing: 1,
  },
  stepTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.texto,
    marginBottom: 6,
  },
  stepText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    lineHeight: 18,
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 14,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    backgroundColor: colors.linha,
  },
  progressSegmentActive: {
    backgroundColor: colors.acento,
  },
  balloonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  navButton: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  navButtonText: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  navButtonTextDisabled: {
    color: colors.linha,
  },
  nextButton: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    backgroundColor: colors.acento,
  },
  nextButtonText: {
    fontSize: fontSize.sm,
    color: colors.branco,
  },
});
