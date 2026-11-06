import { base64Bytes } from '../../src/app/screens/video-editor/web-engine/fileHost';
jest.mock('expo-file-system', () => ({}));

test('counts the bytes a base64 string decodes to', () => {
  for (const n of [0, 1, 2, 3, 4, 5, 512 * 1024]) {
    expect(base64Bytes(Buffer.alloc(n).toString('base64'))).toBe(n);
  }
});
