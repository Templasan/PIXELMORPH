import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * In-memory write-through cache for a JSON array kept under one AsyncStorage key.
 * Read once; every read/mutation is queued on one promise chain so concurrent
 * read-modify-write cycles never lose updates. Items are the JSON form (dates as strings).
 * ponytail: assumes this process is the only writer of the key.
 */
export class JsonListCache {
  private cache: any[] | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  private static registry = new Map<string, JsonListCache>();

  /** One instance per key: several repository instances over the same key share one cache. */
  constructor(private readonly key: string) {
    const existing = JsonListCache.registry.get(key);
    if (existing) return existing;
    JsonListCache.registry.set(key, this);
  }

  /** Drop cached data for a key (call after clearing/restoring AsyncStorage behind our back). */
  static async invalidate(key: string): Promise<void> {
    await JsonListCache.registry.get(key)?.drop();
  }

  static async invalidateAll(): Promise<void> {
    await Promise.all([...JsonListCache.registry.values()].map((c) => c.drop()));
  }

  private drop(): Promise<void> {
    return this.enqueue(async () => {
      this.cache = null;
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async ensure(): Promise<any[]> {
    if (this.cache) return this.cache;
    const json = await AsyncStorage.getItem(this.key);
    let parsed: any[] = [];
    try {
      const v = json ? JSON.parse(json) : [];
      if (Array.isArray(v)) parsed = v;
    } catch {
      // Corrupt data is non-fatal: start empty.
    }
    return (this.cache = parsed);
  }

  /** Snapshot of the items, after any queued writes. */
  read(): Promise<any[]> {
    return this.enqueue(async () => [...(await this.ensure())]);
  }

  /** Apply fn to the current items and persist the result; cache updates only on success. */
  mutate(fn: (items: any[]) => any[]): Promise<void> {
    return this.enqueue(async () => {
      const next = JSON.parse(JSON.stringify(fn([...(await this.ensure())])));
      await AsyncStorage.setItem(this.key, JSON.stringify(next));
      this.cache = next;
    });
  }

  clear(): Promise<void> {
    return this.enqueue(async () => {
      await AsyncStorage.removeItem(this.key);
      this.cache = [];
    });
  }
}
