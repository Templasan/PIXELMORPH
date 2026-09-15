import AsyncStorage from '@react-native-async-storage/async-storage';
import { HistoryRepository } from './HistoryRepository';
import { HistorySnapshot } from './HistoryStore';

const KEY_PREFIX = 'history:';

/**
 * Persists undo/redo logs to AsyncStorage — this is what makes RF-027 survive closing
 * and reopening a project, and doubles as the RNF-005 autosave mechanism: every push
 * writes through immediately, so there is no separate "save" step to forget.
 */
export class LocalHistoryRepository implements HistoryRepository {
  async load(sessionId: string): Promise<HistorySnapshot | null> {
    const json = await AsyncStorage.getItem(`${KEY_PREFIX}${sessionId}`);
    if (!json) return null;
    try {
      const parsed = JSON.parse(json) as HistorySnapshot;
      if (!Array.isArray(parsed.past) || !Array.isArray(parsed.future)) return null;
      return parsed;
    } catch {
      // Corrupted history is non-fatal — the editor just starts a fresh log.
      return null;
    }
  }

  async save(sessionId: string, snapshot: HistorySnapshot): Promise<void> {
    await AsyncStorage.setItem(`${KEY_PREFIX}${sessionId}`, JSON.stringify(snapshot));
  }

  async clear(sessionId: string): Promise<void> {
    await AsyncStorage.removeItem(`${KEY_PREFIX}${sessionId}`);
  }
}
