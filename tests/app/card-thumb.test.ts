import * as FileSystem from 'expo-file-system/legacy';
import { errorLogger } from '@core/reliability';
import type { Project } from '@modules/projects';
import {
  CARD_THUMB_TIMEOUT_MS,
  cardThumbPathOf,
  cardThumbStore,
  requestCardThumb,
  retryFailedCardThumbs,
  type MakeCardThumb,
} from '@app/screens/projects/cardThumb';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  moveAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));

jest.mock('@core/reliability', () => ({
  errorLogger: { log: jest.fn(async () => undefined) },
}));

const getInfoAsync = FileSystem.getInfoAsync as jest.Mock;
const makeDirectoryAsync = FileSystem.makeDirectoryAsync as jest.Mock;
const moveAsync = FileSystem.moveAsync as jest.Mock;
const deleteAsync = FileSystem.deleteAsync as jest.Mock;
const log = errorLogger.log as jest.Mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeProject(
  id: string,
  asset?: { originalUri: string; workingUri: string },
  thumbnailUri?: string
): Project {
  return {
    id,
    name: id,
    type: 'photo',
    status: 'active',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    assets: asset ? [{ ...asset, metadata: {} }] : [],
    thumbnailUri,
  } as unknown as Project;
}

beforeEach(() => {
  cardThumbStore.set(() => ({}));
  getInfoAsync.mockReset();
  getInfoAsync.mockResolvedValue({ exists: false });
  makeDirectoryAsync.mockClear();
  moveAsync.mockClear();
  deleteAsync.mockClear();
  log.mockClear();
});

describe('cardThumbPathOf', () => {
  test('an export is the source: card-<export name>.jpg in the project media folder', () => {
    const project = makeProject('p1', undefined, 'file:///docs/media/p1/1700_ab.png');
    expect(cardThumbPathOf(project)).toBe('file:///docs/media/p1/card-1700_ab.jpg');
  });

  test('without an export the primary asset working copy is the source', () => {
    const project = makeProject('p1', {
      originalUri: 'file:///docs/media/p1/orig.jpg',
      workingUri: 'file:///docs/media/p1/photo.jpg',
    });
    expect(cardThumbPathOf(project)).toBe('file:///docs/media/p1/card-photo.jpg');
  });

  test('falls back to the original when there is no working copy', () => {
    const project = makeProject('p1', {
      originalUri: 'file:///docs/media/p1/orig.jpg',
      workingUri: '',
    });
    expect(cardThumbPathOf(project)).toBe('file:///docs/media/p1/card-orig.jpg');
  });

  test('a new export gets a new thumb path', () => {
    const before = cardThumbPathOf(makeProject('p1', undefined, 'file:///docs/media/p1/a.jpg'));
    const after = cardThumbPathOf(makeProject('p1', undefined, 'file:///docs/media/p1/b.jpg'));
    expect(before).not.toBe(after);
  });

  test('no source at all has no thumb', () => {
    expect(cardThumbPathOf(makeProject('p1'))).toBeNull();
  });
});

