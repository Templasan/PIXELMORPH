import { describe, expect, it } from 'vitest';
import { mergedBuffers, type TimedBuffer } from '../src/engine/audioMerge';

class FakeBuffer {
  private data: Float32Array[];
  constructor(readonly numberOfChannels: number, readonly length: number, readonly sampleRate: number) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  getChannelData(ch: number) {
    return this.data[ch];
  }
  copyToChannel(source: Float32Array, ch: number, at: number) {
    this.data[ch].set(source, at);
  }
}

const chunk = (timestamp: number, value: number, rate = 100): TimedBuffer => {
  const buffer = new FakeBuffer(1, 10, rate);
  buffer.getChannelData(0).fill(value);
  return { buffer: buffer as unknown as AudioBuffer, timestamp };
};
const collect = async (chunks: TimedBuffer[], seconds: number) => {
  async function* source() {
    yield* chunks;
  }
  const out: TimedBuffer[] = [];
  const create = (c: number, f: number, r: number) => new FakeBuffer(c, f, r) as unknown as AudioBuffer;
  for await (const m of mergedBuffers(source(), create, seconds)) out.push(m);
  return out;
};

describe('mergedBuffers', () => {
  it('joins chunks in order, starting at the first one, and keeps the rest', async () => {
    const out = await collect([chunk(1, 1), chunk(1.1, 2), chunk(1.2, 3)], 0.2);
    expect(out.map((m) => [m.timestamp, m.buffer.length])).toEqual([[1, 20], [1.2, 10]]);
    expect(out[0].buffer.getChannelData(0)[0]).toBe(1);
    expect(out[0].buffer.getChannelData(0)[10]).toBe(2);
  });
  it('never mixes two sample rates in one block', async () => {
    const out = await collect([chunk(0, 1, 100), chunk(0.1, 2, 200)], 10);
    expect(out.map((m) => m.buffer.sampleRate)).toEqual([100, 200]);
  });
});
