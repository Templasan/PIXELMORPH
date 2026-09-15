import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavigationProp } from '@react-navigation/native';
import { colors, fontSize, monoFontFamily } from '../theme';
import { Icon } from './Icon';
import type { RootStackParamList } from '../../app/navigation/RootNavigator';

export type DrawerScreenName = Extract<
  keyof RootStackParamList,
  'Projects' | 'Camera' | 'Community' | 'Tutorials' | 'Presets' | 'Storage' | 'Account' | 'Help'
>;

interface NavItem {
  icon: string;
  label: string;
  screen: DrawerScreenName;
}

const navItems: NavItem[] = [
  { icon: 'folder', label: 'Projetos', screen: 'Projects' },
  { icon: 'camera', label: 'Câmera', screen: 'Camera' },
  { icon: 'users', label: 'Comunidade', screen: 'Community' },
  { icon: 'bookOpen', label: 'Tutoriais', screen: 'Tutorials' },
  { icon: 'star', label: 'Presets', screen: 'Presets' },
  { icon: 'save', label: 'Armazenamento', screen: 'Storage' },
];

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  navigation: NavigationProp<RootStackParamList>;
  current: DrawerScreenName;
}

/**
 * Left navigation drawer, 312px wide, opened via the hamburger icon in the top bar.
 * Rendered as an absolute overlay by each screen — this is UI state, not a route.
 */
export function SideDrawer({ open, onClose, navigation, current }: SideDrawerProps) {
  const insets = useSafeAreaInsets();
  if (!open) return null;

  const go = (screen: DrawerScreenName) => {
    onClose();
    navigation.navigate(screen);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.veil} onPress={onClose} />
      {/* This overlay sits inside a screen's own SafeAreaView, whose top padding an
          absolutely-positioned child ignores — re-apply it here so the drawer doesn't
          render under the status bar. */}
      <View style={[styles.drawer, { paddingTop: insets.top }]}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>JS</Text>
          </View>
          <View>
            <Text style={styles.profileName}>João Silva</Text>
            <Text style={styles.profileEmail}>joao@pixelmorph.com</Text>
          </View>
        </View>

        <ScrollView style={styles.list}>
          {navItems.map(({ icon, label, screen }) => {
            const isActive = current === screen;
            return (
              <Pressable
                key={screen}
                onPress={() => go(screen)}
                style={[styles.item, isActive && styles.itemActive]}
              >
                <Icon name={icon} size={20} color={isActive ? colors.acento : colors.icone} />
                <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}

          <View style={styles.divider} />

          <Pressable
            onPress={() => go('Account')}
            style={[styles.item, current === 'Account' && styles.itemActive]}
          >
            <Icon
              name="settings"
              size={20}
              color={current === 'Account' ? colors.acento : colors.icone}
            />
            <Text style={[styles.itemLabel, current === 'Account' && styles.itemLabelActive]}>
              Conta e preferências
            </Text>
          </Pressable>
          <Pressable
            onPress={() => go('Help')}
            style={[styles.item, current === 'Help' && styles.itemActive]}
          >
            <Icon name="help" size={20} color={current === 'Help' ? colors.acento : colors.icone} />
            <Text style={[styles.itemLabel, current === 'Help' && styles.itemLabelActive]}>
              Ajuda
            </Text>
          </Pressable>
        </ScrollView>

        <View style={styles.storageFooter}>
          <Text style={styles.storageText}>4,2 GB de 10 GB usados</Text>
          <View style={styles.storageTrack}>
            <View style={styles.storageFill} />
          </View>
        </View>
      </View>
    </View>
  );
}

const DRAWER_WIDTH = 312;

const styles = StyleSheet.create({
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.veu,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.barra,
    borderRightWidth: 1,
    borderRightColor: colors.linha,
  },
  profile: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.branco,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  profileName: {
    fontSize: fontSize.md,
    color: colors.texto,
    fontWeight: '500',
  },
  profileEmail: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  list: {
    flex: 1,
    paddingTop: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemActive: {
    backgroundColor: colors.acentoFraco,
  },
  itemLabel: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  itemLabelActive: {
    color: colors.acento,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    marginTop: 8,
    paddingTop: 8,
  },
  storageFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  storageText: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginBottom: 6,
  },
  storageTrack: {
    height: 2,
    backgroundColor: colors.linha,
  },
  storageFill: {
    width: '42%',
    height: '100%',
    backgroundColor: colors.acento,
  },
});
