import { previewCopiesOf, variantsOf } from '@app/screens/video-editor/previewQuality';

const src = 'file:///docs/media/p/clip.mp4';
const one = `${src}#1080`;
const ready = (uri: string) => ({ status: 'ready', progress: 100, uri });

describe('variantsOf', () => {
  it('Baixa reads the 540 copy (1080 above it), Média the 720 one, Alta the 1080 one', () => {
    expect(variantsOf('baixa')).toEqual(['540', '1080']);
    expect(variantsOf('media')).toEqual(['720']);
    expect(variantsOf('alta')).toEqual(['1080']);
  });
});

describe('previewCopiesOf', () => {
  it('Média asks for the 720 copy only and maps it when ready', () => {
    const state = { [src]: ready('p720'), [one]: ready('p1080') };
    expect(previewCopiesOf('media', [src], state).map).toEqual({ [src]: 'p720' });
  });

  it('Alta maps the 1080 copy only: no 720 fallback while it is not ready', () => {
    expect(previewCopiesOf('alta', [src], { [src]: ready('p720') }).map).toEqual({});
    expect(previewCopiesOf('alta', [src], { [one]: { status: 'none', progress: 0 } }).map).toEqual(
      {}
    );
    expect(previewCopiesOf('alta', [src], { [one]: ready('p1080') }).map).toEqual({
      [src]: 'p1080',
    });
  });

  it('Baixa takes the 540 copy first, then the 1080 one', () => {
    const both = { [`${src}#540`]: ready('p540'), [one]: ready('p1080') };
    expect(previewCopiesOf('baixa', [src], both).map).toEqual({ [src]: 'p540' });
    expect(previewCopiesOf('baixa', [src], { [one]: ready('p1080') }).map).toEqual({
      [src]: 'p1080',
    });
    expect(previewCopiesOf('baixa', [src], { [src]: ready('p720') }).map).toEqual({});
  });

  it('lists the copies still being made for the tier, and only those', () => {
    const state = {
      [src]: { status: 'running', progress: 10, uri: undefined },
      [one]: { status: 'pending', progress: 0 },
    };
    expect(previewCopiesOf('media', [src], state).pendingKeys).toEqual([src]);
    expect(previewCopiesOf('alta', [src], state).pendingKeys).toEqual([one]);
    expect(previewCopiesOf('baixa', [src], state).pendingKeys).toEqual([one]);
  });

  it('reads a 1080 copy in part only for Baixa and Alta', () => {
    const running = { [one]: { status: 'running', progress: 42.7, partialUri: 'part1080' } };
    expect(previewCopiesOf('alta', [src], running).partial).toEqual({
      [src]: { file: 'part1080', progress: 42 },
    });
    expect(previewCopiesOf('baixa', [src], running).partial).toEqual({
      [src]: { file: 'part1080', progress: 42 },
    });
    expect(
      previewCopiesOf('media', [src], {
        [src]: { status: 'running', progress: 5, partialUri: 'p' },
      }).partial
    ).toEqual({});
  });
});
