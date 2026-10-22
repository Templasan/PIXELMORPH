/**
 * Streaming read of a file that lives on the RN side: fixed-size blocks, a small LRU cache and
 * sequential read-ahead, so Mediabunny's many small reads become few large bridge calls.
 * Pure (the block fetcher is injected), tested in Jest.
 */
export interface BlockReaderOptions {
  fetchBlock: (offset: number, length: number) => Promise<Uint8Array>;
  size: number;
  blockSize?: number;
  /** Blocks kept in memory; blockSize * maxBlocks is the reader's RAM ceiling. */
  maxBlocks?: number;
  /** Blocks fetched ahead after a read that continues the previous one. */
  readAhead?: number;
}

export class BlockReader {
  private readonly blockSize: number;
  private readonly maxBlocks: number;
  private readonly readAhead: number;
  private blocks = new Map<number, Promise<Uint8Array>>(); // insertion order = LRU order
  private lastBlock = -2;
  fetches = 0;
  hits = 0;

  constructor(private readonly o: BlockReaderOptions) {
    this.blockSize = o.blockSize ?? 1024 * 1024;
    this.maxBlocks = o.maxBlocks ?? 24;
    this.readAhead = o.readAhead ?? 2;
  }

  private block(i: number): Promise<Uint8Array> {
    let p = this.blocks.get(i);
    if (p) {
      this.hits += 1;
      this.blocks.delete(i); // re-inserted below: most recently used
    } else {
      this.fetches += 1;
      const offset = i * this.blockSize;
      p = this.o.fetchBlock(offset, Math.min(this.blockSize, this.o.size - offset));
      p.catch(() => this.blocks.delete(i)); // a failed fetch must not stay cached
    }
    this.blocks.set(i, p);
    while (this.blocks.size > this.maxBlocks) {
      this.blocks.delete(this.blocks.keys().next().value as number);
    }
    return p;
  }

  async read(start: number, end: number): Promise<Uint8Array> {
    const end2 = Math.min(end, this.o.size);
    if (end2 <= start) return new Uint8Array(0);
    const first = Math.floor(start / this.blockSize);
    const last = Math.floor((end2 - 1) / this.blockSize);
    const parts = Array.from({ length: last - first + 1 }, (_, k) => this.block(first + k));
    if (first === this.lastBlock || first === this.lastBlock + 1) {
      const maxBlock = Math.floor((this.o.size - 1) / this.blockSize);
      for (let k = 1; k <= this.readAhead && last + k <= maxBlock; k += 1) void this.block(last + k);
    }
    this.lastBlock = last;
    const out = new Uint8Array(end2 - start);
    for (let k = 0; k < parts.length; k += 1) {
      const data = await parts[k];
      const blockStart = (first + k) * this.blockSize;
      const from = Math.max(start, blockStart);
      const to = Math.min(end2, blockStart + data.length);
      out.set(data.subarray(from - blockStart, to - blockStart), from - start);
    }
    return out;
  }
}
