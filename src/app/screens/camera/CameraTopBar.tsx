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
  onClose: () => void;
  controls: TopControl[];
}

/** Distance from the screen's top edge: the status bar is hidden on this screen. */
export const TOP_BAR_TOP = 24;

/**
 * Close and the feature toggles, each in a slot of equal width, so the row is spread evenly
 * across the screen whatever the buttons' labels are. Floats over the preview, no background.
 */
const CameraTopBar = memo(function CameraTopBar({ onClose, controls }: Props) {
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.slot}>
        <CameraButton icon="x" accessibilityLabel="Fechar câmera" onPress={onClose} />
      </View>
      {controls.map((c) => (
        <View key={c.accessibilityLabel} style={styles.slot}>
          <CameraButton {...c} />
        </View>
      ))}
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
    paddingTop: TOP_BAR_TOP,
    paddingHorizontal: 8,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
  },
});

export default CameraTopBar;
