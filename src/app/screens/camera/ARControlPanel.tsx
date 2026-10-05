import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, Slider } from '@core/ui';
import { colors } from '@core/theme';
import { createARAnchor, updateARAppearance, type ARSession } from '@modules/camera/ar';

interface Props {
  arSession: ARSession;
  onSessionChange: (session: ARSession) => void;
  selectedAnchorId: string | null;
  onAnchorSelect: (id: string | null) => void;
  arScaleDraft: { id: string; v: number } | null;
  onScaleDraftChange: (draft: { id: string; v: number } | null) => void;
}

const ARControlPanel = memo(function ARControlPanel({
  arSession,
  onSessionChange,
  selectedAnchorId,
  onAnchorSelect,
  arScaleDraft,
  onScaleDraftChange,
}: Props) {
  const handleAddAnchor = () => {
    const newAnchor = createARAnchor('circle', 0.5, 0.5);
    onSessionChange({
      ...arSession,
      anchors: [...arSession.anchors, newAnchor],
    });
    onAnchorSelect(newAnchor.id);
  };

  const handleScaleComplete = (v: number) => {
    onScaleDraftChange(null);
    const anchor = arSession.anchors.find((a) => a.id === selectedAnchorId);
    if (!anchor) return;
    const updated = updateARAppearance(anchor, v / 100, anchor.rotation, anchor.color);
    onSessionChange({
      ...arSession,
      anchors: arSession.anchors.map((a) => (a.id === selectedAnchorId ? updated : a)),
    });
  };

  const handleDeleteAnchor = () => {
    const idx = arSession.anchors.findIndex((a) => a.id === selectedAnchorId);
    if (idx >= 0) {
      onSessionChange({
        ...arSession,
        anchors: arSession.anchors.filter((_, i) => i !== idx),
      });
      onAnchorSelect(null);
    }
  };

  return (
    <View style={styles.arControlPanel}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <Text style={{ color: colors.texto, fontSize: 12, fontWeight: '600' }}>
          📍 {arSession.anchors.length} âncoras
        </Text>
        <Pressable onPress={handleAddAnchor} style={{ paddingHorizontal: 8 }}>
          <Icon name="plus" size={20} color={colors.acento} />
        </Pressable>
      </View>

      {selectedAnchorId && arSession.anchors.find((a) => a.id === selectedAnchorId) && (
        <View style={{ gap: 8, paddingHorizontal: 12, paddingBottom: 8 }}>
          <Slider
            label="Escala"
            value={
              arScaleDraft?.id === selectedAnchorId
                ? arScaleDraft.v
                : (arSession.anchors.find((a) => a.id === selectedAnchorId)?.scale ?? 1) * 100
            }
            min={50}
            max={200}
            unit="%"
            onChange={(v: number) => onScaleDraftChange({ id: selectedAnchorId, v })}
            onSlidingComplete={handleScaleComplete}
            labelWidth={50}
          />
          <Pressable
            onPress={handleDeleteAnchor}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: colors.perigo,
              borderRadius: 4,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.branco, fontSize: 12, fontWeight: '600' }}>
              Remover Âncora
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  arControlPanel: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
});

export default ARControlPanel;
