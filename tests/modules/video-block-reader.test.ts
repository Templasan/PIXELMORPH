import { BlockReader } from '../../src/app/screens/video-editor/web-engine/blockReader';

const file = Uint8Array.from({ length: 1000 }, (_, i) => i % 251);
const make = (opts: { blockSize?: number; maxBlocks?: number; readAhead?: number } = {}) => {
  const calls: number[] = [];
  const r = new BlockReader({
    size: file.length,
    blockSize: 100,
    fetchBlock: async (offset, length) => {
      calls.push(offset);
      return file.slice(offset, offset + length);
    },
    ...opts,
  });
  return { r, calls };
};

describe('BlockReader', () => {
  it('returns exact bytes across block boundaries and clamps at the end', async () => {
    const { r } = make({ readAhead: 0 });
    expect(await r.read(95, 310)).toEqual(file.slice(95, 310));
    expect(await r.read(990, 1200)).toEqual(file.slice(990, 1000));
    expect((await r.read(2000, 2100)).length).toBe(0);
  });

  it('serves repeated reads from the cache', async () => {
    const { r, calls } = make({ readAhead: 0 });
    await r.read(0, 50);
    await r.read(10, 90);
    expect(calls).toEqual([0]);
  });

  it('reads ahead only when a read continues the previous one', async () => {
    const { r, calls } = make({ readAhead: 2 });
    await r.read(0, 50); // first read: no read-ahead
    expect(calls).toEqual([0]);
    await r.read(50, 150); // sequential: blocks 0..1 plus 2, 3 ahead
    expect([...calls].sort((a, b) => a - b)).toEqual([0, 100, 200, 300]);
    const { r: r2, calls: c2 } = make({ readAhead: 2 });
    await r2.read(500, 550);
    await r2.read(100, 150); // a jump: no read-ahead
    expect(c2).toEqual([500, 100]);
  });

  it('evicts the least recently used block', async () => {
    const { r, calls } = make({ readAhead: 0, maxBlocks: 2 });
    await r.read(0, 10);
    await r.read(100, 110);
    await r.read(0, 10); // block 0 is now the newest
    await r.read(200, 210); // evicts block 1
    await r.read(0, 10);
    await r.read(100, 110);
    expect(calls).toEqual([0, 100, 200, 100]);
  });

  it('does not cache a failed fetch', async () => {
    let fail = true;
    const r = new BlockReader({
      size: 100,
      blockSize: 100,
      fetchBlock: async () => {
        if (fail) throw new Error('boom');
        return file.slice(0, 100);
      },
    });
    await expect(r.read(0, 10)).rejects.toThrow('boom');
    fail = false;
    expect(await r.read(0, 10)).toEqual(file.slice(0, 10));
  });
});
