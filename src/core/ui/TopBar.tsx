import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize } from '../theme';
import { Icon } from './Icon';

interface TopBarProps {
  title?: string;
  onMenuPress?: () => void;
  onBackPress?: () => void;
  right?: ReactNode;
  subtitle?: ReactNode;
}

/** Top bar with elevation, per spec: "nenhuma sombra, exceto elevação sutil sob a barra superior." */
export function TopBar({ title, onMenuPress, onBackPress, right, subtitle }: TopBarProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {onBackPress ? (
          <Pressable onPress={onBackPress} hitSlop={8} style={styles.iconButton}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        ) : onMenuPress ? (
          <Pressable onPress={onMenuPress} hitSlop={8} style={styles.iconButton}>
            <Icon name="menu" size={22} />
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        <View style={styles.right}>{right}</View>
      </View>
      {subtitle ? <View>{subtitle}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.barra,
    elevation: 4,
    shadowColor: colors.preto,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    zIndex: 10,
  },
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: colors.texto,
    fontSize: fontSize.lg,
    fontWeight: '500',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
