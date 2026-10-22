import * as FileSystem from 'expo-file-system/legacy';
import { errorLogger } from '@core/reliability';
import {
  pauseProxiesForExport,
  proxyDimensions,
  proxyPathOf,
  proxyStore,
  requestProxy,
  requestSourceProxy,
  resumeProxies,
  sourcesReadiness,
  type ProxyStatus,
} from '@app/screens/video-editor/previewProxy';
import * as native from '../../modules/pixelmorph-video-export/src';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  moveAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));

jest.mock('../../modules/pixelmorph-video-export/src', () => ({
  exportVideo: jest.fn(),
  cancelVideoExport: jest.fn(),
  probeVideo: jest.fn(async () => null),
}));

jest.mock('@core/reliability', () => ({
  errorLogger: { log: jest.fn(async () => undefined) },
}));

const exportVideo = native.exportVideo as jest.Mock;
const cancelVideoExport = native.cancelVideoExport as jest.Mock;
const probeVideo = native.probeVideo as jest.Mock;
const moveAsync = FileSystem.moveAsync as jest.Mock;
const deleteAsync = FileSystem.deleteAsync as jest.Mock;
const getInfoAsync = FileSystem.getInfoAsync as jest.Mock;
const log = errorLogger.log as jest.Mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  exportVideo.mockReset();
  cancelVideoExport.mockClear();
  moveAsync.mockClear();
  deleteAsync.mockClear();
  getInfoAsync.mockReset();
  getInfoAsync.mockResolvedValue({ exists: false });
  log.mockClear();
  probeVideo.mockReset();
  probeVideo.mockResolvedValue(null);
});

describe('proxyDimensions', () => {
  test('landscape 4K goes to 1280x720', () => {
    expect(proxyDimensions(3840, 2160)).toEqual({ width: 1280, height: 720 });
  });

  test('portrait 4K goes to 720x1280', () => {
    expect(proxyDimensions(2160, 3840)).toEqual({ width: 720, height: 1280 });
  });

  test('short edge is rounded to an even number', () => {
    expect(proxyDimensions(3000, 2001)).toEqual({ width: 1280, height: 854 });
    for (const [w, h] of [
      [3001, 2003],
      [4095, 2161],
      [1921, 1081],
    ]) {
      const size = proxyDimensions(w, h)!;
      expect(size.width % 2).toBe(0);
      expect(size.height % 2).toBe(0);
    }
  });

  test('sources whose long edge is 1280 or less get no proxy', () => {
    expect(proxyDimensions(1280, 720)).toBeNull();
    expect(proxyDimensions(720, 1280)).toBeNull();
    expect(proxyDimensions(0, 0)).toBeNull();
  });
});

describe('proxyPathOf', () => {
  test('sits next to the source inside the documents folder', () => {
    expect(proxyPathOf('file:///docs/media/p1/clip.mp4')).toBe(
      'file:///docs/media/p1/clip.proxy720.mp4'
    );
  });

  test('sources outside the documents folder have no proxy', () => {
    expect(proxyPathOf('file:///storage/emulated/0/DCIM/clip.mp4')).toBeNull();
  });
});

