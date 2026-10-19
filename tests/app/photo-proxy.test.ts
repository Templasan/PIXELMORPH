import * as FileSystem from 'expo-file-system/legacy';
import { errorLogger } from '@core/reliability';
import {
  photoProxyPathOf,
  photoProxyReadiness,
  photoProxyStore,
  requestPhotoProxy,
  setPhotoProxyReady,
  type MakePhotoProxy,
  type PhotoProxyEntry,
} from '@app/screens/photo-editor/photoProxy';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  moveAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));

jest.mock('@core/reliability', () => ({
  errorLogger: { log: jest.fn(async () => undefined) },
}));

const moveAsync = FileSystem.moveAsync as jest.Mock;
const deleteAsync = FileSystem.deleteAsync as jest.Mock;
const getInfoAsync = FileSystem.getInfoAsync as jest.Mock;
const log = errorLogger.log as jest.Mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

type Written = { kind: 'written'; width: number; height: number };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function writtenMaker() {
  return jest.fn<ReturnType<MakePhotoProxy>, Parameters<MakePhotoProxy>>(async () => ({
    kind: 'written',
    width: 4000,
    height: 3000,
  }));
}

beforeEach(() => {
  photoProxyStore.set(() => ({}));
  getInfoAsync.mockReset();
  getInfoAsync.mockResolvedValue({ exists: false });
  moveAsync.mockClear();
  deleteAsync.mockClear();
  log.mockClear();
});

describe('photoProxyPathOf', () => {
  test('sits next to the source as <name>.proxy2048.jpg inside the documents folder', () => {
    expect(photoProxyPathOf('file:///docs/media/p1/photo.jpg')).toBe(
      'file:///docs/media/p1/photo.proxy2048.jpg'
    );
  });

  test('sources outside the documents folder (cache, DCIM) have no light copy', () => {
    expect(photoProxyPathOf('file:///cache/pixelmorph_collage_1.jpg')).toBeNull();
    expect(photoProxyPathOf('file:///storage/emulated/0/DCIM/x.jpg')).toBeNull();
  });
});

describe('requestPhotoProxy', () => {
  test('an existing light copy is used as is, without making one', async () => {
    getInfoAsync.mockResolvedValueOnce({ exists: true });
    const makeProxy = writtenMaker();

    await requestPhotoProxy('file:///docs/media/a/a.jpg', makeProxy);

    expect(makeProxy).not.toHaveBeenCalled();
    expect(photoProxyStore.get()['file:///docs/media/a/a.jpg']).toEqual({
      status: 'ready',
      progress: 100,
      uri: 'file:///docs/media/a/a.proxy2048.jpg',
    });
  });

  test('a source outside the documents folder is none straight away', async () => {
    const makeProxy = writtenMaker();

    await requestPhotoProxy('file:///cache/b.jpg', makeProxy);

    expect(makeProxy).not.toHaveBeenCalled();
    expect(photoProxyStore.get()['file:///cache/b.jpg']).toEqual({ status: 'none', progress: 0 });
  });

  test('repeated requests for one source are ignored', async () => {
    const makeProxy = writtenMaker();
    const uri = 'file:///docs/media/c/c.jpg';

    await requestPhotoProxy(uri, makeProxy);
    await requestPhotoProxy(uri, makeProxy);
    await flush();

    expect(makeProxy).toHaveBeenCalledTimes(1);
  });

  test('written: makes into the tmp file, moves it to the final name only then, and records the size', async () => {
    const job = deferred<Written>();
    const makeProxy = jest.fn<ReturnType<MakePhotoProxy>, Parameters<MakePhotoProxy>>(
      () => job.promise
    );
    const uri = 'file:///docs/media/d/d.jpg';

    await requestPhotoProxy(uri, makeProxy);
    await flush();

    expect(makeProxy).toHaveBeenCalledWith(uri, 'file:///docs/media/d/d.proxy2048.jpg.tmp.jpg');
    expect(photoProxyStore.get()[uri]?.status).toBe('running');
    expect(moveAsync).not.toHaveBeenCalled();

    job.resolve({ kind: 'written', width: 4000, height: 3000 });
    await flush();

    expect(moveAsync).toHaveBeenCalledWith({
      from: 'file:///docs/media/d/d.proxy2048.jpg.tmp.jpg',
      to: 'file:///docs/media/d/d.proxy2048.jpg',
    });
    expect(photoProxyStore.get()[uri]).toEqual({
      status: 'ready',
      progress: 100,
      uri: 'file:///docs/media/d/d.proxy2048.jpg',
      sourceWidth: 4000,
      sourceHeight: 3000,
    });
  });

  test("'small' (already within 2048 px) ends as none with no file moved", async () => {
    const makeProxy: MakePhotoProxy = async () => ({ kind: 'small', width: 1600, height: 900 });
    const uri = 'file:///docs/media/e/e.jpg';

    await requestPhotoProxy(uri, makeProxy);
    await flush();

    expect(moveAsync).not.toHaveBeenCalled();
    expect(photoProxyStore.get()[uri]).toEqual({
      status: 'none',
      progress: 0,
      sourceWidth: 1600,
      sourceHeight: 900,
    });
  });

  test('a failed job leaves no tmp file, marks the source failed and logs the error', async () => {
    const makeProxy: MakePhotoProxy = jest.fn(async () => {
      throw new Error('decoder died');
    });
    const uri = 'file:///docs/media/f/f.jpg';

    await requestPhotoProxy(uri, makeProxy);
    await flush();
    await flush();

    expect(moveAsync).not.toHaveBeenCalled();
    expect(deleteAsync).toHaveBeenCalledWith('file:///docs/media/f/f.proxy2048.jpg.tmp.jpg', {
      idempotent: true,
    });
    expect(photoProxyStore.get()[uri]?.status).toBe('failed');
    expect(log).toHaveBeenCalledWith(expect.any(Error), 'photoProxy.make');
  });

  test('jobs run one at a time, in request order', async () => {
    const first = deferred<Written>();
    const second = deferred<Written>();
    const firstMake = jest.fn<ReturnType<MakePhotoProxy>, Parameters<MakePhotoProxy>>(
      () => first.promise
    );
    const secondMake = jest.fn<ReturnType<MakePhotoProxy>, Parameters<MakePhotoProxy>>(
      () => second.promise
    );

    await requestPhotoProxy('file:///docs/g1.jpg', firstMake);
    await requestPhotoProxy('file:///docs/g2.jpg', secondMake);
    await flush();

    expect(firstMake).toHaveBeenCalledTimes(1);
    expect(secondMake).not.toHaveBeenCalled();
    expect(photoProxyStore.get()['file:///docs/g2.jpg']?.status).toBe('pending');

    first.resolve({ kind: 'written', width: 3000, height: 2000 });
    await flush();
    expect(secondMake).toHaveBeenCalledTimes(1);

    second.resolve({ kind: 'written', width: 3000, height: 2000 });
    await flush();
  });
});

