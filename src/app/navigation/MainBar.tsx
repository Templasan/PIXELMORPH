import { useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { useI18n } from '@core/i18n';
import { errorLogger } from '@core/reliability';
import { pickFromGallery, probeVideoDurationMs } from '@modules/device-media';
import { createMediaAsset, createMediaMetadata } from '@modules/projects';
import { useAppModules } from '../hooks';
import type { RootStackParamList } from './RootNavigator';

type Destination = 'Projects' | 'Explore';

function BarLink({
  icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = active ? colors.texto : colors.texto2;
  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {active && <View style={styles.activeLine} />}
      <Icon name={icon} size={24} color={color} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

/** The app's main bar: where to go, and the two ways of bringing a new picture in. */
export function MainBar({ active }: { active: Destination }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { projects } = useAppModules();
  const [importing, setImporting] = useState(false);
  const [copying, setCopying] = useState(false);

  // RF-028/US-11: a real device gallery import — creates a project from the file the user
  // actually picked, not a bundled demo asset.
  const importFromGallery = async () => {
    setImporting(true);
    // Only once the picker closes: behind it the spinner drew every frame, 110% of a CPU on a Poco.
    const pickerClosed = AppState.addEventListener('focus', () => setCopying(true));
    try {
      const picked = await pickFromGallery();
      if (!picked) return; // user cancelled

      const name = picked.fileName?.replace(/\.[^./]+$/, '') || 'Importado da galeria';
      const project = await projects.createProjectWithMedia.execute(
        name,
        picked.type === 'video' ? 'video' : 'photo',
        [
          createMediaAsset(
            `asset_${Date.now()}`,
            picked.type,
            picked.uri,
            picked.uri,
            createMediaMetadata(picked.mimeType, {
              width: picked.width || undefined,
              height: picked.height || undefined,
              durationMs:
                picked.type === 'video'
                  ? picked.durationMs || (await probeVideoDurationMs(picked.uri))
                  : undefined,
              fileSizeBytes: picked.fileSizeBytes ?? undefined,
            })
          ),
        ]
      );

      navigation.navigate(picked.type === 'video' ? 'VideoEditor' : 'PhotoEditor', {
        projectId: project.id,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'PERMISSION_DENIED') {
        Alert.alert(
          'Permissão necessária',
          'Autorize o acesso à galeria nas configurações do dispositivo para importar arquivos.'
        );
      } else {
        errorLogger.log(error, 'MainBar.importFromGallery');
        Alert.alert('Não foi possível importar', 'Tente novamente.');
      }
    } finally {
      pickerClosed.remove();
      setCopying(false);
      setImporting(false);
    }
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <Modal visible={copying} transparent statusBarTranslucent animationType="fade">
        <View style={styles.importing}>
          <ActivityIndicator color={colors.texto} size="large" />
          <Text style={styles.importingText}>{t('Importando o arquivo. Um vídeo longo pode levar um minuto.')}</Text>
        </View>
      </Modal>
      <BarLink
        icon="folder"
        label={t('Projetos')}
        active={active === 'Projects'}
        onPress={() => navigation.navigate('Projects')}
      />
      <BarLink
        icon="image"
        label={t('Galeria')}
        disabled={importing}
        onPress={() => void importFromGallery()}
      />
      <Pressable
        style={styles.item}
        onPress={() => navigation.navigate('Camera')}
        accessibilityRole="button"
        accessibilityLabel={t('Câmera')}
      >
        <View style={styles.cameraButton}>
          <Icon name="camera" size={28} color={colors.branco} />
        </View>
      </Pressable>
      <BarLink
        icon="compass"
        label={t('Explorar')}
        active={active === 'Explore'}
        onPress={() => navigation.navigate('Explore')}
      />
      <BarLink icon="user" label={t('Conta')} onPress={() => navigation.navigate('Account')} />
    </View>
  );
}

const styles = StyleSheet.create({
  importing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  importingText: { color: colors.texto, fontSize: fontSize.md, textAlign: 'center' },
  bar: {
    zIndex: 1,
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  item: {
    flex: 1,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  // Rises above the bar; the ring in the page's colour separates it from the list behind.
  cameraButton: {
    width: 64,
    height: 64,
    marginTop: -24,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.acento,
  },
  activeLine: {
    position: 'absolute',
    bottom: 0,
    width: '76%',
    height: 2,
    backgroundColor: colors.texto,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  labelActive: {
    color: colors.texto,
  },
});
