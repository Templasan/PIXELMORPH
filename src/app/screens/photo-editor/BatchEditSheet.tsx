import { useEffect, useState } from 'react';
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
import { createProjectsModule } from '@modules/projects';
import type { Preset } from '@modules/photo-editor/domain/Preset';

interface BatchEditSheetProps {
  projectId: string;
  currentAdjustments: Record<string, number>;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BatchEditSheet({
  projectId,
  currentAdjustments,
  onClose,
  onSuccess,
}: BatchEditSheetProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [applying, setApplying] = useState(false);

  const photoMod = createPhotoEditorModule();
  const projectsMod = createProjectsModule();

  useEffect(() => {
    photoMod.listPresets
      .execute()
      .then(setPresets)
      .finally(() => setLoadingPresets(false));
  }, [photoMod]);

  const applyPresetBatch = async (adjustments: Record<string, number>) => {
    setApplying(true);
    try {
      const project = await projectsMod.getProject.execute(projectId);
      if (!project) {
        Alert.alert('Erro', 'Projeto não encontrado');
        return;
      }

      const assetIds = project.assets.map((a) => a.id);
      await projectsMod.applyAdjustmentsBatch.execute(projectId, assetIds, adjustments);

      Alert.alert('Sucesso', `Ajustes aplicados a ${assetIds.length} fotos`);
      onSuccess?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Erro', `Não foi possível aplicar: ${message}`);
    } finally {
      setApplying(false);
    }
  };

  const handleApplyPreset = (preset: Preset) => {
    Alert.alert('Confirmar', `Aplicar "${preset.name}" a todas as fotos do projeto?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aplicar', onPress: () => applyPresetBatch(preset.adjustments) },
    ]);
  };

  const handleApplyCustom = () => {
    Alert.alert('Confirmar', 'Aplicar os ajustes atuais a todas as fotos do projeto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aplicar', onPress: () => applyPresetBatch(currentAdjustments) },
    ]);
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Editar em lote</Text>
        <Pressable onPress={onClose} hitSlop={8} disabled={applying}>
          <Icon name="x" size={18} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Usar preset</Text>
        {loadingPresets ? (
          <ActivityIndicator size="small" color={colors.acento} />
        ) : presets.length === 0 ? (
          <Text style={styles.hint}>Nenhum preset salvo.</Text>
        ) : (
          presets.map((p) => (
            <Pressable
              key={p.id}
              style={styles.presetRow}
              onPress={() => handleApplyPreset(p)}
              disabled={applying}
            >
              <Text style={styles.presetName}>{p.name}</Text>
              <Icon name="chevronRight" size={16} color={colors.texto2} />
            </Pressable>
          ))
        )}

        <Text style={styles.sectionTitle}>Ou usar ajustes atuais</Text>
        <Pressable style={styles.customButton} onPress={handleApplyCustom} disabled={applying}>
          {applying ? (
            <ActivityIndicator size="small" color={colors.acento} />
          ) : (
            <>
              <Icon name="check" size={16} color={colors.acento} />
              <Text style={styles.customButtonText}>Aplicar ajustes atuais</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '40%',
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.texto,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.texto2,
    marginTop: 8,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  presetName: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.acento,
  },
  customButtonText: {
    fontSize: fontSize.sm,
    color: colors.acento,
    fontWeight: '500',
  },
});
