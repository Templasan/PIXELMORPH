import AsyncStorage from '@react-native-async-storage/async-storage';
import { HistoryRepository } from './HistoryRepository';
import { HistorySnapshot } from './HistoryStore';

const KEY_PREFIX = 'history:';
/**
 * Unlimited history (RF-027) can outgrow one AsyncStorage value — the video editor records a
 * whole timeline per edit — and Android fails to read values above ~2 MB. A large log is stored
 * in parts of this many characters under `history:<id>#<generation>.<n>`, and the main key holds
 * `{ "gen": ..., "parts": n }`. Small logs stay a single value, exactly as before.
 */
export const HISTORY_PART_CHARS = 256 * 1024;

const mainKey = (sessionId: string) => `${KEY_PREFIX}${sessionId}`;
const partKey = (sessionId: string, gen: string, i: number) =>
  `${KEY_PREFIX}${sessionId}#${gen}.${i}`;

interface PartsIndex {
  gen: string;
  parts: number;
}

function isPartsIndex(value: unknown): value is PartsIndex {
  const v = value as PartsIndex;
  return !!v && typeof v.gen === 'string' && typeof v.parts === 'number';
}

/** Keys of every stored part of `sessionId`, any generation (for deletion). */
export async function historyPartKeys(sessionId: string): Promise<string[]> {
  const prefix = `${KEY_PREFIX}${sessionId}#`;
  return (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
}

/**
 * Persists undo/redo logs to AsyncStorage — this is what makes RF-027 survive closing
 * and reopening a project, and doubles as the RNF-005 autosave mechanism: every push
 * writes through immediately, so there is no separate "save" step to forget.
 */
export class LocalHistoryRepository implements HistoryRepository {
  /** Saves are serialized: overlapping part writes could leave the index on deleted parts. */
  private writes: Promise<void> = Promise.resolve();

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.writes.then(task);
    this.writes = run.catch(() => undefined);
    return run;
  }

  async load(sessionId: string): Promise<HistorySnapshot | null> {
    const stored = await AsyncStorage.getItem(mainKey(sessionId));
    if (!stored) return null;
    try {
      let parsed: unknown = JSON.parse(stored);
      if (isPartsIndex(parsed)) {
        const { gen, parts } = parsed;
        const keys = Array.from({ length: parts }, (_, i) => partKey(sessionId, gen, i));
        const values = await AsyncStorage.multiGet(keys);
        if (values.some(([, v]) => v == null)) return null;
        parsed = JSON.parse(values.map(([, v]) => v).join(''));
      }
      const snapshot = parsed as HistorySnapshot;
      if (!Array.isArray(snapshot.past) || !Array.isArray(snapshot.future)) return null;
      return snapshot;
    } catch {
      // Corrupted history is non-fatal — the editor just starts a fresh log.
      return null;
    }
  }

  save(sessionId: string, snapshot: HistorySnapshot): Promise<void> {
    return this.enqueue(() => this.write(sessionId, snapshot));
  }

  private async write(sessionId: string, snapshot: HistorySnapshot): Promise<void> {
    const json = JSON.stringify(snapshot);
    const previous = await historyPartKeys(sessionId);
    let keep = '';
    if (json.length <= HISTORY_PART_CHARS) {
      await AsyncStorage.setItem(mainKey(sessionId), json);
    } else {
      // A fresh generation of parts, then the index that points at it: until the index is
      // written, the previous index still points at the previous (untouched) parts.
      const gen = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const parts: [string, string][] = [];
      for (let i = 0; i * HISTORY_PART_CHARS < json.length; i++) {
        const chunk = json.slice(i * HISTORY_PART_CHARS, (i + 1) * HISTORY_PART_CHARS);
        parts.push([partKey(sessionId, gen, i), chunk]);
      }
      await AsyncStorage.multiSet(parts);
      const index: PartsIndex = { gen, parts: parts.length };
      await AsyncStorage.setItem(mainKey(sessionId), JSON.stringify(index));
      keep = `${KEY_PREFIX}${sessionId}#${gen}.`;
    }
    const stale = previous.filter((k) => !keep || !k.startsWith(keep));
    if (stale.length) await AsyncStorage.multiRemove(stale);
  }

  clear(sessionId: string): Promise<void> {
    return this.enqueue(async () => {
      await AsyncStorage.multiRemove([mainKey(sessionId), ...(await historyPartKeys(sessionId))]);
    });
  }
}
