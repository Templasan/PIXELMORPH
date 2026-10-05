import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  filterName: string;
  filterOverlayColor: string;
  intensity: number;
}

const FilterTint = memo(function FilterTint({ filterName, filterOverlayColor, intensity }: Props) {
  if (filterName === 'Original') return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.filterTint,
        // Camera preview renders via a native SurfaceView, which the OS composites
        // outside of RN's own view/blend pipeline — mixBlendMode has no effect on it.
        // Capping alpha keeps this a color wash instead of a solid coat that hides
        // the whole feed, and skipping it outright for "Original" stops every shot
        // from picking up a permanent whitish tint.
        { backgroundColor: filterOverlayColor, opacity: (intensity / 100) * 0.25 },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  filterTint: {
    ...StyleSheet.absoluteFill,
  },
});

export default FilterTint;