describe('requestCardThumb', () => {
  test('makes the thumb into a tmp file, creates the folder, then moves it to the final name', async () => {
    const make = jest.fn<ReturnType<MakeCardThumb>, Parameters<MakeCardThumb>>(async () => {});
    const project = makeProject('p1', undefined, 'file:///docs/media/p1/a.png');

    await requestCardThumb(project, make);
    await flush();

    const final = 'file:///docs/media/p1/card-a.jpg';
    expect(makeDirectoryAsync).toHaveBeenCalledWith('file:///docs/media/p1', {
      intermediates: true,
    });
    expect(make).toHaveBeenCalledWith('file:///docs/media/p1/a.png', `${final}.tmp.jpg`);
    expect(moveAsync).toHaveBeenCalledWith({ from: `${final}.tmp.jpg`, to: final });
    expect(cardThumbStore.get()[final]).toBe('ready');
  });

  test('an existing file from an earlier session is ready without making anything', async () => {
    getInfoAsync.mockResolvedValueOnce({ exists: true });
    const make = jest.fn<ReturnType<MakeCardThumb>, Parameters<MakeCardThumb>>(async () => {});
    const project = makeProject('p1', undefined, 'file:///docs/media/p1/a.png');

    await requestCardThumb(project, make);

    expect(make).not.toHaveBeenCalled();
    expect(cardThumbStore.get()['file:///docs/media/p1/card-a.jpg']).toBe('ready');
  });

  test('repeated requests for one project are ignored', async () => {
    const make = jest.fn<ReturnType<MakeCardThumb>, Parameters<MakeCardThumb>>(async () => {});
    const project = makeProject('p1', undefined, 'file:///docs/media/p1/a.png');

    await requestCardThumb(project, make);
    await requestCardThumb(project, make);
    await flush();

    expect(make).toHaveBeenCalledTimes(1);
  });

  test('jobs run one at a time, in request order', async () => {
    const first = deferred();
    const second = deferred();
    const firstMake = jest.fn<ReturnType<MakeCardThumb>, Parameters<MakeCardThumb>>(
      () => first.promise
    );
    const secondMake = jest.fn<ReturnType<MakeCardThumb>, Parameters<MakeCardThumb>>(
      () => second.promise
    );

    await requestCardThumb(makeProject('s1', undefined, 'file:///docs/media/s1/a.png'), firstMake);
    await requestCardThumb(makeProject('s2', undefined, 'file:///docs/media/s2/b.png'), secondMake);
    await flush();

    expect(firstMake).toHaveBeenCalledTimes(1);
    expect(secondMake).not.toHaveBeenCalled();

    first.resolve();
    await flush();
    expect(secondMake).toHaveBeenCalledTimes(1);

    second.resolve();
    await flush();
  });

  test('a failed make leaves no tmp file, never moves, marks failed and logs', async () => {
    const make: MakeCardThumb = jest.fn(async () => {
      throw new Error('decoder died');
    });
    const project = makeProject('p2', undefined, 'file:///docs/media/p2/c.png');
    const final = 'file:///docs/media/p2/card-c.jpg';

    await expect(requestCardThumb(project, make)).resolves.toBeUndefined();
    await flush();
    await flush();

    expect(moveAsync).not.toHaveBeenCalled();
    expect(deleteAsync).toHaveBeenCalledWith(`${final}.tmp.jpg`, { idempotent: true });
    expect(cardThumbStore.get()[final]).toBe('failed');
    expect(log).toHaveBeenCalledWith(expect.any(Error), 'cardThumb.make');
  });

  test('a project without a source does nothing', async () => {
    const make = jest.fn<ReturnType<MakeCardThumb>, Parameters<MakeCardThumb>>(async () => {});

    await requestCardThumb(makeProject('p3'), make);

    expect(make).not.toHaveBeenCalled();
    expect(cardThumbStore.get()).toEqual({});
  });
});

describe('card thumb robustness', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a make that never settles times out, frees the queue and can be retried', async () => {
    const src = (id: string) => ({
      originalUri: `file:///docs/media/${id}/a.jpg`,
      workingUri: `file:///docs/media/${id}/a.jpg`,
    });
    const hung = makeProject('hung', src('hung'));
    const next = makeProject('next', src('next'));
    const neverEnds: MakeCardThumb = () => new Promise<void>(() => {});
    const ok = jest.fn<Promise<void>, [string, string]>(async () => undefined);
    await requestCardThumb(hung, neverEnds);
    await requestCardThumb(next, ok);
    await jest.advanceTimersByTimeAsync(CARD_THUMB_TIMEOUT_MS + 1);
    const hungPath = cardThumbPathOf(hung)!;
    const nextPath = cardThumbPathOf(next)!;
    expect(cardThumbStore.get()[hungPath]).toBe('failed');
    expect(ok).toHaveBeenCalled();
    expect(cardThumbStore.get()[nextPath]).toBe('ready');
    retryFailedCardThumbs();
    expect(cardThumbStore.get()[hungPath]).toBeUndefined();
    expect(cardThumbStore.get()[nextPath]).toBe('ready');
  });
});
