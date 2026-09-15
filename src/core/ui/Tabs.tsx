import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize } from '../theme';

interface TabsProps<T extends string> {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  scrollable?: boolean;
}

/** Uppercase text tabs used at the top of every screen and inside every tool drawer. */
export function Tabs<T extends string>({ tabs, active, onChange, scrollable }: TabsProps<T>) {
  const content = (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <Pressable key={tab} onPress={() => onChange(tab)} style={styles.tab}>
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {tab}
            </Text>
            <View style={[styles.underline, isActive && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.container, styles.scrollableContainer]}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    backgroundColor: colors.barra,
  },
  scrollableContainer: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
  },
  tab: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
  },
  label: {
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
    color: colors.texto2,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.texto,
  },
  underline: {
    marginTop: 8,
    height: 2,
    width: '100%',
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: colors.acento,
  },
});
