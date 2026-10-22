import { createClip, type Track } from '../../src/modules/video-editor/domain/Track';
import {
  captionAt,
  DEFAULT_TEXT,
  type ClipText,
} from '../../src/modules/video-editor/domain/textCaption';
import { buildEditorScene, drawListAt } from '../../src/modules/video-editor/domain/webScene';

const W = 1920;
const H = 1080;
const text = (over: Partial<ClipText> = {}): ClipText => ({
  ...DEFAULT_TEXT,
  content: 'Olá',
  animIn: { type: 'none', ms: 0 },
  animOut: { type: 'none', ms: 0 },
  ...over,
});
// A 2 s text starting at 1 s.
const at = (t: ClipText, ms: number) => captionAt(t, 1_000, 2_000, ms, W, H);

describe('captionAt', () => {
  it('is on screen only during its clip', () => {
    expect(at(text(), 999)).toBeNull();
    expect(at(text(), 1_000)).not.toBeNull();
    expect(at(text(), 3_000)).toBeNull();
  });

  it('places the centre and sizes the font from the frame', () => {
    const s = at(text({ x: 0.5, y: 0.25, size: 0.1 }), 2_000)!;
    expect([s.cx, s.cy, s.fontPx]).toEqual([960, 270, 108]);
  });

  it('fades in and out', () => {
    const t = text({ animIn: { type: 'fade', ms: 400 }, animOut: { type: 'fade', ms: 400 } });
    expect(at(t, 1_200)!.opacity).toBeCloseTo(0.5);
    expect(at(t, 2_000)!.opacity).toBe(1);
    expect(at(t, 2_800)!.opacity).toBeCloseTo(0.5);
  });

  it('slide-left comes in from the right and leaves to the left', () => {
    const t = text({
      animIn: { type: 'slide-left', ms: 500 },
      animOut: { type: 'slide-left', ms: 500 },
    });
    expect(at(t, 1_100)!.cx).toBeGreaterThan(960);
    expect(at(t, 2_000)!.cx).toBe(960);
    expect(at(t, 2_900)!.cx).toBeLessThan(960);
  });

  it('typewriter reveals the letters, then erases them', () => {
    const t = text({
      content: 'abcd',
      animIn: { type: 'typewriter', ms: 400 },
      animOut: { type: 'typewriter', ms: 400 },
    });
    expect(at(t, 1_200)!.text).toBe('ab');
    expect(at(t, 2_000)!.text).toBe('abcd');
    expect(at(t, 2_900)!.text).toBe('a');
  });

  it('on a short clip the in and out animations each get at most half', () => {
    const t = text({ animIn: { type: 'fade', ms: 5_000 }, animOut: { type: 'fade', ms: 5_000 } });
    // 2 s clip: in over 0..1 s, out over 1..2 s; the middle is fully visible.
    expect(at(t, 2_000)!.opacity).toBeCloseTo(1);
  });

  it('empty text draws nothing', () => {
    expect(at(text({ content: '  ' }), 2_000)).toBeNull();
  });
});

describe('captions in the editor scene', () => {
  it('a text-track clip draws a caption on top of the video', () => {
    const video: Track = {
      id: 'v1',
      name: 'V1',
      kind: 'video',
      visible: true,
      locked: false,
      clips: [
        {
          ...createClip({
            name: 'v',
            sourceUri: 'file:///v.mp4',
            color: '#fff',
            startMs: 0,
            sourceDurationMs: 5_000,
          }),
          outPointMs: 5_000,
        },
      ],
    };
    const caption = {
      ...createClip({
        name: 'T',
        sourceUri: '',
        color: '#fff',
        startMs: 1_000,
        sourceDurationMs: 2_000,
      }),
      outPointMs: 2_000,
      text: text({ content: 'Legenda' }),
    };
    const txt: Track = { ...video, id: 'txt', kind: 'text', clips: [caption] };
    const ops = drawListAt(buildEditorScene([video, txt]), 1_500);
    expect(ops.map((o) => o.kind)).toEqual(['clear', 'video', 'caption']);
    expect(ops[2]).toMatchObject({ text: 'Legenda', fontFamily: 'sans-serif' });
    expect(
      drawListAt(buildEditorScene([video, { ...txt, visible: false }]), 1_500).map((o) => o.kind)
    ).toEqual(['clear', 'video']);
  });
});
