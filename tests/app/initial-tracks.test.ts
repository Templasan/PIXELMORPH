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
  it('a stop-motion plays at the rate picked in the camera', () => {
    const frame = (i: number, frameMs?: number) =>
      createMediaAsset(
        `f${i}`,
        'image',
        `file:///${i}.jpg`,
        `file:///${i}.jpg`,
        createMediaMetadata('image/jpeg', { frameMs })
      );
    const project = {
      ...createProject('p1', 'Stop-motion', 'video'),
      assets: [frame(0, 100), frame(1, 100), frame(2, 100)],
    };
    const clips = buildInitialTracks(project).find((t) => t.id === 'img')!.clips;
    expect(clips.map((c) => c.startMs)).toEqual([0, 100, 200]);
    expect(clips.every((c) => c.outPointMs - c.inPointMs === 100)).toBe(true);
  });

  it('a stop-motion saved before the rate was stored keeps its old speed', () => {
    const asset = createMediaAsset(
      'f',
      'image',
      'file:///f.jpg',
      'file:///f.jpg',
      createMediaMetadata('image/jpeg')
    );
    const project = { ...createProject('p1', 'Stop-motion', 'video'), assets: [asset] };
    expect(buildInitialTracks(project).find((t) => t.id === 'img')!.clips[0].outPointMs).toBe(200);
  });

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
