import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorLogger, MAX_LOG_BYTES, SEGMENT_BYTES, byteLength } from './ErrorLogger';

jest.mock('../infrastructure/config', () => ({
  CONFIG: { errorReportUrl: 'https://reports.example.test/errors' },
}));

const fetchMock = jest.fn();
(globalThis as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;

describe('ErrorLogger (RNF-017)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
  });

  it('rotates: the stored log never exceeds 5 MB and keeps the newest entries', async () => {
    const logger = new ErrorLogger();
    const big = 'x'.repeat(400 * 1024);
    for (let i = 0; i < 20; i++) await logger.log(new Error(`${i}:${big}`));

    expect(await logger.getSizeBytes()).toBeLessThanOrEqual(MAX_LOG_BYTES);
    const entries = await logger.getEntries();
    expect(entries.length).toBeLessThan(20);
    expect(entries[entries.length - 1].message.startsWith('19:')).toBe(true);
  });

  it('keeps every stored value small: 5 MB is spread over segments, none near the Android row limit', async () => {
    const logger = new ErrorLogger();
    const chunk = 'y'.repeat(30 * 1024);
    for (let i = 0; i < 250; i++) await logger.log(new Error(`${i}:${chunk}`));

    const keys = (await AsyncStorage.getAllKeys()).filter((k) => /^errorLog:\d+$/.test(k));
    expect(keys.length).toBeGreaterThan(1);
    const values = await AsyncStorage.multiGet(keys);
    for (const [, v] of values) expect(byteLength(v ?? '')).toBeLessThanOrEqual(SEGMENT_BYTES);
    expect(await logger.getSizeBytes()).toBeLessThanOrEqual(MAX_LOG_BYTES);
    const entries = await logger.getEntries();
    expect(entries[entries.length - 1].message.startsWith('249:')).toBe(true);
  });

  it('does not lose entries when log() is called concurrently', async () => {
    const logger = new ErrorLogger();
    await Promise.all(Array.from({ length: 30 }, (_, i) => logger.log(new Error(`e${i}`))));
    const messages = (await logger.getEntries()).map((e) => e.message);
    expect(messages).toEqual(Array.from({ length: 30 }, (_, i) => `e${i}`));
  });

  it('migrates a pre-segmentation log and removes the old single value', async () => {
    await AsyncStorage.setItem(
      'errorLog',
      JSON.stringify([{ timestamp: 1, level: 'error', message: 'old' }])
    );
    const logger = new ErrorLogger();
    await logger.log(new Error('new'));

    expect((await logger.getEntries()).map((e) => e.message)).toEqual(['old', 'new']);
    expect(await AsyncStorage.getItem('errorLog')).toBeNull();
  });

  it('sends only unreported entries, redacts file paths and carries no user id', async () => {
    const logger = new ErrorLogger();
    await logger.log(new Error('falhou em file:///data/user/0/app/cache/minha_foto.jpg'), 'Camera');

    expect(await logger.reportPending()).toBe(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.entries[0].message).toBe('falhou em file://<redacted>');
    expect(Object.keys(body.entries[0]).sort()).toEqual(
      ['context', 'level', 'message', 'stack', 'timestamp'].sort()
    );

    expect(await logger.reportPending()).toBe(0); // nothing new since the last upload
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the user turned reporting off', async () => {
    const logger = new ErrorLogger();
    await logger.log(new Error('boom'));

    expect(await logger.reportPending(false)).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await logger.isReportingEnabled()).toBe(false);
  });

  it('keeps entries pending when the upload fails', async () => {
    const logger = new ErrorLogger();
    await logger.log(new Error('boom'));
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    expect(await logger.reportPending()).toBe(0);
    expect(await logger.reportPending()).toBe(1);
  });
});
