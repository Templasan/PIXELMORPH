import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Slider, Tabs } from '@core/ui';
import { colors, fontSize } from '@core/theme';

const TABS = ['Clonagem', 'Liquify'] as const;
type RetouchTab = (typeof TABS)[number];

/** Retoque drawer. TODO: clone source/destination circles + liquify warp on canvas are not implemented. */
export function RetouchDrawer() {
  const [tab, setTab] = useState<RetouchTab>('Clonagem');
  const [size, setSize] = useState(30);
  const [hardness, setHardness] = useState(60);
  const [flow, setFlow] = useState(80);

  return (
    <View>
      <Tabs tabs={TABS} active={tab} onChange={setTab} scrollable />
      <Text style={styles.hint}>
        {tab === 'Clonagem'
          ? 'Segure Alt para definir a origem, depois pinte o destino.'
          : 'Arraste para distorcer pixels livremente.'}
      </Text>
      <Slider label="Tamanho" value={size} min={1} max={200} onChange={setSize} />
      <Slider label="Dureza" value={hardness} min={0} max={100} onChange={setHardness} />
      <Slider label="Fluxo" value={flow} min={0} max={100} onChange={setFlow} />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
});
