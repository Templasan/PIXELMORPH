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
  onDone: () => void;
}

/** Bottom sheet over the controls: the preview stays visible above it and the shutter below. */
const FiltersSheet = memo(function FiltersSheet({
  activeFilter,
  onFilterChange,
  intensity,
  onIntensityChange,
  onDone,
}: Props) {
  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Filtros</Text>
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Fechar filtros"
          hitSlop={10}
          style={styles.done}
        >
          <Text style={styles.doneText}>Pronto</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.swatches}>
          {FILTER_PRESETS.map((f, i) => {
            const active = i === activeFilter;
            return (
              <Pressable
                key={f.name}
                onPress={() => onFilterChange(i)}
                accessibilityRole="button"
                accessibilityLabel={`Filtro ${f.name}`}
                accessibilityState={{ selected: active }}
                style={styles.item}
              >
                <View style={[styles.swatch, active && styles.swatchActive]}>
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: adjustmentsToOverlayColor(f.adjustments), opacity: 0.5 },
                    ]}
                  />
                </View>
                <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
                  {f.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Slider
        label="Intensidade"
        value={intensity}
        min={0}
        max={100}
        onChange={onIntensityChange}
        labelWidth={84}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    color: colors.texto,
    fontSize: 14,
    fontWeight: '600',
  },
  done: {
    minHeight: 44,
    justifyContent: 'center',
  },
  doneText: {
    color: colors.acento,
    fontSize: 14,
    fontWeight: '600',
  },
  swatches: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
  },
  item: {
    width: 72,
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.faixa,
    overflow: 'hidden',
  },
  swatchActive: {
    borderColor: colors.acento,
  },
  name: {
    fontSize: 11,
    color: colors.texto2,
  },
  nameActive: {
    color: colors.branco,
  },
});

export default FiltersSheet;
