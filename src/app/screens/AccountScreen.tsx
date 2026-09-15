import { ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, Switch } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function ArrowRow({
  label,
  value,
  sub,
  onPress,
}: {
  label: string;
  value?: string;
  sub?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.row, sub && styles.rowTall]} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      <Icon name="chevronRight" size={16} color={colors.linha} />
    </Pressable>
  );
}

function ToggleRow({
  label,
  value,
  sub,
  toggled,
  onToggle,
}: {
  label: string;
  value?: string;
  sub?: string;
  toggled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={[styles.row, sub && styles.rowTall]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      <Switch value={toggled} onChange={onToggle} />
    </View>
  );
}

function Bordered({ children }: { children: ReactNode }) {
  return <View style={styles.bordered}>{children}</View>;
}

export default function AccountScreen({ navigation }: Props) {
  // TODO: back these toggles with the real preference store instead of local component state.
  const [twoFactor, setTwoFactor] = useState(true);
  const [autoSaveDrafts, setAutoSaveDrafts] = useState(true);
  const [unlimitedUndo, setUnlimitedUndo] = useState(true);
  const [onDeviceAI, setOnDeviceAI] = useState(true);
  const [signEdits, setSignEdits] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.navigate('Projects')} hitSlop={8}>
          <Icon name="chevronLeft" size={22} />
        </Pressable>
        <Text style={styles.topBarTitle}>Conta e preferências</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <SectionHeader label="CONTA" />
        <Bordered>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>JS</Text>
            </View>
            <View>
              <Text style={styles.profileName}>João Silva</Text>
              <Text style={styles.profileEmail}>joao@pixelmorph.com</Text>
            </View>
          </View>
          {/* TODO: real change-password flow. */}
          <ArrowRow label="Alterar senha" />
          <ToggleRow
            label="Verificação em duas etapas"
            value="App autenticador"
            toggled={twoFactor}
            onToggle={setTwoFactor}
          />
          {/* TODO: real connected-devices list. */}
          <ArrowRow label="Dispositivos conectados" value="3 ativos" />
        </Bordered>

        <SectionHeader label="IDIOMA" />
        <View style={styles.bordered}>
          {/* TODO: real language picker + on-demand language packs. */}
          <ArrowRow label="Idioma do app" value="Português (Brasil)" />
          <View style={styles.languageNote}>
            <Text style={styles.languageNoteText}>
              Inglês e Espanhol disponíveis. Outros idiomas são baixados sob demanda.
            </Text>
          </View>
        </View>

        <SectionHeader label="EDIÇÃO" />
        <Bordered>
          <ToggleRow
            label="Salvamento automático de rascunhos"
            sub="A cada alteração significativa"
            toggled={autoSaveDrafts}
            onToggle={setAutoSaveDrafts}
          />
          <ToggleRow
            label="Histórico ilimitado de desfazer"
            sub="Preservado entre sessões até excluir o projeto"
            toggled={unlimitedUndo}
            onToggle={setUnlimitedUndo}
          />
          {/* TODO: real preview-quality picker. */}
          <ArrowRow label="Qualidade da pré-visualização" value="Alta" />
        </Bordered>

        <SectionHeader label="PRIVACIDADE" />
        <Bordered>
          <ToggleRow
            label="Processar IA no dispositivo"
            sub="Detecção facial e correções não saem do aparelho"
            toggled={onDeviceAI}
            onToggle={setOnDeviceAI}
          />
          <ToggleRow
            label="Assinar edições publicadas"
            sub="Adiciona nome e data verificáveis, não removíveis"
            toggled={signEdits}
            onToggle={setSignEdits}
          />
        </Bordered>

        <SectionHeader label="SOBRE" />
        <Bordered>
          <View style={styles.versionRow}>
            <Text style={styles.rowLabelFlex}>Versão</Text>
            <Text style={styles.versionValue}>2.4.1</Text>
          </View>
          {/* TODO: real terms / privacy-policy documents. */}
          <ArrowRow label="Termos de uso" />
          <ArrowRow label="Política de privacidade" />
          {/* Dev-only shortcut to the TASK-003 Skia spike, kept for regression testing. */}
          <ArrowRow
            label="Photo Editor Spike (teste técnico)"
            onPress={() => navigation.navigate('PhotoEditorSpike')}
          />
          {/* TODO: real sign-out flow (clear session, navigate to Login). */}
          <Pressable
            style={styles.signOutButton}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
          >
            <Text style={styles.signOutText}>Sair da conta</Text>
          </Pressable>
        </Bordered>
      </ScrollView>
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.branco,
  },
  profileName: {
    fontSize: fontSize.lg,
    color: colors.texto,
    fontWeight: '500',
  },
  profileEmail: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    gap: 8,
  },
  rowTall: {
    paddingVertical: 10,
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  rowLabelFlex: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  rowSub: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginTop: 2,
  },
  rowValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  languageNote: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  languageNoteText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    lineHeight: 18,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  versionValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  signOutButton: {
    margin: 16,
    marginBottom: 24,
    height: 44,
    borderWidth: 1,
    borderColor: colors.perigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.perigo,
  },
});
