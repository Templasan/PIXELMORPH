export interface TimedBuffer {
  buffer: AudioBuffer;
  /** Seconds in the source. */
  timestamp: number;
}

/**
 * Joins decoded chunks (~20 ms each) into blocks of about `seconds`. One sound node per chunk was
 * too much for a low-end phone: on a Samsung A11, three tracks slowed the audio clock to 0.88.
 */
export async function* mergedBuffers(
  chunks: AsyncIterable<TimedBuffer>,
  create: (channels: number, frames: number, rate: number) => AudioBuffer,
  seconds: number
): AsyncGenerator<TimedBuffer> {
  let held: TimedBuffer[] = [];
  let heldS = 0;
  const flush = (): TimedBuffer => {
    const first = held[0];
    const frames = held.reduce((n, c) => n + c.buffer.length, 0);
    const out = create(first.buffer.numberOfChannels, frames, first.buffer.sampleRate);
    let at = 0;
    for (const { buffer } of held) {
      for (let ch = 0; ch < out.numberOfChannels; ch += 1) {
        out.copyToChannel(buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)), ch, at);
      }
      at += buffer.length;
    }
    held = [];
    heldS = 0;
    return { buffer: out, timestamp: first.timestamp };
  };
  for await (const chunk of chunks) {
    // A change of format cannot share a buffer.
    if (held.length && (chunk.buffer.sampleRate !== held[0].buffer.sampleRate || chunk.buffer.numberOfChannels !== held[0].buffer.numberOfChannels)) {
      yield flush();
    }
    held.push(chunk);
    heldS += chunk.buffer.duration;
    if (heldS >= seconds) yield flush();
  }
  if (held.length) yield flush();
}
