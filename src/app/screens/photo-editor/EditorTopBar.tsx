import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';

interface EditorTopBarProps {
  projectName: string;
  canUndo: boolean;
  canRedo: boolean;
  compareMode: boolean;
  hasProjectId: boolean;
  onNavigateBack: () => void;
  onToggleCompare: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onBatchEdit: () => void;
  onMaskPainter: () => void;
  onExport: () => void;
}

export const EditorTopBar = memo(function EditorTopBar({
  projectName,
  canUndo,
  canRedo,
  compareMode,
  hasProjectId,
  onNavigateBack,
  onToggleCompare,
  onUndo,
  onRedo,
  onBatchEdit,
  onMaskPainter,
  onExport,
}: EditorTopBarProps) {
  const unsavedDot = canUndo;

  return (
    <View style={styles.topBar}>
      <Pressable onPress={onNavigateBack} hitSlop={8}>
        <Icon name="chevronLeft" size={20} />
      </Pressable>
      <Text style={styles.fileName} numberOfLines={1}>
        {projectName} {unsavedDot && <Text style={styles.unsavedDot}>●</Text>}
      </Text>
      <Pressable onPress={onToggleCompare} hitSlop={6}>
        <Icon name="compare" size={18} color={compareMode ? colors.acento : colors.icone} />
      </Pressable>
      <Pressable onPress={onUndo} disabled={!canUndo} hitSlop={6}>
        <Icon name="undo" size={18} color={canUndo ? colors.icone : colors.linha} />
      </Pressable>
      <Pressable onPress={onRedo} disabled={!canRedo} hitSlop={6}>
        <Icon name="redo" size={18} color={canRedo ? colors.icone : colors.linha} />
      </Pressable>
      {hasProjectId && (
        <Pressable onPress={onBatchEdit} hitSlop={6}>
          <Icon name="copy" size={18} color={colors.icone} />
        </Pressable>
      )}
      <Pressable onPress={onMaskPainter} hitSlop={6}>
        <Icon name="layers" size={18} color={colors.icone} />
      </Pressable>
      <Pressable style={styles.exportButton} onPress={onExport}>
        <Text style={styles.exportButtonText}>EXPORTAR</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  topBar: {
    height: 48,
    backgroundColor: colors.barra,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    elevation: 4,
  },
  fileName: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  unsavedDot: {
    color: colors.perigo,
  },
  exportButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.acento,
  },
  exportButtonText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#0D2036',
  },
});
