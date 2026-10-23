import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { errorLogger } from '@core/reliability';
import { t } from '@core/i18n';
import type { Project } from '@modules/projects';
import { primaryAsset } from './projectFormat';

// expo-sharing takes one file per call; these are the types it is told about, others are left to the OS.
const SHAREABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']);

/** Shares the project's primary media file. Only meaningful for a single project. */
export async function shareProject(project: Project): Promise<void> {
  try {
    const asset = primaryAsset(project);
    if (!asset) throw new Error(`Project ${project.id} has no media asset`);
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(
        t('Compartilhamento indisponível'),
        t('Este aparelho não permite compartilhar arquivos.')
      );
      return;
    }
    const mimeType = SHAREABLE_MIME_TYPES.has(asset.metadata.mimeType)
      ? asset.metadata.mimeType
      : undefined;
    await Sharing.shareAsync(asset.workingUri || asset.originalUri, {
      mimeType,
      dialogTitle: project.name,
    });
  } catch (error) {
    errorLogger.log(error, 'ProjectsScreen.shareProject');
    Alert.alert(t('Não foi possível compartilhar'), t('Tente novamente.'));
  }
}
