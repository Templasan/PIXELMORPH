import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../infrastructure/config';

const LOG_KEY = 'errorLog';
const REPORT_ENABLED_KEY = 'errorLogReportingEnabled';
const REPORTED_UP_TO_KEY = 'errorLogReportedUpTo';
/** RNF-017: local log is capped at 5 MB, with rotation (oldest entries dropped first). */
export const MAX_LOG_BYTES = 5 * 1024 * 1024;

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
 * see ARCHITECTURE.md) entries simply stay in the local log.
 */
export class ErrorLogger {
  async log(error: unknown, context?: string, level: LogEntry['level'] = 'error'): Promise<void> {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
    };

    const entries = await this.getEntries();
    entries.push(entry);

    const rotated = this.rotateToFit(entries);
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(rotated));
  }

  async getEntries(): Promise<LogEntry[]> {
    const json = await AsyncStorage.getItem(LOG_KEY);
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // The log itself is not the user's data — if it's corrupted, just start clean.
      return [];
    }
  }

  async getSizeBytes(): Promise<number> {
    const json = await AsyncStorage.getItem(LOG_KEY);
    return json ? byteLength(json) : 0;
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(LOG_KEY);
  }

  /** Drops the oldest entries until the serialized log fits under the 5 MB cap. */
  private rotateToFit(entries: LogEntry[]): LogEntry[] {
    let result = entries;
    while (result.length > 0 && byteLength(JSON.stringify(result)) > MAX_LOG_BYTES) {
      result = result.slice(1);
    }
    return result;
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
