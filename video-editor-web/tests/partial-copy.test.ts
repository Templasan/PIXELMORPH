import { describe, expect, it } from 'vitest';
import { pastPartialCopy, readableMs } from '../src/domain/partialCopy';
import { createClip, type Track } from '../src/domain/Track';

const clip = createClip({ name: 'a', sourceUri: 'a.mp4', color: '#fff', startMs: 1000, sourceDurationMs: 60_000 });
const tracks: Track[] = [{ id: 'v', name: 'v', kind: 'video', visible: true, locked: false, clips: [clip] }];
const partial = { 'a.mp4': { file: 'tmp', progress: 50 } };

describe('pastPartialCopy', () => {
  it('leaves out the tail still being written', () => {
    expect(readableMs(60_000, 50)).toBe(27_000);
    expect(readableMs(60_000, 1)).toBe(0);
  });
  it('stops at what the copy has reached, in source time', () => {
    expect(pastPartialCopy(tracks, 1000 + 26_000, partial)).toBe(false);
    expect(pastPartialCopy(tracks, 1000 + 27_000, partial)).toBe(true);
  });
  it('ignores other files and times outside the clip', () => {
    expect(pastPartialCopy(tracks, 500, partial)).toBe(false);
    expect(pastPartialCopy(tracks, 1000 + 40_000, {})).toBe(false);
  });
});
