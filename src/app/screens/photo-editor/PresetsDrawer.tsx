import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';

// TODO: load real saved presets from storage instead of this static list.
const PRESETS = ['Minha edição 1', 'Praia dourada', 'Retrô frio', 'Sépia suave', 'Preto & Branco'];

export function PresetsDrawer() {
  return (
    <View style={{ padding: 12 }}>
      {PRESETS.map((p) => (
        // TODO: apply the real preset to the current photo when tapped.
        <Pressable key={p} style={styles.row}>
          <View style={styles.thumb} />
          <Text style={styles.label}>{p}</Text>
          <Icon name="chevronRight" size={16} color={colors.texto2} />
        </Pressable>
      ))}
      {/* TODO: persist the current adjustment stack as a new named preset. */}
      <Pressable style={styles.saveButton}>
        <Text style={styles.saveButtonText}>+ Salvar ajustes atuais</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  thumb: {
    width: 40,
    height: 40,
    backgroundColor: colors.faixa,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  label: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  saveButton: {
    marginTop: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.acento,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: fontSize.xs,
    color: colors.acento,
  },
});
