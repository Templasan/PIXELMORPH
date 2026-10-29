import { dataUrlBytes } from '../src/domain/export/dataUrl';

describe('dataUrlBytes', () => {
  it('counts the bytes behind a base64 payload, padding included', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3);
    expect(dataUrlBytes('data:image/jpeg;base64,AAA=')).toBe(2);
    expect(dataUrlBytes('data:image/jpeg;base64,AA==')).toBe(1);
  });
});
