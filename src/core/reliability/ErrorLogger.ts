import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../infrastructure/config';

/** Pre-segmentation single-value log; read once to migrate, then removed. */
const LEGACY_LOG_KEY = 'errorLog';
const SEGMENTS_KEY = 'errorLog:segments';
const segmentKey = (id: number) => `errorLog:${id}`;
const REPORT_ENABLED_KEY = 'errorLogReportingEnabled';
const REPORTED_UP_TO_KEY = 'errorLogReportedUpTo';
/** RNF-017: local log is capped at 5 MB, with rotation (oldest entries dropped first). */
export const MAX_LOG_BYTES = 5 * 1024 * 1024;
/**
 * The 5 MB live in segments of this size, each its own AsyncStorage value: on Android, reading
 * a single value above ~2 MB fails (SQLite CursorWindow), which would wedge the log for good.
 */
export const SEGMENT_BYTES = 256 * 1024;

interface Segment {
  id: number;
  bytes: number;
}

export interface LogEntry {
  timestamp: number;
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  context?: string;
}

declare const global: {
  ErrorUtils?: {
    getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
    setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
  };
};

/**
 * Local, rotating error log plus anonymous reporting (RNF-017). Reports go to
 * `CONFIG.errorReportUrl` over HTTPS only; with no URL configured (this repo has no backend,
 * see docs/architecture.md) entries simply stay in the local log.
 */
export class ErrorLogger {
  /** Writes are read-modify-write; chaining them keeps concurrent log() calls from losing entries. */
  private writes: Promise<void> = Promise.resolve();

