import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Slider, Tabs } from '@core/ui';
import { colors, fontSize } from '@core/theme';

const TABS = ['Pincel', 'Cor', 'Foco', 'Gradiente'] as const;
type MaskTab = (typeof TABS)[number];

/** Máscaras drawer. TODO: the red mask overlay + brush cursor on canvas is not implemented. */
export function MasksDrawer() {
  const [tab, setTab] = useState<MaskTab>('Pincel');
  const [size, setSize] = useState(40);
  const [hardness, setHardness] = useState(80);
  const [flow, setFlow] = useState(100);
  const [tolerance, setTolerance] = useState(30);
  const [exposure, setExposure] = useState(0);
  const [contrast, setContrast] = useState(0);

  return (
    <View>
      <Tabs tabs={TABS} active={tab} onChange={setTab} scrollable />
      <Slider label="Tamanho" value={size} min={1} max={200} onChange={setSize} />
      <Slider label="Dureza" value={hardness} min={0} max={100} onChange={setHardness} />
      <Slider label="Fluxo" value={flow} min={0} max={100} onChange={setFlow} />
      <Slider label="Tolerância" value={tolerance} min={0} max={100} onChange={setTolerance} />
      <View style={styles.innerAdjustments}>
        <Text style={styles.innerLabel}>Ajustes dentro da máscara</Text>
        <Slider
          label="Exposição"
          value={exposure}
          min={-100}
          max={100}
          bipolar
          showSign
          onChange={setExposure}
        />
        <Slider
          label="Contraste"
          value={contrast}
          min={-100}
          max={100}
          bipolar
          showSign
          onChange={setContrast}
        />
      </View>
      {/* TODO: mask thumbnail row with eye toggles per saved mask is not implemented. */}
    </View>
  );
}

const styles = StyleSheet.create({
  innerAdjustments: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  innerLabel: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginBottom: 6,
  },
});
