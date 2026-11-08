import { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MODES, type CameraMode } from './cameraFormat';

/** The active mode's label: the design's yellow, not a theme token. */
const ACTIVE_LABEL = '#F2C94C';
const IDLE_LABEL = 'rgba(242,242,242,0.6)';

interface Props {
  mode: CameraMode;
  onModeChange: (mode: CameraMode) => void;
  disabled: boolean;
}

/**
 * The row is padded by half the screen on each side, so the first and last modes can also be
 * centred. The active label is scrolled to the screen centre, not the centre of the group.
 */
const ModeCarousel = memo(function ModeCarousel({ mode, onModeChange, disabled }: Props) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  // Each label's place in the row, filled in as the labels are laid out.
  const slots = useRef<Partial<Record<CameraMode, { x: number; width: number }>>>({});

  const centerOn = useCallback(
    (m: CameraMode, animated: boolean) => {
      const slot = slots.current[m];
      if (!slot) return;
      scrollRef.current?.scrollTo({ x: slot.x + slot.width / 2 - width / 2, animated });
    },
    [width]
  );

  useEffect(() => {
    centerOn(mode, true);
  }, [mode, centerOn]);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.row, { paddingHorizontal: width / 2 }]}>
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <Pressable
              key={m}
              disabled={disabled}
              accessibilityRole="tab"
              accessibilityLabel={`Modo ${m}`}
              accessibilityState={{ selected: active, disabled }}
              hitSlop={6}
              onPress={() => onModeChange(m)}
              onLayout={(e) => {
                const { x, width: w } = e.nativeEvent.layout;
                slots.current[m] = { x, width: w };
                // The first layout happens after the mount effect, so the active one centres here.
                if (active) centerOn(m, false);
              }}
              style={[styles.item, disabled && styles.disabled]}
            >
              <Text style={[styles.label, { color: active ? ACTIVE_LABEL : IDLE_LABEL }]}>{m}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  item: {
    minHeight: 44,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

export default ModeCarousel;
