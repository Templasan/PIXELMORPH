import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import type { Project } from '@modules/projects';
import { dateFormatter, formatDuration, formatTypeLabel, primaryAsset } from './projectFormat';
import { useCardThumb } from './cardThumb';
import { makeCardThumb } from './cardThumbMaker';

interface CardProps {
  project: Project;
  isSelected: boolean;
  multiSelect: boolean;
  onPressProject: (p: Project) => void;
  onLongPressProject: (p: Project) => void;
  onInfo: (p: Project) => void;
}

/** One tile of the media grid, in the manner of Vegas' Project Media and Bridge's thumbnails. */
export const ProjectCard = memo(function ProjectCard({
  project,
  isSelected,
  multiSelect,
  onPressProject,
  onLongPressProject,
  onInfo,
}: CardProps) {
  const asset = primaryAsset(project);
  const thumbUri = useCardThumb(project, makeCardThumb);
  const isVideo = project.type === 'video';
  const duration = formatDuration(asset?.metadata.durationMs);
  return (
    <Pressable
      style={styles.cell}
      onLongPress={() => onLongPressProject(project)}
      onPress={() => onPressProject(project)}
    >
      <View style={[styles.tile, isSelected && styles.tileSelected]}>
        <View style={styles.well}>
          {thumbUri ? (
            <Image source={{ uri: thumbUri }} style={styles.thumb} resizeMethod="resize" />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Icon name={isVideo ? 'film' : 'image'} size={24} color={colors.linha} />
            </View>
          )}
          <View style={styles.typeTag}>
            <Text style={styles.tagText}>{formatTypeLabel(project)}</Text>
          </View>
          {isVideo && duration && (
            <View style={styles.durationTag}>
              <Text style={styles.tagText}>{duration}</Text>
            </View>
          )}
          {multiSelect && (
            <View style={[styles.check, isSelected && styles.checkActive]}>
              {isSelected && <Icon name="check" size={11} color={colors.preto} />}
            </View>
          )}
        </View>
        <View style={styles.caption}>
          <View style={styles.captionText}>
            <Text style={styles.name} numberOfLines={1}>
              {project.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {dateFormatter.format(project.updatedAt)}
            </Text>
          </View>
          <Pressable hitSlop={10} onPress={() => onInfo(project)}>
            <Icon name="info" size={13} color={colors.texto2} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // A third of the row, with the gutter inside: the last tiles keep their width in a short row.
  cell: {
    width: '33.333%',
    padding: 2,
  },
  tile: {
    borderWidth: 1,
    borderColor: colors.linha,
    backgroundColor: colors.barra,
  },
  tileSelected: {
    borderColor: colors.acento,
    backgroundColor: colors.acentoFraco2,
  },
  well: {
    aspectRatio: 1,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 3,
    backgroundColor: colors.veuForte,
  },
  durationTag: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: 3,
    backgroundColor: colors.veuForte,
  },
  tagText: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xxs,
    color: colors.texto,
  },
  check: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.texto,
    backgroundColor: colors.veu,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: {
    borderColor: colors.acento,
    backgroundColor: colors.acento,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  captionText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 11,
    color: colors.texto,
  },
  meta: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xxs,
    color: colors.texto2,
  },
});
