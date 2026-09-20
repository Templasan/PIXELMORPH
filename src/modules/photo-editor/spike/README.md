# Photo Editor Spike — Validation Proof-of-Concept

## Purpose

Validate React Native Skia compatibility with:

- Expo SDK 56
- React Native 0.85
- New Architecture
- Development Build
- Gesture handling (zoom, pan)
- Image rendering and transforms

## Spike Scope (MINIMAL)

1. Load image from URI
2. Render image with Skia Canvas
3. Zoom via pinch gesture (Reanimated shared values)
4. Pan via drag gesture
5. Manual validation in actual Development Build (not simulator)

## Files

- `SkiaSpike.tsx` - Main spike component (render + gestures)
- `useImageZoomPan.ts` - Shared values state for zoom/pan

## Testing Steps

1. Run in Expo Development Build (Android or iOS)
2. Load test image (sample.jpg from project assets)
3. Perform pinch-to-zoom gesture
4. Perform pan/drag gesture
5. Verify smooth 60 FPS rendering
6. Check console for errors

## Expected Results

- ✅ Image renders without artifacts
- ✅ Pinch zoom works smoothly at 60 FPS
- ✅ Pan works within zoomed bounds
- ✅ No memory leaks or crashes
- ✅ No TypeScript or ESLint errors

## Known Gotchas to Watch

1. Image pixelation on zoom (expected, document workaround)
2. Hermes memory regression (check if using Reanimated extensively)
3. Android NDK requirement (must be installed)

## Next Steps After Spike

If spike validates:

1. Refactor into Photo Editor domain/application/infrastructure
2. Add transform operations (rotate, flip, crop)
3. Add undo/redo integration
4. Integrate with ProjectHub navigation