describe('requestProxy queue', () => {
  test('runs one transcode at a time, dedupes, and moves the tmp file only on success', async () => {
    const first = deferred();
    const second = deferred();
    exportVideo.mockReturnValueOnce(first.promise);
    exportVideo.mockReturnValueOnce(second.promise);

    await requestProxy('file:///docs/media/a/a.mp4', 3840, 2160, 5000);
    await requestProxy('file:///docs/media/a/a.mp4', 3840, 2160, 5000);
    await requestProxy('file:///docs/media/b/b.mp4', 3840, 2160, 7000);
    await flush();

    expect(exportVideo).toHaveBeenCalledTimes(1);
    expect(exportVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        clips: [
          expect.objectContaining({
            uri: 'file:///docs/media/a/a.mp4',
            kind: 'video',
            inMs: 0,
            outMs: 5000,
            speed: 1,
            volume: 1,
          }),
        ],
        width: 1280,
        height: 720,
        bitrate: 5_000_000,
        keyFrameIntervalSeconds: 1,
        outputPath: '/docs/media/a/a.proxy720.mp4.tmp.mp4',
      }),
      expect.any(Function)
    );
    expect(moveAsync).not.toHaveBeenCalled();

    first.resolve();
    await flush();

    expect(moveAsync).toHaveBeenCalledWith({
      from: 'file:///docs/media/a/a.proxy720.mp4.tmp.mp4',
      to: 'file:///docs/media/a/a.proxy720.mp4',
    });
    expect(proxyStore.get()['file:///docs/media/a/a.mp4']).toEqual({
      status: 'ready',
      progress: 100,
      uri: 'file:///docs/media/a/a.proxy720.mp4',
    });
    expect(exportVideo).toHaveBeenCalledTimes(2);

    second.resolve();
    await flush();
  });

  test('a failed transcode leaves no tmp file and marks the source failed', async () => {
    exportVideo.mockRejectedValueOnce(new Error('encoder died'));

    await requestProxy('file:///docs/media/c/c.mp4', 3840, 2160, 5000);
    await flush();
    await flush();

    expect(moveAsync).not.toHaveBeenCalled();
    expect(deleteAsync).toHaveBeenCalledWith('file:///docs/media/c/c.proxy720.mp4.tmp.mp4', {
      idempotent: true,
    });
    expect(proxyStore.get()['file:///docs/media/c/c.mp4']?.status).toBe('failed');
    expect(log).toHaveBeenCalledWith(expect.any(Error), 'previewProxy.transcode');
  });

  test('an existing finished proxy is used without transcoding', async () => {
    getInfoAsync.mockResolvedValueOnce({ exists: true });

    await requestProxy('file:///docs/media/d/d.mp4', 3840, 2160, 5000);

    expect(exportVideo).not.toHaveBeenCalled();
    expect(proxyStore.get()['file:///docs/media/d/d.mp4']?.uri).toBe(
      'file:///docs/media/d/d.proxy720.mp4'
    );
  });
});

describe('540p proxy (Baixa tier)', () => {
  test('is 960x540 with 1 s keyframes, next to the source, tracked under its own key', async () => {
    expect(proxyDimensions(3840, 2160, '540')).toEqual({ width: 960, height: 540 });
    expect(proxyDimensions(1080, 1920, '540')).toEqual({ width: 540, height: 960 });
    expect(proxyDimensions(960, 540, '540')).toBeNull();
    expect(proxyPathOf('file:///docs/media/a/a.mp4', '540')).toBe('file:///docs/media/a/a.proxy540.mp4');
    exportVideo.mockResolvedValueOnce(undefined);
    await requestProxy('file:///docs/media/q/q.mp4', 1920, 1080, 4000, '540');
    await flush();
    expect(exportVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 960,
        height: 540,
        bitrate: 3_000_000,
        keyFrameIntervalSeconds: 1,
        outputPath: '/docs/media/q/q.proxy540.mp4.tmp.mp4',
      }),
      expect.any(Function)
    );
    expect(proxyStore.get()['file:///docs/media/q/q.mp4#540']?.status).toBe('ready');
    expect(proxyStore.get()['file:///docs/media/q/q.mp4']).toBeUndefined();
  });
});

describe('pauseProxiesForExport / resumeProxies', () => {
  test('cancels the running transcode, waits for it, and restarts it on resume', async () => {
    const running = deferred();
    const restarted = deferred();
    exportVideo.mockReturnValueOnce(running.promise);
    exportVideo.mockReturnValueOnce(restarted.promise);

    await requestProxy('file:///docs/media/e/e.mp4', 3840, 2160, 5000);
    await flush();
    expect(exportVideo).toHaveBeenCalledTimes(1);

    const pause = pauseProxiesForExport();
    expect(cancelVideoExport).toHaveBeenCalledTimes(1);
    running.reject(new Error('CANCELLED'));
    await pause;

    expect(proxyStore.get()['file:///docs/media/e/e.mp4']?.status).toBe('pending');
    expect(deleteAsync).toHaveBeenCalledWith('file:///docs/media/e/e.proxy720.mp4.tmp.mp4', {
      idempotent: true,
    });

    resumeProxies();
    await flush();
    expect(exportVideo).toHaveBeenCalledTimes(2);
    expect(exportVideo.mock.calls[1][0].clips[0].uri).toBe('file:///docs/media/e/e.mp4');

    restarted.resolve();
    await flush();
  });

  test('a paused queue starts nothing until resumed', async () => {
    const job = deferred();
    exportVideo.mockReturnValueOnce(job.promise);

    await pauseProxiesForExport();
    await requestProxy('file:///docs/media/f/f.mp4', 3840, 2160, 5000);
    await flush();
    expect(exportVideo).not.toHaveBeenCalled();

    resumeProxies();
    await flush();
    expect(exportVideo).toHaveBeenCalledTimes(1);

    job.resolve();
    await flush();
  });
});

