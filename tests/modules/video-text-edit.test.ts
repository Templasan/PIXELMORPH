import {
  captionName,
  createTextClip,
  movedCentre,
  pinchedSize,
  videoFrameRect,
} from '../../src/app/screens/video-editor/textEdit';
import {
  DEFAULT_TEXT,
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
} from '../../src/modules/video-editor/domain/textCaption';

describe('text editing helpers', () => {
  it('maps the frame as the engine draws it: full width, 16:9, centred vertically', () => {
    expect(videoFrameRect({ width: 360, height: 600 })).toEqual({
      left: 0,
      top: (600 - 202.5) / 2,
      width: 360,
      height: 202.5,
    });
  });

  it('moves the centre in frame fractions and keeps it on the frame', () => {
    expect(movedCentre({ x: 0.5, y: 0.5 }, 0.2, -0.1)).toEqual({ x: 0.7, y: 0.4 });
    expect(movedCentre({ x: 0.9, y: 0.1 }, 1, -1)).toEqual({ x: 1, y: 0 });
  });

  it('scales the size by the pinch and clamps it', () => {
    expect(pinchedSize(0.1, 2)).toBeCloseTo(0.2);
    expect(pinchedSize(0.1, 100)).toBe(MAX_TEXT_SIZE);
    expect(pinchedSize(0.1, 0.001)).toBe(MIN_TEXT_SIZE);
  });

  it('names a text clip by its content, one line, at most 20 characters', () => {
    expect(captionName('  Olá\n   mundo  ')).toBe('Olá mundo');
    expect(captionName('x'.repeat(40))).toHaveLength(20);
    expect(captionName('   ')).toBe('Texto');
  });

  it('creates a 3 s text clip with the default look and no source', () => {
    const clip = createTextClip('#123456');
    expect(clip.sourceUri).toBe('');
    expect(clip.outPointMs - clip.inPointMs).toBe(3000);
    expect(clip.text).toEqual(DEFAULT_TEXT);
    expect(clip.text).not.toBe(DEFAULT_TEXT);
  });
});
