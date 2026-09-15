import { createMediaAsset, createMediaMetadata, addAssetToProject } from '@modules/projects/domain';
import type { ProjectsModule } from '@modules/projects';

/**
 * First-run demo data so the Projects grid isn't empty before a real capture/import
 * flow exists (Camera capture and RAW import are separate, larger stories). Runs
 * exactly once — guarded by whether the repository already has any project.
 */
export async function seedDemoProjectsIfEmpty(module: ProjectsModule): Promise<void> {
  const existing = await module.listProjects.execute();
  if (existing.length > 0) return;

  const now = Date.now();
  const inDays = (n: number) => new Date(now + n * 24 * 60 * 60 * 1000);

  const seeds = [
    {
      name: 'Ensaio Praia 04',
      type: 'photo' as const,
      img: 'photo-1507525428034-b723cf961d3e',
      mimeType: 'image/jpeg',
      width: 6000,
      height: 4000,
      fileSizeBytes: 44_300_000,
      finished: true,
      dueDate: inDays(2),
      priority: 'high' as const,
    },
    {
      name: 'Viagem Litoral',
      type: 'video' as const,
      img: 'photo-1504700610630-ac6aba3536d3',
      mimeType: 'video/mp4',
      width: 3840,
      height: 2160,
      durationMs: 154_000,
      fileSizeBytes: 210_000_000,
      finished: true,
    },
    {
      name: 'Retrato Marina',
      type: 'photo' as const,
      img: 'photo-1531746020798-e6953c6e8e04',
      mimeType: 'image/vnd.adobe.photoshop',
      width: 4000,
      height: 6000,
      fileSizeBytes: 88_100_000,
      finished: false,
      dueDate: inDays(5),
      priority: 'medium' as const,
    },
    {
      name: 'Feira do Centro',
      type: 'photo' as const,
      img: 'photo-1555396273-367ea4eb4db5',
      mimeType: 'image/jpeg',
      width: 4032,
      height: 3024,
      fileSizeBytes: 6_800_000,
      finished: true,
    },
    {
      name: 'Trilha Serra',
      type: 'video' as const,
      img: 'photo-1510797215324-95aa89f43c33',
      mimeType: 'video/quicktime',
      width: 3840,
      height: 2160,
      durationMs: 312_000,
      fileSizeBytes: 480_000_000,
      finished: false,
      dueDate: inDays(-1),
      priority: 'low' as const,
    },
    {
      name: 'Logo Cliente',
      type: 'photo' as const,
      img: 'photo-1558618666-fcd25c85cd64',
      mimeType: 'image/png',
      width: 2000,
      height: 2000,
      fileSizeBytes: 1_200_000,
      finished: true,
    },
  ];

  for (const seed of seeds) {
    const project = await module.createProject.execute(seed.name, seed.type);

    const uri = `https://images.unsplash.com/${seed.img}?w=1200&fit=crop&auto=format`;
    const metadata = createMediaMetadata(seed.mimeType, {
      width: seed.width,
      height: seed.height,
      durationMs: seed.durationMs,
      fileSizeBytes: seed.fileSizeBytes,
    });
    const asset = createMediaAsset(
      `${project.id}-asset-1`,
      seed.type === 'video' ? 'video' : 'image',
      uri,
      uri,
      metadata
    );

    let withAsset = addAssetToProject(project, asset);
    if (seed.finished) {
      withAsset = { ...withAsset, thumbnailUri: uri };
    }
    if (seed.dueDate) {
      withAsset = { ...withAsset, dueDate: seed.dueDate, priority: seed.priority };
    }

    await module.repository.update(withAsset);
  }
}
