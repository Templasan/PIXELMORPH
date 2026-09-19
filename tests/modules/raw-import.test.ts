import {
  RAW_FORMATS,
  isRawFilename,
  rawFormatFromFilename,
  rawFormatFromMimeType,
  rawFormatLabel,
} from '@modules/photo-editor/raw';

describe('isRawFilename', () => {
  it('recognizes known camera RAW extensions, case-insensitively', () => {
    expect(isRawFilename('DSC001.CR3')).toBe(true);
    expect(isRawFilename('photo.nef')).toBe(true);
    expect(isRawFilename('photo.dng')).toBe(true);
  });

  it('rejects non-RAW extensions', () => {
    expect(isRawFilename('photo.jpg')).toBe(false);
    expect(isRawFilename('photo.png')).toBe(false);
    expect(isRawFilename('noextension')).toBe(false);
  });
});

describe('rawFormatFromFilename', () => {
  it('maps a filename to its format info', () => {
    const info = rawFormatFromFilename('IMG_1234.ARW');
    expect(info?.label).toBe('Sony ARW');
    expect(info?.mimeType).toBe('image/x-sony-arw');
  });

  it('returns null for a non-RAW filename', () => {
    expect(rawFormatFromFilename('photo.jpg')).toBeNull();
  });
});

describe('rawFormatFromMimeType / rawFormatLabel', () => {
  it('round-trips every registered format', () => {
    for (const f of RAW_FORMATS) {
      expect(rawFormatFromMimeType(f.mimeType)).toEqual(f);
      expect(rawFormatLabel(f.mimeType)).toBe(f.label.split(' ').pop());
    }
  });

  it('returns null for a non-RAW mime type', () => {
    expect(rawFormatFromMimeType('image/jpeg')).toBeNull();
    expect(rawFormatLabel('image/jpeg')).toBeNull();
  });
});
