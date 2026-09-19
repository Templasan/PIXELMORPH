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
import { pickFromGallery, pickAudioFromDevice } from '@modules/device-media';

export interface AddClipResult {
  name: string;
  sourceUri: string;
  sourceDurationMs: number;
}

interface AddClipSheetProps {
  trackName: string;
  /** RF-036: an audio track picks a real audio file instead of a photo/video. */
  trackKind?: 'video' | 'image' | 'text' | 'audio';
  onClose: () => void;
  onConfirm: (result: AddClipResult) => void;
}

const DEFAULT_IMAGE_CLIP_MS = 4000;
const DEFAULT_AUDIO_CLIP_MS = 30000;

/** RF-058/RF-036: appends another clip to a track — a real device import, or from the project library. */
export function AddClipSheet({ trackName, trackKind, onClose, onConfirm }: AddClipSheetProps) {
  const isAudio = trackKind === 'audio';
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (isAudio) {
      setProjects([]);
      return;
    }
    createProjectsModule()
      .listProjects.execute()
      .then((all) => setProjects(all.filter((p) => p.thumbnailUri || p.assets[0]?.originalUri)))
      .catch(() => setProjects([]));
  }, [isAudio]);

  const pickFromDevice = async () => {
    setPicking(true);
    try {
      if (isAudio) {
        const picked = await pickAudioFromDevice();
        if (!picked) return;
        onConfirm({
          name: picked.fileName,
          sourceUri: picked.uri,
          sourceDurationMs: DEFAULT_AUDIO_CLIP_MS,
        });
        return;
      }
      const picked = await pickFromGallery();
      if (!picked) return;
      onConfirm({
        name: picked.fileName ?? 'Clipe importado',
        sourceUri: picked.uri,
        sourceDurationMs: picked.durationMs ?? DEFAULT_IMAGE_CLIP_MS,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'PERMISSION_DENIED') {
        Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para importar um clipe.');
      } else {
        Alert.alert('Não foi possível importar', 'Tente novamente.');
      }
    } finally {
      setPicking(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Adicionar clipe · {trackName}</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="x" size={18} />
        </Pressable>
      </View>

      <Pressable style={styles.deviceButton} onPress={pickFromDevice} disabled={picking}>
        {picking ? (
          <ActivityIndicator size="small" color={colors.acento} />
        ) : (
          <Icon name="upload" size={16} color={colors.texto} />
        )}
        <Text style={styles.deviceButtonText}>
          {isAudio ? 'Importar áudio do dispositivo' : 'Importar da galeria do dispositivo'}
        </Text>
      </Pressable>

      {!isAudio && (
        <>
          <Text style={styles.sectionLabel}>Ou de um projeto existente</Text>
          <ScrollView contentContainerStyle={styles.grid}>
            {projects === null && <Text style={styles.hint}>Carregando projetos…</Text>}
            {projects !== null && projects.length === 0 && (
              <Text style={styles.hint}>Nenhum projeto disponível para adicionar.</Text>
            )}
            {projects?.map((p) => {
              const uri = p.thumbnailUri ?? p.assets[0]?.originalUri;
              const asset = p.assets[0];
              return (
                <Pressable
                  key={p.id}
                  style={styles.item}
                  onPress={() =>
                    onConfirm({
                      name: p.name,
                      sourceUri: uri as string,
                      sourceDurationMs: asset?.metadata.durationMs ?? DEFAULT_IMAGE_CLIP_MS,
                    })
                  }
                >
                  <Image source={{ uri }} style={styles.itemThumb} />
                  <Text style={styles.itemName} numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '35%',
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    padding: 12,
    zIndex: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: fontSize.md,
    color: colors.texto,
    fontWeight: '500',
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  deviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
    marginBottom: 8,
  },
  deviceButtonText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.texto2,
    marginBottom: 6,
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
  itemThumb: {
    width: 84,
    height: 84,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  itemName: {
    fontSize: 9,
    color: colors.texto2,
    textAlign: 'center',
  },
});
