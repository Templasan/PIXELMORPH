import { HistorySnapshot } from './HistoryStore';

/** Port: where an editing session's undo/redo log is persisted. */
export interface HistoryRepository {
  load(sessionId: string): Promise<HistorySnapshot | null>;
  save(sessionId: string, snapshot: HistorySnapshot): Promise<void>;
  clear(sessionId: string): Promise<void>;
}
