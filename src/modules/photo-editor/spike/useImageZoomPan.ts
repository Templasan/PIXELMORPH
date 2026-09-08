import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

export interface ZoomPanState {
  scale: SharedValue<number>;
  offsetX: SharedValue<number>;
  offsetY: SharedValue<number>;
  isPinching: SharedValue<boolean>;
  isDragging: SharedValue<boolean>;
}

export function useImageZoomPan(): ZoomPanState {
  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const isPinching = useSharedValue(false);
  const isDragging = useSharedValue(false);

  return {
    scale,
    offsetX,
    offsetY,
    isPinching,
    isDragging,
  };
}
