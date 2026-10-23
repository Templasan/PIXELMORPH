import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ColorPicker, { HueSlider, Panel1, Preview } from 'reanimated-color-picker';
import { colors, fontSize } from '@core/theme';
import { normaliseHex } from './colorHex';

interface ColorPickerSheetProps {
  initialColor: string;
  onConfirm: (hex: string) => void;
  onCancel: () => void;
}

/**
 * "Outra cor" picker: saturation/brightness panel, hue slider and preview. Only OK hands a
 * colour back, through the same callback the fixed swatches use; Cancelar changes nothing.
 * Modal content is a separate native window, so it gets its own GestureHandlerRootView.
 */
export function ColorPickerSheet({ initialColor, onConfirm, onCancel }: ColorPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState(normaliseHex(initialColor) ?? '#FFFFFF');

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <ColorPicker
            value={picked}
            sliderThickness={28}
            thumbSize={22}
            onChangeJS={(c) => setPicked(normaliseHex(c.hex) ?? picked)}
          >
            <Panel1 style={styles.panel} />
            <HueSlider style={styles.hue} />
            <Preview hideText={false} />
          </ColorPicker>
          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={onCancel}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => onConfirm(picked)}
            >
              <Text style={[styles.buttonText, styles.buttonPrimaryText]}>OK</Text>
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.faixa,
    padding: 16,
    gap: 14,
    borderTopWidth: 1,
    borderColor: colors.linha,
  },
  panel: {
    width: '100%',
    height: 220,
  },
  hue: {
    width: '100%',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    height: 40,
    minWidth: 96,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonPrimary: {
    backgroundColor: colors.acento,
    borderColor: colors.acento,
  },
  buttonText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.texto,
  },
  buttonPrimaryText: {
    color: '#0D2036',
  },
});
