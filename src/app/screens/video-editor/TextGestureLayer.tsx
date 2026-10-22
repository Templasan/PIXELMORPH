import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import type { VideoEditorStore } from '@modules/video-editor';
import { movedCentre, pinchedSize, videoFrameRect } from './textEdit';

interface Props {
  editor: VideoEditorStore;
  /** The preview panel the engine fills (its canvas is letterboxed inside). */
  width: number;
  height: number;
}

/**
 * Transparent layer over the web preview: a drag moves the selected text clip, a pinch scales it.
 * Gesture values are relative to the gesture start and liveClip hands the start snapshot, so the
 * updates never accumulate. Only mounted while a text clip is selected and the engine is shown.
 */
export function TextGestureLayer({ editor, width, height }: Props) {
  const gesture = useMemo(() => {
    // Plain functions go into the worklets (the store object itself must not be captured).
    const begin = editor.beginGesture;
    const end = editor.endGesture;
    const frame = videoFrameRect({ width, height });
    const moveText = (dx: number, dy: number) =>
      editor.liveClip((c) =>
        c.text ? { ...c, text: { ...c.text, ...movedCentre(c.text, dx, dy) } } : c
      );
    const scaleText = (scale: number) =>
      editor.liveClip((c) =>
        c.text ? { ...c, text: { ...c.text, size: pinchedSize(c.text.size, scale) } } : c
      );
    const pan = Gesture.Pan()
      .onStart(() => scheduleOnRN(begin))
      .onUpdate((e) =>
        scheduleOnRN(moveText, e.translationX / frame.width, e.translationY / frame.height)
      )
      .onFinalize(() => scheduleOnRN(end));
    const pinch = Gesture.Pinch()
      .onStart(() => scheduleOnRN(begin))
      .onUpdate((e) => scheduleOnRN(scaleText, e.scale))
      .onFinalize(() => scheduleOnRN(end));
    return Gesture.Simultaneous(pan, pinch);
  }, [editor, width, height]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} />
    </GestureDetector>
  );
}
