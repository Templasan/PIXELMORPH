import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { createPhotoEditorModule } from '@modules/photo-editor';
import type { Preset } from '@modules/photo-editor/domain/Preset';

interface PresetsDrawerProps {
  adjustments: Record<string, number>;
  onApplyPreset: (adjustments: Record<string, number>) => void | Promise<void>;
}

export function PresetsDrawer({ adjustments, onApplyPreset }: PresetsDrawerProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const mod = createPhotoEditorModule();

  useEffect(() => {
    mod.listPresets
      .execute()
      .then(setPresets)
      .finally(() => setLoading(false));
  }, [mod]);

  const handleSavePreset = useCallback(() => {
    Alert.prompt('Nome do preset', 'Como você quer chamar este preset?', (name) => {
      if (!name.trim()) return;
      setSaving(true);
      mod.savePreset
        .execute(name, adjustments)
        .then(() => {
          Alert.alert('Preset salvo com sucesso!');
          return mod.listPresets.execute();
        })
        .then(setPresets)
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          Alert.alert('Erro', `Não foi possível salvar o preset: ${message}`);
        })
        .finally(() => setSaving(false));
    });
  }, [adjustments, mod]);

  const handleApplyPreset = useCallback(
    (preset: Preset) => {
      onApplyPreset(preset.adjustments);
      Alert.alert('Preset aplicado!');
    },
    [onApplyPreset]
  );

  return (
    <View style={{ padding: 12, flex: 1 }}>
      <Text style={styles.title}>Presets salvos</Text>
      {loading ? (
        <ActivityIndicator size="large" color={colors.acento} style={{ marginTop: 20 }} />
      ) : presets.length === 0 ? (
        <Text style={styles.hint}>Nenhum preset salvo ainda.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 8 }}>
          {presets.map((p) => (
            <Pressable key={p.id} style={styles.row} onPress={() => handleApplyPreset(p)}>
              <View style={styles.thumb} />
              <Text style={styles.label}>{p.name}</Text>
              <Icon name="chevronRight" size={16} color={colors.texto2} />
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Pressable style={styles.saveButton} onPress={handleSavePreset} disabled={saving}>
        {saving ? (
          <ActivityIndicator size="small" color={colors.acento} />
        ) : (
          <Text style={styles.saveButtonText}>+ Salvar ajustes atuais</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.texto,
    marginBottom: 12,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.texto2,
    marginTop: 12,
  },
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
