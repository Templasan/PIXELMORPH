import { buildInitialTracks } from '../../src/app/screens/video-editor/initialTracks';
import { createMediaAsset, createMediaMetadata, createProject } from '../../src/modules/projects';

function videoProject(audioGain?: number) {
  const asset = createMediaAsset(
    'a1',
    'video',
    'file:///v.mp4',
    'file:///v.mp4',
    createMediaMetadata('video/mp4', { durationMs: 5000, audioGain })
  );
  return { ...createProject('p1', 'Vídeo da câmera', 'video'), assets: [asset] };
}

describe('buildInitialTracks', () => {
  it('a camera recording opens with its sound on A1 at the chosen gain, the video muted', () => {
    const tracks = buildInitialTracks(videoProject(1.5));
    const v1 = tracks.find((t) => t.id === 'v1')!;
    const a1 = tracks.find((t) => t.id === 'a1')!;
    expect(v1.clips[0].volume).toBe(0);
    expect(a1.clips).toHaveLength(1);
    expect(a1.clips[0]).toMatchObject({ sourceUri: 'file:///v.mp4', startMs: 0, volume: 150 });
  });

  it('an imported video keeps its sound on the clip and an empty A1', () => {
    const tracks = buildInitialTracks(videoProject());
    expect(tracks.find((t) => t.id === 'v1')!.clips[0].volume).toBeUndefined();
    expect(tracks.find((t) => t.id === 'a1')!.clips).toHaveLength(0);
  });
});