describe('requestSourceProxy', () => {
  test('probes a sideways portrait video and requests its upright 720p proxy', async () => {
    probeVideo.mockResolvedValue({ width: 3840, height: 2160, rotation: 90, durationMs: 12500 });
    const job = deferred();
    exportVideo.mockReturnValueOnce(job.promise);

    await requestSourceProxy('file:///docs/media/g/g.mp4');

    expect(exportVideo.mock.calls[0][0]).toMatchObject({
      width: 720,
      height: 1280,
      clips: [{ outMs: 12500 }],
    });
    // Let the job finish so the queue is free for the tests after this one.
    job.resolve();
    await flush();
  });

  test('sources outside the documents folder are not probed', async () => {
    probeVideo.mockClear();

    await requestSourceProxy('file:///storage/emulated/0/DCIM/x.mp4');

    expect(probeVideo).not.toHaveBeenCalled();
  });
});

describe('requestSourceProxy status', () => {
  test('a small source is checking while probed, then none, and never queues a transcode', async () => {
    const probe = deferred<{
      width: number;
      height: number;
      rotation: number;
      durationMs: number;
    }>();
    probeVideo.mockReturnValueOnce(probe.promise);
    const uri = 'file:///docs/media/small/small.mp4';

    const request = requestSourceProxy(uri);
    expect(proxyStore.get()[uri]).toEqual({ status: 'checking', progress: 0 });

    probe.resolve({ width: 1280, height: 720, rotation: 0, durationMs: 4000 });
    await request;

    expect(proxyStore.get()[uri]).toEqual({ status: 'none', progress: 0 });
    expect(exportVideo).not.toHaveBeenCalled();
  });

  test('a big source goes checking, then pending/running through the queue', async () => {
    probeVideo.mockResolvedValueOnce({ width: 3840, height: 2160, rotation: 0, durationMs: 6000 });
    const job = deferred();
    exportVideo.mockReturnValueOnce(job.promise);
    const uri = 'file:///docs/media/big/big.mp4';

    await requestSourceProxy(uri);
    await flush();

    expect(proxyStore.get()[uri]?.status).toBe('running');
    expect(exportVideo).toHaveBeenCalledTimes(1);

    job.resolve();
    await flush();
    expect(proxyStore.get()[uri]?.status).toBe('ready');
  });

  test('an unreadable source ends as none instead of staying checking', async () => {
    probeVideo.mockRejectedValueOnce(new Error('unreadable'));
    const uri = 'file:///docs/media/broken/broken.mp4';

    await requestSourceProxy(uri);

    expect(proxyStore.get()[uri]?.status).toBe('none');
  });

  test('a source outside the documents folder is none straight away', async () => {
    const uri = 'file:///storage/emulated/0/DCIM/outside.mp4';

    await requestSourceProxy(uri);

    expect(proxyStore.get()[uri]?.status).toBe('none');
  });
});

describe('sourcesReadiness', () => {
  const entry = (status: ProxyStatus, progress = 0) => ({ status, progress });

  test('no sources is ready', () => {
    expect(sourcesReadiness({}, [])).toEqual({ ready: true, progress: 0 });
  });

  test('ready, none and failed all count as ready', () => {
    const state = {
      a: entry('ready', 100),
      b: entry('none'),
      c: entry('failed'),
    };
    expect(sourcesReadiness(state, ['a', 'b', 'c'])).toEqual({ ready: true, progress: 0 });
  });

  test('a source with no entry yet, or still checking or queued, is not ready', () => {
    expect(sourcesReadiness({}, ['x']).ready).toBe(false);
    expect(sourcesReadiness({ x: entry('checking') }, ['x'])).toEqual({
      ready: false,
      progress: 0,
    });
    expect(sourcesReadiness({ x: entry('pending') }, ['x'])).toEqual({
      ready: false,
      progress: 0,
    });
  });

  test('progress averages over the sources still preparing, counting queued ones as 0', () => {
    const state = {
      done: entry('ready', 100),
      run: entry('running', 40),
      queued: entry('pending'),
    };
    expect(sourcesReadiness(state, ['done', 'run', 'queued'])).toEqual({
      ready: false,
      progress: 20,
    });
  });
});
