import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorLogger, MAX_LOG_BYTES } from '@core/reliability/ErrorLogger';

describe('ErrorLogger (RNF-017)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts empty', async () => {
    const logger = new ErrorLogger();
    expect(await logger.getEntries()).toEqual([]);
    expect(await logger.getSizeBytes()).toBe(0);
  });

  it('logs an Error with message and stack', async () => {
    const logger = new ErrorLogger();
    await logger.log(new Error('boom'), 'unit-test');

    const entries = await logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('boom');
    expect(entries[0].context).toBe('unit-test');
    expect(entries[0].level).toBe('error');
    expect(typeof entries[0].stack).toBe('string');
  });

  it('logs a non-Error value by stringifying it', async () => {
    const logger = new ErrorLogger();
    await logger.log('plain string failure');

    const entries = await logger.getEntries();
    expect(entries[0].message).toBe('plain string failure');
    expect(entries[0].stack).toBeUndefined();
  });

  it('never grows the persisted log past the 5 MB cap, dropping oldest entries first', async () => {
    const logger = new ErrorLogger();
    const bigChunk = 'x'.repeat(50_000);

    for (let i = 0; i < 200; i++) {
      await logger.log(new Error(`${bigChunk}-${i}`));
    }

    const size = await logger.getSizeBytes();
    expect(size).toBeLessThanOrEqual(MAX_LOG_BYTES);

    const entries = await logger.getEntries();
    // Oldest entries should have been rotated out — the most recent one must survive.
    expect(entries[entries.length - 1].message).toContain('-199');
    expect(entries[0].message).not.toContain('-0"');
  });

  it('clear() empties the log', async () => {
    const logger = new ErrorLogger();
    await logger.log(new Error('one'));
    await logger.clear();
    expect(await logger.getEntries()).toEqual([]);
  });
});
