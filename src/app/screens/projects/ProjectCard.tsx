import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import type { Project } from '@modules/projects';
import { dateFormatter, formatDuration, formatTypeLabel, primaryAsset } from './projectFormat';

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
  const thumbUri = project.thumbnailUri ?? asset?.originalUri;
  const isVideo = project.type === 'video';
  const duration = formatDuration(asset?.metadata.durationMs);
  return (
    <Pressable
      style={[styles.card, isSelected && styles.cardSelected]}
      onLongPress={() => onLongPressProject(project)}
      onPress={() => onPressProject(project)}
    >
      <View style={styles.thumbWrap}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.thumb} resizeMethod="resize" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Icon name={isVideo ? 'film' : 'image'} size={28} color={colors.linha} />
          </View>
        )}
        {isVideo && (
          <>
            <View style={styles.playOverlay}>
              <View style={styles.playBadge}>
                <Icon name="play" size={16} color={colors.texto} />
              </View>
            </View>
            {duration && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{duration}</Text>
              </View>
            )}
          </>
        )}
        {multiSelect && (
          <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
            {isSelected && <Icon name="check" size={12} color={colors.preto} />}
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardName} numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={styles.cardMeta}>
            {dateFormatter.format(project.updatedAt)} · {formatTypeLabel(project)}
          </Text>
        </View>
        <Pressable hitSlop={8} onPress={() => onInfo(project)}>
          <Icon name="info" size={14} color={colors.texto2} />
        </Pressable>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  cardSelected: {
    borderColor: colors.acento,
  },
  thumbWrap: {
    aspectRatio: 1,
    backgroundColor: colors.faixa,
    position: 'relative',
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
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.texto,
  },
  checkCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.texto,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    borderColor: colors.acento,
    backgroundColor: colors.acento,
  },
  cardInfo: {
    padding: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  cardName: {
    fontSize: fontSize.xs,
    color: colors.texto,
    fontWeight: '500',
  },
  cardMeta: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.texto2,
    marginTop: 2,
  },
});
