import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraButton } from './CameraButton';

export interface TopControl {
  icon: string;
  label?: string;
  active: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}

interface Props {
  /** Status bar height: the bar is pushed below it. */
  topInset: number;
  onClose: () => void;
  controls: TopControl[];
}

/** Close on the left, feature toggles on the right. Floats over the preview, so no background. */
const CameraTopBar = memo(function CameraTopBar({ topInset, onClose, controls }: Props) {
  return (
    <View style={[styles.bar, { paddingTop: topInset + 8 }]} pointerEvents="box-none">
      <CameraButton icon="x" accessibilityLabel="Fechar câmera" onPress={onClose} />
      <View style={styles.right}>
        {controls.map((c) => (
          <CameraButton key={c.accessibilityLabel} {...c} />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default CameraTopBar;