describe('setPhotoProxyReady', () => {
  test('marks a source ready on a given light copy, without any decoding', () => {
    setPhotoProxyReady('file:///cache/baked.jpg', 'file:///cache/baked.proxy2048.jpg', {
      width: 4000,
      height: 3000,
    });

    expect(photoProxyStore.get()['file:///cache/baked.jpg']).toEqual({
      status: 'ready',
      progress: 100,
      uri: 'file:///cache/baked.proxy2048.jpg',
      sourceWidth: 4000,
      sourceHeight: 3000,
    });
  });
});

describe('photoProxyReadiness', () => {
  const entry = (partial: Partial<PhotoProxyEntry> & Pick<PhotoProxyEntry, 'status'>) => ({
    progress: 0,
    ...partial,
  });
  const src = 'file:///docs/s.jpg';

  test('no photo yet is ready with nothing to draw', () => {
    expect(photoProxyReadiness({}, null)).toEqual({ ready: true, uri: null, progress: 0 });
  });

  test('ready draws the light copy', () => {
    const state = {
      [src]: entry({ status: 'ready', progress: 100, uri: 'file:///docs/s.proxy2048.jpg' }),
    };
    expect(photoProxyReadiness(state, src)).toMatchObject({
      ready: true,
      uri: 'file:///docs/s.proxy2048.jpg',
    });
  });

  test("'none' and 'failed' are ready on the original", () => {
    expect(photoProxyReadiness({ [src]: entry({ status: 'none' }) }, src)).toMatchObject({
      ready: true,
      uri: src,
    });
    expect(photoProxyReadiness({ [src]: entry({ status: 'failed' }) }, src)).toMatchObject({
      ready: true,
      uri: src,
    });
  });

  test('no entry, checking, pending or running is not ready, and draws nothing', () => {
    expect(photoProxyReadiness({}, src)).toEqual({ ready: false, uri: null, progress: 0 });
    expect(photoProxyReadiness({ [src]: entry({ status: 'checking' }) }, src).ready).toBe(false);
    expect(photoProxyReadiness({ [src]: entry({ status: 'pending' }) }, src).ready).toBe(false);
    expect(photoProxyReadiness({ [src]: entry({ status: 'running', progress: 40 }) }, src)).toEqual(
      { ready: false, uri: null, progress: 40 }
    );
  });
});
