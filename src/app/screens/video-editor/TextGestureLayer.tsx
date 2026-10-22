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
    // Pan and pinch run together: both feed ONE live update (liveClip always starts from the
    // gesture's snapshot, so two separate updates would each undo the other's change).
    const frame = videoFrameRect({ width, height });
    let active = 0;
    let moved = { dx: 0, dy: 0, scale: 1 };
    const apply = () =>
      editor.liveClip((c) =>
        c.text
          ? {
              ...c,
              text: {
                ...c.text,
                ...movedCentre(c.text, moved.dx, moved.dy),
                size: pinchedSize(c.text.size, moved.scale),
              },
            }
          : c
      );
    const begin = () => {
      if (active++ === 0) {
        moved = { dx: 0, dy: 0, scale: 1 };
        editor.beginGesture();
      }
    };
    const end = () => {
      // onFinalize also fires for a touch that never became a gesture (no onStart): ignore it.
      if (active > 0 && --active === 0) editor.endGesture();
    };
    const pan = (dx: number, dy: number) => {
      moved = { ...moved, dx, dy };
      apply();
    };
    const pinch = (scale: number) => {
      moved = { ...moved, scale };
      apply();
    };
    const panGesture = Gesture.Pan()
      .onStart(() => scheduleOnRN(begin))
      .onUpdate((e) =>
        scheduleOnRN(pan, e.translationX / frame.width, e.translationY / frame.height)
      )
      .onFinalize(() => scheduleOnRN(end));
    const pinchGesture = Gesture.Pinch()
      .onStart(() => scheduleOnRN(begin))
      .onUpdate((e) => scheduleOnRN(pinch, e.scale))
      .onFinalize(() => scheduleOnRN(end));
    return Gesture.Simultaneous(panGesture, pinchGesture);
  }, [editor, width, height]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} />
    </GestureDetector>
  );
}
