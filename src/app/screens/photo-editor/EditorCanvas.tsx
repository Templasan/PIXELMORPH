import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, type useCanvasRef } from '@shopify/react-native-skia';
import { EditorScene, type EditorSceneProps } from './EditorScene';

interface Props extends EditorSceneProps {
  canvasRef: ReturnType<typeof useCanvasRef>;
}

/**
 * The photo editor's Skia canvas (photo, adjustments, effects, paint/text/shape layers, frame).
 * It subscribes to the editor store itself, so a slider tick or a brush point re-renders the
 * canvas alone — not the screen, and opening a drawer does not touch the canvas at all.
 */
export const EditorCanvas = memo(function EditorCanvas({ canvasRef, ...scene }: Props) {
  return (
    <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
      <EditorScene {...scene} />
    </Canvas>
  );
});
