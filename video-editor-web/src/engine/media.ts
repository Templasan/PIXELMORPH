import {
  ALL_FORMATS,
  BlobSource,
  Input,
  CustomSource,
  VideoSampleSink,
} from 'mediabunny';
import { BlockReader } from './blockReader';
import { Feed } from './feed';

/** How the engine reads a source file that is not reachable by URL (the app's large files). */
export interface FileReader {
  getFileSize(uri: string): Promise<number>;
  readChunk(uri: string, offset: number, length: number): Promise<Uint8Array>;
}

const STREAM_BLOCK = 1024 * 1024;
/** Decoded pictures kept at once: a stop-motion has dozens, a 48 MP photo is huge. */
const MAX_BITMAPS = 12;

/** Reads a URL whole; XHR, not fetch: the app's WebView serves file:// only to XHR. */
export function fetchBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', uri);
    x.responseType = 'blob';
    x.onload = () =>
      (x.status === 0 || x.status === 200) && x.response
        ? resolve(x.response as Blob)
        : reject(new Error(`could not read ${uri} (status ${x.status})`));
    x.onerror = () => reject(new Error(`could not read ${uri}`));
    x.send();
  });
}

/**
 * Opened sources, decoder slots and decoded pictures. Files up to `streamAboveBytes` are read
 * whole (fast seeks); larger ones stream through `reader` when one is given.
 */
export class MediaPool {
  private inputs = new Map<string, Promise<Input>>();
  private feeds = new Map<string, Promise<Feed>>();
  private bitmaps = new Map<string, Promise<ImageBitmap | null>>();
  private bitmapReady = new Map<string, ImageBitmap>();
  /** Files in use outside the timeline (being probed before their clip exists): never pruned. */
  private pinned = new Map<string, number>();

  /** Runs `fn` with `uri` kept open even though no clip uses it yet. */
  async withPinned<T>(uri: string, fn: () => Promise<T>): Promise<T> {
    this.pinned.set(uri, (this.pinned.get(uri) ?? 0) + 1);
    try {
      return await fn();
    } finally {
      const n = (this.pinned.get(uri) ?? 1) - 1;
      if (n > 0) this.pinned.set(uri, n);
      else this.pinned.delete(uri);
    }
  }

  constructor(
    private readonly reader: FileReader | null = null,
    private readonly streamAboveBytes = Infinity
  ) {}

  input(uri: string): Promise<Input> {
    let p = this.inputs.get(uri);
    if (!p) {
      p = this.open(uri);
      this.inputs.set(uri, p);
      p.catch(() => this.inputs.delete(uri)); // a failed open can be retried
    }
    return p;
  }

  private async open(uri: string): Promise<Input> {
    const size = this.reader ? await this.reader.getFileSize(uri).catch(() => 0) : 0;
    if (!this.reader || size <= this.streamAboveBytes) {
      return new Input({ source: new BlobSource(await fetchBlob(uri)), formats: ALL_FORMATS });
    }
    const reader = this.reader;
    const blocks = new BlockReader({
      size,
      blockSize: STREAM_BLOCK,
      fetchBlock: (offset, length) => reader.readChunk(uri, offset, length),
    });
    const source = new CustomSource({
      getSize: () => size,
      prefetchProfile: 'fileSystem',
      read: (start, end) => blocks.read(start, end),
    });
    return new Input({ source, formats: ALL_FORMATS });
  }

  /** The decoder slot `key` reading `uri` (one per clip and role, see composition.ts). */
  feed(key: string, uri: string): Promise<Feed> {
    const id = `${key}|${uri}`;
    let p = this.feeds.get(id);
    if (!p) {
      p = (async () => {
        const track = await (await this.input(uri)).getPrimaryVideoTrack();
        if (!track) throw new Error(`no video track in ${uri}`);
        return new Feed(key, new VideoSampleSink(track));
      })();
      this.feeds.set(id, p);
      p.catch(() => this.feeds.delete(id));
    }
    return p;
  }

  /** A feed that already exists (no opening): what the live loop may draw from this frame. */
  readyFeeds = new Map<string, Feed>();

  async feedReady(key: string, uri: string): Promise<Feed> {
    const f = await this.feed(key, uri);
    this.readyFeeds.set(`${key}|${uri}`, f);
    return f;
  }

  liveFeed(key: string, uri: string): Feed | undefined {
    return this.readyFeeds.get(`${key}|${uri}`);
  }

  picture(uri: string, width: number): Promise<ImageBitmap | null> {
    const key = `${width}|${uri}`;
    let p = this.bitmaps.get(key);
    if (p) {
      this.bitmaps.delete(key); // most recently used last
      this.bitmaps.set(key, p);
      return p;
    }
    p = fetchBlob(uri)
      .then((blob) => createImageBitmap(blob, { resizeWidth: width, resizeQuality: 'high' }))
      .then(
        (bm) => {
          if (this.bitmaps.has(key)) this.bitmapReady.set(key, bm);
          else bm.close(); // evicted while decoding
          return bm;
        },
        () => null
      );
    this.bitmaps.set(key, p);
    while (this.bitmaps.size > MAX_BITMAPS) {
      const oldest = this.bitmaps.keys().next().value as string;
      this.bitmaps.delete(oldest);
      this.bitmapReady.get(oldest)?.close();
      this.bitmapReady.delete(oldest);
    }
    return p;
  }

  /** The picture if decoded; otherwise starts decoding it. */
  pictureNow(uri: string, width: number): ImageBitmap | null {
    const bm = this.bitmapReady.get(`${width}|${uri}`);
    if (!bm) void this.picture(uri, width);
    return bm ?? null;
  }

  /** Closes the decoder slots not in `keep` (keys `slot|uri`), and the files nobody reads. */
  prune(keep: Set<string>, keepUris: Set<string>) {
    for (const [id, p] of this.feeds) {
      if (keep.has(id)) continue;
      this.feeds.delete(id);
      this.readyFeeds.delete(id);
      void p.then((f) => f.dispose()).catch(() => {});
    }
    for (const [uri, p] of this.inputs) {
      if (keepUris.has(uri) || this.pinned.has(uri)) continue;
      this.inputs.delete(uri);
      void p.then((i) => i.dispose()).catch(() => {});
    }
  }

  stats() {
    return { feeds: this.feeds.size, inputs: this.inputs.size, pictures: this.bitmapReady.size };
  }

  dispose() {
    this.prune(new Set(), new Set());
    for (const bm of this.bitmapReady.values()) bm.close();
    this.bitmapReady.clear();
    this.bitmaps.clear();
  }
}
