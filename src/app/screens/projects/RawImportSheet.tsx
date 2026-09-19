import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { createProjectsModule, type Project } from '@modules/projects';
import { pickImageFromGallery } from '@modules/device-media';
import { RAW_FORMATS } from '@modules/photo-editor/raw';

interface RawImportResult {
  sourceUri: string;
  sourceName: string;
  rawFormatLabel: string;
  rawMimeType: string;
}

interface RawImportSheetProps {
  onClose: () => void;
  onConfirm: (result: RawImportResult) => void;
}

/**
 * RF-003: RAW import entry point. A real camera never puts a .CR3/.NEF file where a JS app
 * can decode its sensor data without a native RAW library, so "importing" here means
 * picking the file (from the device's own gallery, via expo-image-picker) and tagging it
 * with the camera format it represents — the converter then works on that real file's
 * embedded preview, same as any non-RAW-aware viewer would.
 */
export function RawImportSheet({ onClose, onConfirm }: RawImportSheetProps) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [formatIndex, setFormatIndex] = useState(0);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    createProjectsModule()
      .listProjects.execute({ type: 'photo' })
      .then((all) => setProjects(all.filter((p) => p.thumbnailUri || p.assets[0]?.originalUri)))
      .catch(() => setProjects([]));
  }, []);

  const pickFromDevice = async () => {
    setPicking(true);
    try {
      const picked = await pickImageFromGallery();
      if (!picked) return;
      setPickedUri(picked.uri);
      setPickedName(picked.fileName ?? 'Arquivo importado');
      setSelectedProject(null);
    } catch (error) {
      if (error instanceof Error && error.message === 'PERMISSION_DENIED') {
        Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para importar um RAW.');
      } else {
        Alert.alert('Não foi possível importar', 'Tente novamente.');
      }
    } finally {
      setPicking(false);
    }
  };

  const confirm = () => {
    const format = RAW_FORMATS[formatIndex];
    if (pickedUri) {
      onConfirm({
        sourceUri: pickedUri,
        sourceName: pickedName ?? 'Arquivo importado',
        rawFormatLabel: format.label,
        rawMimeType: format.mimeType,
      });
      return;
    }
    if (!selectedProject) return;
    const uri = selectedProject.thumbnailUri ?? selectedProject.assets[0]?.originalUri;
    if (!uri) return;
    onConfirm({
      sourceUri: uri,
      sourceName: selectedProject.name,
      rawFormatLabel: format.label,
      rawMimeType: format.mimeType,
    });
  };

  const hasSource = !!pickedUri || !!selectedProject;

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Importar RAW</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="x" size={18} />
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Formato da câmera</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {RAW_FORMATS.map((f, i) => (
          <Pressable
            key={f.extension}
            style={[styles.chip, i === formatIndex && styles.chipActive]}
            onPress={() => setFormatIndex(i)}
          >
            <Text style={[styles.chipText, i === formatIndex && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Origem</Text>
      <Pressable
        style={[styles.deviceButton, pickedUri && styles.deviceButtonActive]}
        onPress={pickFromDevice}
        disabled={picking}
      >
        {picking ? (
          <ActivityIndicator size="small" color={colors.acento} />
        ) : pickedUri ? (
          <Image source={{ uri: pickedUri }} style={styles.deviceThumb} />
        ) : (
          <Icon name="upload" size={16} color={colors.texto} />
        )}
        <Text style={styles.deviceButtonText} numberOfLines={1}>
          {pickedUri ? pickedName : 'Escolher arquivo da galeria do dispositivo'}
        </Text>
      </Pressable>

      <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Ou de um projeto existente</Text>
      <ScrollView contentContainerStyle={styles.grid}>
        {projects === null && <Text style={styles.hint}>Carregando projetos…</Text>}
        {projects !== null && projects.length === 0 && (
          <Text style={styles.hint}>Nenhuma imagem disponível.</Text>
        )}
        {projects?.map((p) => {
          const uri = p.thumbnailUri ?? p.assets[0]?.originalUri;
          const active = !pickedUri && selectedProject?.id === p.id;
          return (
            <Pressable
              key={p.id}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => {
                setSelectedProject(p);
                setPickedUri(null);
              }}
            >
              <Image
                source={{ uri }}
                style={[styles.itemThumb, active && styles.itemThumbActive]}
              />
              <Text style={styles.itemName} numberOfLines={1}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        style={[styles.confirmButton, !hasSource && styles.confirmButtonDisabled]}
        onPress={confirm}
        disabled={!hasSource}
      >
        <Text style={styles.confirmButtonText}>ABRIR CONVERSOR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '30%',
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: fontSize.md,
    color: colors.texto,
    fontWeight: '500',
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.texto2,
    marginTop: 8,
    marginBottom: 6,
  },
  chipRow: {
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  chipActive: {
    borderColor: colors.acento,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  chipTextActive: {
    color: colors.acento,
  },
  deviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  deviceButtonActive: {
    borderColor: colors.acento,
  },
  deviceThumb: {
    width: 28,
    height: 28,
  },
  deviceButtonText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 12,
  },
  item: {
    width: 84,
    gap: 4,
  },
  itemActive: {},
  itemThumb: {
    width: 84,
    height: 84,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  itemThumbActive: {
    borderColor: colors.acento,
    borderWidth: 2,
  },
  itemName: {
    fontSize: 9,
    color: colors.texto2,
    textAlign: 'center',
  },
  confirmButton: {
    height: 40,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#0D2036',
  },
});
