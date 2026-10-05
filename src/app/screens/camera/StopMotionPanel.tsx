import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Slider } from '@core/ui';
import { colors } from '@core/theme';

interface Props {
  stopFps: number;
  onFpsChange: (fps: number) => void;
  stopFramesCount: number;
  onClear: () => void;
  onCompose: () => void;
  busy: boolean;
}

const StopMotionPanel = memo(function StopMotionPanel({
  stopFps,
  onFpsChange,
  stopFramesCount,
  onClear,
  onCompose,
  busy,
}: Props) {
  return (
    <View style={styles.stopFpsRow}>
      <Slider
        label="Taxa de reprodução"
        value={stopFps}
        min={1}
        max={24}
        unit=" fps"
        onChange={onFpsChange}
        labelWidth={110}
      />
      {stopFramesCount > 0 && (
        <View style={styles.stopActionRow}>
          <Pressable onPress={onClear} style={styles.stopActionBtn}>
            <Text style={styles.stopActionText}>Limpar</Text>
          </Pressable>
          <Pressable
            onPress={onCompose}
            style={[styles.stopActionBtn, styles.stopActionBtnPrimary]}
            disabled={busy}
          >
            <Text style={[styles.stopActionText, styles.stopActionTextPrimary]}>Compor Vídeo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  stopFpsRow: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  stopActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  stopActionBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopActionBtnPrimary: {
    backgroundColor: colors.acento,
    borderColor: colors.acento,
  },
  stopActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.texto,
  },
  stopActionTextPrimary: {
    color: '#0D2036',
  },
});

export default StopMotionPanel;
