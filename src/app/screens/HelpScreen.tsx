import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, SideDrawer } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Help'>;

// TODO: replace with a real, searchable FAQ backend.
const FAQS = [
  {
    q: 'Como recupero um projeto corrompido?',
    a: 'Abra Armazenamento e toque em Verificar integridade dos projetos. O app restaura a partir do backup automático mais recente.',
  },
  { q: 'Por que meu vídeo 4K trava na linha do tempo?', a: '' },
  { q: 'As edições com IA saem do meu aparelho?', a: '' },
  { q: 'Posso usar meus presets em outro dispositivo?', a: '' },
  { q: 'Como exporto mantendo as camadas?', a: '' },
  { q: 'O que é a assinatura digital nas edições publicadas?', a: '' },
];

const SHORTCUTS = [
  { gesture: 'dois dedos, um toque', action: 'Desfazer' },
  { gesture: 'dois dedos, dois toques', action: 'Refazer' },
  { gesture: 'manter pressionado', action: 'Ver imagem original' },
  { gesture: 'deslizar para cima', action: 'Trocar de ferramenta' },
  { gesture: 'toque duplo', action: 'Aplicar último preset' },
];

const SUPPORT = [
  { label: 'Reportar um problema', sub: 'Envia os registros locais junto, se você permitir' },
  { label: 'Sugerir uma melhoria', sub: '' },
  { label: 'Falar com o suporte', sub: 'Seg a sex, 9h às 18h' },
];

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

export default function HelpScreen({ navigation }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [search, setSearch] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setDrawerOpen(true)} hitSlop={8}>
          <Icon name="menu" size={22} />
        </Pressable>
        <Text style={styles.topBarTitle}>Ajuda</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <Icon name="search" size={16} color={colors.texto2} />
            {/* TODO: real full-text search across FAQs/support content. */}
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar na ajuda"
              placeholderTextColor={colors.texto2}
              style={styles.searchInput}
            />
          </View>
        </View>

        <View style={styles.promoSection}>
          <View style={styles.promoCard}>
            <Icon name="bookOpen" size={20} color={colors.acento} />
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>Prefere aprender fazendo?</Text>
              <Text style={styles.promoSubtitle}>
                Cinco tutoriais interativos com projetos de exemplo
              </Text>
              <Pressable onPress={() => navigation.navigate('Tutorials')}>
                <Text style={styles.promoLink}>Abrir tutoriais</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <SectionHeader label="PERGUNTAS FREQUENTES" />
        <View style={styles.bordered}>
          {FAQS.map((item, i) => (
            <View key={item.q} style={styles.faqItem}>
              <Pressable
                style={styles.faqHeader}
                onPress={() => setExpanded(expanded === i ? null : i)}
              >
                <Text style={styles.faqQuestion}>{item.q}</Text>
                <Icon
                  name={expanded === i ? 'chevronUp' : 'chevronDown'}
                  size={16}
                  color={colors.texto2}
                />
              </Pressable>
              {expanded === i && item.a ? <Text style={styles.faqAnswer}>{item.a}</Text> : null}
            </View>
          ))}
        </View>

        <SectionHeader label="ATALHOS RÁPIDOS" />
        <View style={styles.bordered}>
          {SHORTCUTS.map((s) => (
            <View key={s.gesture} style={styles.shortcutRow}>
              <Text style={styles.shortcutGesture}>{s.gesture}</Text>
              <Text style={styles.shortcutAction}>{s.action}</Text>
            </View>
          ))}
        </View>

        <SectionHeader label="SUPORTE" />
        <View style={styles.bordered}>
          {SUPPORT.map((item) => (
            // TODO: wire up real report/suggest/contact-support flows.
            <Pressable
              key={item.label}
              style={[styles.supportRow, item.sub && styles.supportRowTall]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.supportLabel}>{item.label}</Text>
                {item.sub ? <Text style={styles.supportSub}>{item.sub}</Text> : null}
              </View>
              <Icon name="chevronRight" size={16} color={colors.linha} />
            </Pressable>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigation={navigation}
        current="Help"
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
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.texto,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.texto2,
  },
  bordered: {
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  searchSection: {
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
    paddingHorizontal: 12,
    height: 40,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.texto,
    padding: 0,
  },
  promoSection: {
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  promoCard: {
    backgroundColor: colors.painel,
    borderLeftWidth: 3,
    borderLeftColor: colors.acento,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  promoTitle: {
    fontSize: fontSize.md,
    color: colors.texto,
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginBottom: 10,
  },
  promoLink: {
    fontSize: fontSize.sm,
    color: colors.acento,
    fontWeight: '500',
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    fontSize: fontSize.sm,
    color: colors.texto2,
    lineHeight: 20,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    gap: 16,
  },
  shortcutGesture: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
    flex: 1,
  },
  shortcutAction: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  supportRowTall: {
    paddingVertical: 10,
  },
  supportLabel: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  supportSub: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginTop: 2,
  },
});
