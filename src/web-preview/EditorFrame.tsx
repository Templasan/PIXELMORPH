import { createElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize } from '@core/theme';

/** Web design preview only: the editor's own dev server in an iframe, with its hot reload. */
export function EditorFrame({ src, onBack }: { src: string; onBack: () => void }) {
  return (
    <View style={styles.page}>
      <Pressable style={styles.bar} onPress={onBack}>
        <Text style={styles.back}>‹ Voltar (só no preview)</Text>
      </Pressable>
      {createElement('iframe', {
        src,
        title: 'editor',
        allow: 'camera; microphone',
        style: { flex: 1, width: '100%', border: 0 },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  bar: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.barra,
  },
  back: { color: colors.texto2, fontSize: fontSize.xs },
});
