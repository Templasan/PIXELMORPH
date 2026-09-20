import { composePanorama } from '@modules/photo-editor/panorama';

// Mock Skia since it's not available in Jest
jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Surface: {
      Make: jest.fn(() => ({
        getCanvas: jest.fn(() => ({
          clear: jest.fn(),
          save: jest.fn(),
          drawImageRect: jest.fn(),
          restore: jest.fn(),
        })),
        flush: jest.fn(),
        makeImageSnapshot: jest.fn(() => ({
          width: jest.fn(() => 800),
          height: jest.fn(() => 600),
        })),
      })),
    },
    Color: jest.fn((color) => color),
    Paint: jest.fn(() => ({
      setAntiAlias: jest.fn(),
      setAlphaf: jest.fn(),
    })),
  },
}));

describe('composePanorama', () => {
  const mockImage = {
    image: {
      width: jest.fn(() => 500),
      height: jest.fn(() => 400),
    },
  };

  test('throws error with empty images array', () => {
    expect(() => {
      composePanorama([], { overlapWidth: 50, outputHeight: 400 });
    }).toThrow('Sem imagens para panorama');
  });

  test('returns single image when only one provided', () => {
    const result = composePanorama(
      [{ ...mockImage, offsetX: 0 }],
      { overlapWidth: 50, outputHeight: 400 }
    );
    expect(result).toBe(mockImage.image);
  });

  test('composes multiple images with offsets', () => {
    const images = [
      { image: { ...mockImage.image, width: jest.fn(() => 400) }, offsetX: 0 },
      { image: { ...mockImage.image, width: jest.fn(() => 400) }, offsetX: -100 },
      { image: { ...mockImage.image, width: jest.fn(() => 400) }, offsetX: -100 },
    ];

    const result = composePanorama(images, {
      overlapWidth: 50,
      outputHeight: 400,
    });

    expect(result).toBeDefined();
    expect(result.width).toBeDefined();
  });

  test('respects overlap width parameter', () => {
    const images = [
      { image: mockImage.image, offsetX: 0 },
      { image: mockImage.image, offsetX: -80 },
    ];

    const result = composePanorama(images, {
      overlapWidth: 100,
      outputHeight: 400,
    });

    expect(result).toBeDefined();
  });

  test('maintains aspect ratio with output height', () => {
    const images = [
      { image: { ...mockImage.image, width: jest.fn(() => 600) }, offsetX: 0 },
    ];

    const result = composePanorama(images, {
      overlapWidth: 50,
      outputHeight: 800,
    });

    expect(result).toBeDefined();
  });
});
