import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppCompositionRoot } from '../app/CompositionRoot';
import { createPhotoEditorModule } from '@modules/photo-editor';
import { createMediaAsset, createMediaMetadata, createProject } from '@modules/projects';
import type { ProjectPriority } from '@modules/projects';

const SEEDED_KEY = 'preview:seeded:v4';
const PHOTOS = 'http://localhost:5175/media/';
const DAY = 86_400_000;

interface Sample {
  id: string;
  name: string;
  file?: string;
  video?: boolean;
  size?: [number, number];
  ageDays: number;
  dueInDays?: number;
  priority?: ProjectPriority;
}

const SAMPLES: Sample[] = [
  {
    id: 'preview-photo-1',
    name: 'Praia',
    file: 'photo.jpg',
    size: [1600, 1200],
    ageDays: 0,
    dueInDays: 2,
    priority: 'high',
  },
  {
    id: 'preview-photo-2',
    name: 'Retrato vertical',
    file: 'i03-9x16-1080x1920.png',
    size: [1080, 1920],
    ageDays: 1,
  },
  {
    id: 'preview-video-1',
    name: 'Vídeo da câmera',
    video: true,
    size: [1920, 1080],
    ageDays: 1,
    dueInDays: 5,
    priority: 'medium',
  },
  {
    id: 'preview-photo-3',
    name: 'Foto 50 MP',
    file: 'i02-huge-6000x4000.jpg',
    size: [6000, 4000],
    ageDays: 2,
  },
  {
    id: 'preview-photo-4',
    name: 'Foto girada',
    file: 'exif6-1600x1200.jpg',
    size: [1600, 1200],
    ageDays: 3,
  },
  {
    id: 'preview-video-2',
    name: 'Time-lapse',
    video: true,
    size: [1080, 1920],
    ageDays: 4,
    dueInDays: -1,
    priority: 'low',
  },
  { id: 'preview-photo-5', name: 'Logo', file: 'logo.png', size: [512, 512], ageDays: 5 },
  {
    id: 'preview-photo-6',
    name: 'Quadrado',
    file: 'i05-1x1-320.png',
    size: [320, 320],
    ageDays: 6,
  },
  {
    id: 'preview-photo-7',
    name: 'Arquivo perdido',
    file: 'nao-existe.jpg',
    size: [1200, 800],
    ageDays: 9,
  },
  {
    id: 'preview-photo-8',
    name: 'Um nome de projeto bem comprido para testar o corte',
    file: 'photo.jpg',
    size: [1600, 1200],
    ageDays: 12,
  },
];

// Enough older projects to fill several months and an earlier year.
const OLDER_FILES = ['photo.jpg', 'exif6-1600x1200.jpg', 'i03-9x16-1080x1920.png', 'logo.png'];
const OLDER_SAMPLES: Sample[] = Array.from({ length: 60 }, (_, i) => ({
  id: `preview-old-${i}`,
  name: `Projeto ${i + 1}`,
  file: OLDER_FILES[i % OLDER_FILES.length],
  ageDays: 14 + i * 9,
}));

/** Fills the browser's storage once with sample projects, through the app's real repository. */
export async function seedPreviewProjects(force = false): Promise<void> {
  if (!force && (await AsyncStorage.getItem(SEEDED_KEY))) return;
  const { repository } = AppCompositionRoot.projects;
  for (const existing of await repository.findAll()) await repository.delete(existing.id);
  for (const s of [...SAMPLES, ...OLDER_SAMPLES]) {
    const uri = s.video ? `http://localhost:5174/media/${s.id}.mp4` : `${PHOTOS}${s.file}`;
    const [width, height] = s.size ?? [1600, 1200];
    const asset = createMediaAsset(
      `${s.id}-asset`,
      s.video ? 'video' : 'image',
      uri,
      uri,
      createMediaMetadata(s.video ? 'video/mp4' : 'image/jpeg', {
        width,
        height,
        durationMs: s.video ? 18_000 : undefined,
        fileSizeBytes: width * height,
      })
    );
    const updatedAt = new Date(Date.now() - s.ageDays * DAY);
    await repository.create({
      ...createProject(s.id, s.name, s.video ? 'video' : 'photo'),
      assets: [asset],
      createdAt: updatedAt,
      updatedAt,
      dueDate: s.dueInDays === undefined ? undefined : new Date(Date.now() + s.dueInDays * DAY),
      priority: s.priority,
    });
  }
  const { savePreset, listPresets } = createPhotoEditorModule();
  if ((await listPresets.execute()).length === 0) {
    await savePreset.execute('Praia quente', { temperatura: 12, saturacao: 25, vibracao: 8 });
    await savePreset.execute('Preto e branco', { saturacao: -100, contraste: 15 });
  }
  await AsyncStorage.setItem(SEEDED_KEY, '1');
}
