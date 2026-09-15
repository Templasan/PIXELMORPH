import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Slider, Tabs } from '@core/ui';
import { colors } from '@core/theme';

const TABS = ['Retrô', 'Molduras', 'Iluminação', 'Dupla exposição', 'Overlays'] as const;
type EffectsTab = (typeof TABS)[number];

// TODO: replace with real effect thumbnails rendered from the actual photo.
const EFFECTS = ['Vintage 70s', 'Film Grain', 'Lomo', 'Polaroid', 'Kodachrome', 'Faded'];

/** Efeitos drawer: effect grid + intensity/blend sliders. TODO: import-overlay flow is not implemented. */
export function EffectsDrawer() {
  const [tab, setTab] = useState<EffectsTab>('Retrô');
  const [active, setActive] = useState(0);
  const [intensity, setIntensity] = useState(70);
  const [blend, setBlend] = useState(100);

  return (
    <View>
      <Tabs tabs={TABS} active={tab} onChange={setTab} scrollable />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.effectRow}
      >
        {EFFECTS.map((ef, i) => (
          <View key={ef} style={styles.effectItem}>
            <View
              style={[styles.effectThumb, i === active && styles.effectThumbActive]}
              onTouchEnd={() => setActive(i)}
            />
            <Text
              style={[styles.effectLabel, i === active && styles.effectLabelActive]}
              numberOfLines={1}
            >
              {ef}
            </Text>
          </View>
        ))}
      </ScrollView>
      <Slider label="Intensidade" value={intensity} min={0} max={100} onChange={setIntensity} />
      <Slider label="Mesclagem" value={blend} min={0} max={100} onChange={setBlend} />
    </View>
  );
}

const styles = StyleSheet.create({
  effectRow: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  effectItem: {
    alignItems: 'center',
    gap: 4,
    width: 56,
  },
  effectThumb: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: colors.linha,
    backgroundColor: colors.faixa,
  },
  effectThumbActive: {
    borderColor: colors.acento,
  },
  effectLabel: {
    fontSize: 9,
    color: colors.texto2,
    textAlign: 'center',
  },
  effectLabelActive: {
    color: colors.acento,
  },
});
