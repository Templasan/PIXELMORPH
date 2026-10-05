import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors } from '@core/theme';

type Tool =
  | 'ajustes'
  | 'geometria'
  | 'mascaras'
  | 'retoque'
  | 'camadas'
  | 'efeitos'
  | 'elementos'
  | 'ia'
  | 'presets'
  | 'panorama'
  | null;

export const TOOLBAR = [
  { id: 'ajustes', icon: 'sliders', label: 'Ajustes' },
  { id: 'geometria', icon: 'crop', label: 'Geometria' },
  { id: 'mascaras', icon: 'mask', label: 'Máscaras' },
  { id: 'retoque', icon: 'retouch', label: 'Retoque' },
  { id: 'camadas', icon: 'layers', label: 'Camadas' },
  { id: 'efeitos', icon: 'effects', label: 'Efeitos' },
  { id: 'elementos', icon: 'type', label: 'Elementos' },
  { id: 'ia', icon: 'robot', label: 'IA' },
  { id: 'presets', icon: 'preset', label: 'Presets' },
  { id: 'panorama', icon: 'camera', label: 'Panorama' },
] as const;

/** Tool ids in toolbar order (the 3-finger double-tap shortcut cycles through them). */
export const TOOL_ORDER: readonly string[] = TOOLBAR.map((t) => t.id);

interface EditorToolbarProps {
  activeTool: Tool;
  onToggleTool: (tool: Exclude<Tool, null>) => void;
}

export const EditorToolbar = memo(function EditorToolbar({
  activeTool,
  onToggleTool,
}: EditorToolbarProps) {
  return (
    <View style={styles.bottomToolbar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {TOOLBAR.map(({ id, icon, label }) => {
          const isActive = activeTool === id;
          return (
            <Pressable
              key={id}
              style={[styles.toolbarItem, isActive && styles.toolbarItemActive]}
              onPress={() => onToggleTool(id as Exclude<Tool, null>)}
            >
              <Icon name={icon as any} size={22} color={isActive ? colors.acento : colors.icone} />
              <Text style={[styles.toolbarLabel, isActive && styles.toolbarLabelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  bottomToolbar: {
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  toolbarItem: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toolbarItemActive: {
    backgroundColor: colors.canvas,
  },
  toolbarLabel: {
    fontSize: 10,
    color: colors.texto2,
  },
  toolbarLabelActive: {
    color: colors.acento,
  },
});
