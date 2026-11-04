import { captionClips, speechErrorText } from '../src/application/speechCaptions';
import { createClip, type Clip } from '../src/domain/Track';

const clip = (over: Partial<Clip> = {}): Clip => ({
  ...createClip({ name: 'v', sourceUri: 'file:///v.mp4', color: '#000', startMs: 1000, sourceDurationMs: 20000, outPointMs: 10000 }),
  ...over,
});
const seg = (startMs: number, endMs: number, text: string) => ({ startMs, endMs, text });

describe('captionClips', () => {
  it('places each line where it was said, as an editable text clip', () => {
    const [a, b] = captionClips([seg(0, 2000, ' Olá, mundo'), seg(2000, 3500, 'Até já')], clip(), '#fff');
    expect([a.startMs, a.outPointMs, a.text?.content]).toEqual([1000, 2000, 'Olá, mundo']);
    expect([b.startMs, b.outPointMs, b.text?.content]).toEqual([3000, 1500, 'Até já']);
    expect(a.sourceUri).toBe('');
  });

  it('follows the speed of the clip', () => {
    const [a] = captionClips([seg(2000, 4000, 'rápido')], clip({ speed: 2 }), '#fff');
    expect([a.startMs, a.outPointMs]).toEqual([2000, 1000]);
  });

  it('skips what is not speech', () => {
    const none = [seg(0, 1000, '[BLANK_AUDIO]'), seg(1000, 2000, ' (aplausos) '), seg(2000, 3000, '[Música]'), seg(3000, 4000, ' ♪ ♪ '), seg(4000, 5000, '  ')];
    expect(captionClips(none, clip(), '#fff')).toEqual([]);
  });

  it('never overlaps two lines, and stops at the end of the clip', () => {
    const made = captionClips([seg(0, 2000, 'a'), seg(1500, 3000, 'b'), seg(9500, 12000, 'c'), seg(10000, 11000, 'd')], clip(), '#fff');
    expect(made.map((c) => c.text?.content)).toEqual(['a', 'b', 'c']);
    expect(made[1].startMs).toBe(3000);
    expect(made[2].startMs + made[2].outPointMs).toBe(11000);
  });

  it('keeps a very short line readable', () => {
    expect(captionClips([seg(0, 50, 'é')], clip(), '#fff')[0].outPointMs).toBe(300);
  });
});

describe('speechErrorText', () => {
  it('has words for what the app reports, and for what it did not expect', () => {
    expect(speechErrorText('NO_AUDIO')).not.toBe(speechErrorText('NETWORK'));
    expect(speechErrorText('anything else')).toBe(speechErrorText('FAILED'));
  });
});
