import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily, radius } from '@core/theme';
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
      style={styles.card}
      onLongPress={() => onLongPressProject(project)}
      onPress={() => onPressProject(project)}
    >
      <View style={[styles.thumbWrap, isSelected && styles.thumbSelected]}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.thumb} resizeMethod="resize" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Icon name={isVideo ? 'film' : 'image'} size={32} color={colors.linha} />
          </View>
        )}
        {isVideo && (
          <View style={styles.videoBadge}>
            <Icon name="play" size={10} color={colors.branco} />
            {duration && <Text style={styles.durationText}>{duration}</Text>}
          </View>
        )}
        {multiSelect && (
          <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
            {isSelected && <Icon name="check" size={12} color={colors.preto} />}
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardText}>
          <Text style={styles.cardName} numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {dateFormatter.format(project.updatedAt)} · {formatTypeLabel(project)}
          </Text>
        </View>
        <Pressable hitSlop={10} onPress={() => onInfo(project)} style={styles.infoButton}>
          <Icon name="info" size={16} color={colors.texto2} />
        </Pressable>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // Half of the row, with the gutter inside: the last card of an odd list keeps the same width.
  card: {
    width: '50%',
    paddingHorizontal: 6,
    paddingBottom: 16,
  },
  thumbWrap: {
    aspectRatio: 1,
    backgroundColor: colors.faixa,
    borderRadius: radius,
    overflow: 'hidden',
  },
  thumbSelected: {
    borderWidth: 2,
    borderColor: colors.acento,
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
  videoBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius,
    backgroundColor: colors.veuForte,
  },
  durationText: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xxs,
    color: colors.branco,
  },
  checkCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.texto,
    backgroundColor: colors.veu,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    borderColor: colors.acento,
    backgroundColor: colors.acento,
  },
  cardInfo: {
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: fontSize.sm,
    color: colors.texto,
    fontWeight: '500',
  },
  cardMeta: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xxs,
    color: colors.texto2,
    marginTop: 3,
  },
  infoButton: {
    paddingTop: 1,
  },
});
