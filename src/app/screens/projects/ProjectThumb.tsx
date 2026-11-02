import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { Icon } from '@core/ui';
import { colors } from '@core/theme';
import type { Project } from '@modules/projects';
import { useCardThumb } from './cardThumb';
import { makeCardThumb } from './cardThumbMaker';
import { primaryAsset } from './projectFormat';
import { extremeAspectOf } from './thumbAspect';

/** A project's picture. Until there is one, or if its file is gone, a tile says what kind it is. */
export function ProjectThumb({
  project,
  style,
  contain,
  blurRadius,
}: {
  project: Project;
  style: StyleProp<ImageStyle>;
  /** Shows the whole picture instead of filling the frame. */
  contain?: boolean;
  blurRadius?: number;
}) {
  const uri = useCardThumb(project, makeCardThumb);
  if (!uri) {
    return (
      <View
        style={[
          style,
          { backgroundColor: colors.faixa, alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Icon name={project.type === 'video' ? 'video' : 'image'} size={22} color={colors.linha} />
      </View>
    );
  }
  const metadata = primaryAsset(project)?.metadata;
  const extreme = blurRadius ? null : extremeAspectOf(metadata?.width, metadata?.height);
  if (extreme) {
    return (
      <View style={[style, styles.extremeFrame]}>
        <Image
          source={{ uri }}
          style={[extreme > 1 ? styles.extremeWide : styles.extremeTall, { aspectRatio: extreme }]}
          resizeMode="stretch"
          resizeMethod="resize"
        />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={contain ? 'contain' : undefined}
      resizeMethod="resize"
      blurRadius={blurRadius}
    />
  );
}

const styles = StyleSheet.create({
  extremeFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.faixa,
  },
  extremeWide: {
    width: '100%',
  },
  extremeTall: {
    height: '100%',
  },
});
