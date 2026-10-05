import { HistoryRepository } from './HistoryRepository';
import { HistorySnapshot } from './HistoryStore';

/**
 * Trailing-debounce for history saves: N schedule() calls inside the window become one
 * save of the LATEST snapshot. flush() writes any pending save immediately (unmount,
 * background, session switch) so the last edit is never lost.
 */
export class DebouncedSaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: { sessionId: string; getSnapshot: () => HistorySnapshot } | null = null;

  constructor(
    private readonly repo: Pick<HistoryRepository, 'save'>,
    private readonly delayMs = 600
  ) {}

  schedule(sessionId: string, getSnapshot: () => HistorySnapshot): void {
    // A pending save for another session must not be dropped.
    if (this.pending && this.pending.sessionId !== sessionId) void this.flush();
    this.pending = { sessionId, getSnapshot };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
  }

  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const p = this.pending;
    this.pending = null;
    if (!p) return Promise.resolve();
    return this.repo.save(p.sessionId, p.getSnapshot()).catch(() => {
      // Keep the failed save pending (unless a newer one arrived) and retry later.
      if (!this.pending) {
        this.pending = p;
        this.timer = setTimeout(() => void this.flush(), this.delayMs * 5);
      }
    });
  }
}

/** Flush pending saves whenever the app leaves the foreground. Returns the unsubscribe. */
export function bindAppStateFlush(
  saver: Pick<DebouncedSaver, 'flush'>,
  appState: { addEventListener(type: 'change', cb: (s: string) => void): { remove(): void } }
): () => void {
  const sub = appState.addEventListener('change', (s) => {
    if (s !== 'active') void saver.flush();
  });
  return () => sub.remove();
}