  log(error: unknown, context?: string, level: LogEntry['level'] = 'error'): Promise<void> {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
    };
    const write = this.writes.then(() => this.append(entry));
    this.writes = write.catch(() => undefined);
    return write;
  }

  async getEntries(): Promise<LogEntry[]> {
    await this.writes;
    const segments = await this.readSegments();
    if (segments.length === 0) return [];
    const pairs = await AsyncStorage.multiGet(segments.map((s) => segmentKey(s.id)));
    return pairs.flatMap(([, json]) => parseEntries(json));
  }

  /** Sum of the segment sizes kept in the index — no need to load the log to measure it. */
  async getSizeBytes(): Promise<number> {
    await this.writes;
    return (await this.readSegments()).reduce((sum, s) => sum + s.bytes, 0);
  }

  async clear(): Promise<void> {
    const run = this.writes.then(async () => {
      const segments = await this.readSegments();
      await AsyncStorage.multiRemove([
        SEGMENTS_KEY,
        LEGACY_LOG_KEY,
        ...segments.map((s) => segmentKey(s.id)),
      ]);
    });
    this.writes = run.catch(() => undefined);
    await run;
  }

  private async append(entry: LogEntry): Promise<void> {
    let segments = await this.readSegments();
    if (segments.length === 0) segments = await this.migrateLegacy();

    const last = segments[segments.length - 1];
    let entries: LogEntry[] = [];
    let target: Segment;
    // A segment only exceeds SEGMENT_BYTES when a single entry is bigger than that on its own.
    const entryBytes = byteLength(JSON.stringify(entry)) + 1;
    if (last && last.bytes + entryBytes <= SEGMENT_BYTES) {
      // An unreadable segment is not the user's data — starting it over beats a wedged log.
      entries = await AsyncStorage.getItem(segmentKey(last.id))
        .then(parseEntries)
        .catch(() => []);
      target = last;
    } else {
      target = { id: last ? last.id + 1 : 0, bytes: 0 };
      segments.push(target);
    }
    entries.push(entry);
    const json = JSON.stringify(entries);
    target.bytes = byteLength(json);
    await AsyncStorage.setItem(segmentKey(target.id), json);

    // Rotation: drop whole oldest segments until the total fits, always keeping the newest.
    const dropped: Segment[] = [];
    let total = segments.reduce((sum, s) => sum + s.bytes, 0);
    while (segments.length > 1 && total > MAX_LOG_BYTES) {
      const oldest = segments.shift()!;
      total -= oldest.bytes;
      dropped.push(oldest);
    }
    await AsyncStorage.setItem(SEGMENTS_KEY, JSON.stringify(segments));
    if (dropped.length) await AsyncStorage.multiRemove(dropped.map((s) => segmentKey(s.id)));
  }

  private async readSegments(): Promise<Segment[]> {
    try {
      const parsed = JSON.parse((await AsyncStorage.getItem(SEGMENTS_KEY)) ?? '[]');
      return Array.isArray(parsed)
        ? parsed.filter((s) => Number.isInteger(s?.id) && typeof s?.bytes === 'number')
        : [];
    } catch {
      return [];
    }
  }

  /** Moves a pre-segmentation log into segment 0 when it is still readable, then deletes it. */
  private async migrateLegacy(): Promise<Segment[]> {
    const json = await AsyncStorage.getItem(LEGACY_LOG_KEY).catch(() => null);
    await AsyncStorage.removeItem(LEGACY_LOG_KEY).catch(() => undefined);
    const entries = parseEntries(json);
    if (entries.length === 0) return [];
    // Legacy logs were capped at 5 MB in one value: keep only the newest SEGMENT_BYTES of it.
    const kept: LogEntry[] = [];
    let bytes = 2;
    for (let i = entries.length - 1; i >= 0; i--) {
      const size = byteLength(JSON.stringify(entries[i])) + 1;
      if (bytes + size > SEGMENT_BYTES && kept.length) break;
      kept.unshift(entries[i]);
      bytes += size;
    }
    const keptJson = JSON.stringify(kept);
    await AsyncStorage.setItem(segmentKey(0), keptJson);
    return [{ id: 0, bytes: byteLength(keptJson) }];
  }

  /**
   * Registers a global handler for uncaught JS errors so they're captured without
   * interrupting the user (RNF-017's "sem interromper a experiência do usuário").
   * Chains to whatever handler React Native already installed (e.g. the dev red box).
   */
  installGlobalHandler(): void {
    const errorUtils = global.ErrorUtils;
    if (!errorUtils?.setGlobalHandler) return;

    const previousHandler = errorUtils.getGlobalHandler?.();

    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      this.log(error, isFatal ? 'uncaught-fatal' : 'uncaught').catch(() => {
        // Logging must never itself crash the app.
      });
      previousHandler?.(error, isFatal);
    });
  }

  async isReportingEnabled(): Promise<boolean> {
    return (await AsyncStorage.getItem(REPORT_ENABLED_KEY)) !== '0';
  }

  /**
   * Stores the user's "enviar relatórios anonimamente" choice (when `enabled` is given) and,
   * if reporting is on and an HTTPS endpoint is configured, uploads the entries not yet sent.
   * Entries carry only timestamp/level/message/stack/context — no user or device id — and
   * `file://` paths are redacted since they can embed the user's media names. Returns how
   * many entries were sent; never throws, so it can't disturb the user's editing.
   */
  async reportPending(enabled?: boolean): Promise<number> {
    try {
      if (enabled !== undefined) {
        await AsyncStorage.setItem(REPORT_ENABLED_KEY, enabled ? '1' : '0');
      }
      if (!(await this.isReportingEnabled())) return 0;

      const url = CONFIG.errorReportUrl;
      if (!url.startsWith('https://')) return 0;

      const reportedUpTo = Number(await AsyncStorage.getItem(REPORTED_UP_TO_KEY)) || 0;
      const pending = (await this.getEntries()).filter((e) => e.timestamp > reportedUpTo);
      if (pending.length === 0) return 0;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: pending.map(anonymize) }),
      });
      if (!response.ok) return 0;

      await AsyncStorage.setItem(REPORTED_UP_TO_KEY, String(pending[pending.length - 1].timestamp));
      return pending.length;
    } catch {
      return 0;
    }
  }
}

function redact(text: string | undefined): string | undefined {
  return text?.replace(/file:\/\/\S+/g, 'file://<redacted>');
}

function anonymize({ timestamp, level, message, stack, context }: LogEntry): LogEntry {
  return { timestamp, level, message: redact(message) ?? '', stack: redact(stack), context };
}

export function byteLength(str: string): number {
  // AsyncStorage values are UTF-16 JS strings; approximate UTF-8 byte size without
  // pulling in a Buffer polyfill (not available in the RN runtime).
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff)
      bytes += 2; // surrogate pair half
    else bytes += 3;
  }
  return bytes;
}

export const errorLogger = new ErrorLogger();

function parseEntries(json: string | null | undefined): LogEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // The log itself is not the user's data — if it's corrupted, just start clean.
    return [];
  }
}
