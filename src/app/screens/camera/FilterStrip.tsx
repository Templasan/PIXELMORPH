import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Slider } from '@core/ui';
import { colors } from '@core/theme';
import { FILTER_PRESETS, adjustmentsToOverlayColor } from './cameraFormat';

interface Props {
  activeFilter: number;
  onFilterChange: (index: number) => void;
  intensity: number;
  onIntensityChange: (value: number) => void;
}

const FilterStrip = memo(function FilterStrip({
  activeFilter,
  onFilterChange,
  intensity,
  onIntensityChange,
}: Props) {
  return (
    <View style={styles.filterSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_PRESETS.map((f, i) => (
          <Pressable key={f.name} style={styles.filterItem} onPress={() => onFilterChange(i)}>
            <View
              style={[
                styles.filterThumbWrap,
                activeFilter === i && styles.filterThumbActive,
                { backgroundColor: colors.faixa },
              ]}
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: adjustmentsToOverlayColor(f.adjustments), opacity: 0.5 },
                ]}
              />
            </View>
            <Text style={[styles.filterName, activeFilter === i && styles.filterNameActive]}>
              {f.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.intensityRow}>
        <Slider
          label="Intensidade"
          value={intensity}
          min={0}
          max={100}
          onChange={onIntensityChange}
          labelWidth={72}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  filterSection: {
    backgroundColor: 'rgba(0,0,0,0.88)',
    paddingTop: 8,
  },
  filterRow: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 8,
  },
  filterItem: {
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  filterThumbWrap: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: colors.linha,
    overflow: 'hidden',
  },
  filterThumbActive: {
    borderColor: colors.acento,
  },
  filterName: {
    fontSize: 9,
    color: colors.texto2,
  },
  filterNameActive: {
    color: colors.acento,
  },
  intensityRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});

export default FilterStrip;
