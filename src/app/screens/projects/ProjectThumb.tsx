import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import { colors } from '@core/theme';
import type { Project } from '@modules/projects';
import { useCardThumb } from './cardThumb';
import { makeCardThumb } from './cardThumbMaker';

/** Card thumb of a project for a picker row. Shows a plain tile until the thumb is ready. */
export function ProjectThumb({
  project,
  style,
}: {
  project: Project;
  style: StyleProp<ImageStyle>;
}) {
  const uri = useCardThumb(project, makeCardThumb);
  if (!uri) return <View style={[style, { backgroundColor: colors.faixa }]} />;
  return <Image source={{ uri }} style={style} resizeMethod="resize" />;
}
