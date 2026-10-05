import { memo, type ComponentProps } from 'react';
import {
  Fill,
  Group,
  ImageShader,
  Shader,
  type SkImage,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import { blendModeAt } from '@modules/photo-editor';

import { PHOTO_WIDTH as W, PHOTO_HEIGHT as H } from './dims';
const RECT = { x: 0, y: 0, width: W, height: H };
const ORIGIN = { x: W / 2, y: H / 2 };

interface Props {
  flipH: boolean;
  flipV: boolean;
  opacity: number;
  includeOverlays: boolean;
  matrix: ComponentProps<typeof Group>['matrix'];
  retroEffect: SkRuntimeEffect;
  retroUniforms: ComponentProps<typeof Shader>['uniforms'];
  adjustmentsEffect: SkRuntimeEffect;
  uniforms: ComponentProps<typeof Shader>['uniforms'];
  adjustmentsVisible: boolean;
  image: SkImage | null;
  doubleExposureImage: SkImage | null;
  doubleExposureBlend: number;
  doubleExposureOpacity: number;
  overlayImage: SkImage | null;
  overlayBlend: number;
  overlayIntensity: number;
}

// US-09: chains the retro/overlay-texture shader (RF-041/028) right after the
// color-adjustments one — Skia composes nested <Shader> nodes into a single GPU pass.
export const PhotoLayer = memo(function PhotoLayer(p: Props) {
  const flipTransform = [{ scaleX: p.flipH ? -1 : 1 }, { scaleY: p.flipV ? -1 : 1 }];
  return (
    <Group transform={flipTransform} origin={ORIGIN} opacity={p.opacity}>
      <Group matrix={p.matrix}>
        <Fill>
          <Shader source={p.retroEffect} uniforms={p.retroUniforms}>
            {/* US-08: hiding the "Ajustes de cor" layer genuinely shows the untouched photo. */}
            {p.adjustmentsVisible ? (
              <Shader source={p.adjustmentsEffect} uniforms={p.uniforms}>
                <ImageShader image={p.image} fit="cover" rect={RECT} />
                {/* ADJUSTMENTS_SKSL declares a second `uniform shader maskImage`; Skia needs a
                    child bound to every shader uniform or the effect renders solid black. */}
                <ImageShader image={p.image} fit="cover" rect={RECT} />
              </Shader>
            ) : (
              <ImageShader image={p.image} fit="cover" rect={RECT} />
            )}
          </Shader>
        </Fill>
        {/* RF-075: a real second image, GPU-blended over the first. */}
        {p.includeOverlays && p.doubleExposureImage && (
          <Group
            blendMode={blendModeAt(p.doubleExposureBlend)}
            opacity={p.doubleExposureOpacity / 100}
          >
            <Fill>
              <ImageShader image={p.doubleExposureImage} fit="cover" rect={RECT} />
            </Fill>
          </Group>
        )}
        {/* RF-028: an overlay imported from the device gallery (light leaks, dust, wear). */}
        {p.includeOverlays && p.overlayImage && (
          <Group blendMode={blendModeAt(p.overlayBlend)} opacity={p.overlayIntensity / 100}>
            <Fill>
              <ImageShader image={p.overlayImage} fit="cover" rect={RECT} />
            </Fill>
          </Group>
        )}
      </Group>
    </Group>
  );
});
