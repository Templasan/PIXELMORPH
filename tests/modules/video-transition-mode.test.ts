import { createClip, type Clip, type Track } from '../../src/modules/video-editor/domain/Track';
import { frameAt, planSequence } from '../../src/modules/video-editor/domain/framePlan';
import {
  effectiveMode,
  transitionTransforms,
  type TransitionType,
} from '../../src/modules/video-editor/domain/transitions';

const W = 200;
const at = (type: TransitionType, mode: 'out' | 'in', p: number) =>
  transitionTransforms(type, mode, p, W);

describe('transitionTransforms', () => {
  it.each(['out', 'in'] as const)(
    'fade (%s): the outgoing frame fades, incoming untouched',
    (m) => {
      expect(at('fade', m, 0.5)).toEqual({
        outgoing: { opacity: 0.5, translateX: 0, scale: 1 },
        incoming: { opacity: 1, translateX: 0, scale: 1 },
      });
    }
  );

  it.each([0, 0.5, 1])('zoom grows to 130%% while fading (p=%s), even when "in" is asked', (p) => {
    for (const m of ['out', 'in'] as const) {
      const { outgoing, incoming } = at('zoom', m, p);
      expect(outgoing.opacity).toBeCloseTo(1 - p);
      expect(outgoing.scale).toBeCloseTo(1 + 0.3 * p);
      expect(incoming).toEqual({ opacity: 1, translateX: 0, scale: 1 });
    }
  });

  it('slide out: outgoing leaves left, incoming stays put', () => {
    expect(at('slide', 'out', 0).outgoing.translateX).toBeCloseTo(0);
    expect(at('slide', 'out', 0.5).outgoing.translateX).toBe(-100);
    expect(at('slide', 'out', 1).outgoing.translateX).toBe(-W);
    expect(at('slide', 'out', 0.5).incoming.translateX).toBeCloseTo(0);
  });

  it('wipe out: outgoing leaves right, incoming stays put', () => {
    expect(at('wipe', 'out', 0.5).outgoing.translateX).toBe(100);
    expect(at('wipe', 'out', 1).outgoing.translateX).toBe(W);
    expect(at('wipe', 'out', 0.5).incoming.translateX).toBeCloseTo(0);
  });

  it('slide in: both move left, side by side', () => {
    expect(at('slide', 'in', 0).outgoing.translateX).toBeCloseTo(0);
    expect(at('slide', 'in', 0).incoming.translateX).toBe(W);
    expect(at('slide', 'in', 0.5)).toMatchObject({
      outgoing: { translateX: -100 },
      incoming: { translateX: 100 },
    });
    expect(at('slide', 'in', 1)).toMatchObject({
      outgoing: { translateX: -W },
      incoming: { translateX: 0 },
    });
  });

  it('wipe in: mirrored, both move right', () => {
    expect(at('wipe', 'in', 0).incoming.translateX).toBe(-W);
    expect(at('wipe', 'in', 0.5)).toMatchObject({
      outgoing: { translateX: 100 },
      incoming: { translateX: -100 },
    });
    expect(at('wipe', 'in', 1).incoming.translateX).toBeCloseTo(0);
  });

  it('effectiveMode only allows "in" for slide and wipe', () => {
    expect(effectiveMode('slide', 'in')).toBe('in');
    expect(effectiveMode('wipe', 'in')).toBe('in');
    expect(effectiveMode('zoom', 'in')).toBe('out');
    expect(effectiveMode('slide', undefined)).toBe('out');
  });
});

describe('transition mode in the frame plan', () => {
  const clip = (over: Partial<Clip> & { startMs: number; id: string }): Clip => ({
    ...createClip({
      name: 'c',
      sourceUri: 'file:///a.mp4',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 10_000,
    }),
    outPointMs: 2_000,
    ...over,
  });
  const track = (clips: Clip[]): Track => ({
    id: 'v1',
    name: 'V1',
    kind: 'video',
    visible: true,
    locked: false,
    clips,
  });
  const plan = (type: 'slide' | 'zoom', mode?: 'in' | 'out') =>
    planSequence([
      track([
        clip({ id: 'a', startMs: 0 }),
        clip({ id: 'b', startMs: 2_000, transitionIn: { type, durationMs: 500, mode } }),
      ]),
    ]);

  it('defaults to out, carries "in" to the piece and the frame', () => {
    expect(plan('slide').clips[1].transitionMode).toBe('out');
    const p = plan('slide', 'in');
    expect(p.clips[1].transitionMode).toBe('in');
    expect(frameAt(p, 2_100)?.transition).toMatchObject({ type: 'slide', mode: 'in' });
  });

  it('coerces zoom + in to out', () => {
    expect(plan('zoom', 'in').clips[1].transitionMode).toBe('out');
  });
});
