import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { useI18n } from '@core/i18n';
import { useStore } from '@core/state';
import type { Project } from '@modules/projects';
import {
  dateFormatter,
  daysUntil,
  formatDuration,
  formatFileSize,
  formatTypeLabel,
  primaryAsset,
} from './projectFormat';
import { cardThumbPathOf, cardThumbStore } from './cardThumb';
import { ProjectThumb } from './ProjectThumb';
import { cropsInHighlight } from './thumbAspect';

export type ProjectLayout = 'grid' | 'list';

interface ItemProps {
  project: Project;
  isSelected: boolean;
  multiSelect: boolean;
  onPressProject: (p: Project) => void;
  onLongPressProject: (p: Project) => void;
}

const BADGE_BACKGROUND = 'rgba(0,0,0,0.7)';
const COVER_CANDIDATES = 8;
export const PROJECT_ROW_HEIGHT = 92;
/** Past this, the three lines of a row no longer fit its fixed height. */
const ROW_MAX_FONT_SCALE = 1.2;

function useDueLabel(project: Project): string | null {
  const { t } = useI18n();
  if (!project.dueDate) return null;
  const days = daysUntil(project.dueDate);
  if (days === 0) return t('Vence hoje');
  if (days === 1) return t('Vence amanhã');
  if (days === -1) return t('Atrasado há 1 dia');
  if (days < 0) return t('Atrasado há {n} dias', { n: -days });
  return t('Vence em {n} dias', { n: days });
}

function Duration({ project }: { project: Project }) {
  const duration =
    project.type === 'video' ? formatDuration(primaryAsset(project)?.metadata.durationMs) : null;
  if (!duration) return null;
  return (
    <View style={styles.duration}>
      <Text style={styles.durationText}>{duration}</Text>
    </View>
  );
}

function Check({ isSelected }: { isSelected: boolean }) {
  return (
    <View style={[styles.check, isSelected && styles.checkActive]}>
      {isSelected && <Icon name="check" size={13} color={colors.preto} />}
    </View>
  );
}

/** A square picture: the rail of the current week and the grid inside a month. */
export const ProjectTile = memo(function ProjectTile({
  project,
  isSelected,
  multiSelect,
  onPressProject,
  onLongPressProject,
}: ItemProps) {
  return (
    <Pressable
      style={styles.tile}
      onPress={() => onPressProject(project)}
      onLongPress={() => onLongPressProject(project)}
      accessibilityLabel={project.name}
    >
      <ProjectThumb project={project} style={styles.fill} />
      <Duration project={project} />
      {multiSelect && <Check isSelected={isSelected} />}
      {/* A separate ring: changing this clipped tile's own border left its picture clipped away until the grid was rebuilt. */}
      {isSelected && <View pointerEvents="none" style={styles.tileRing} />}
    </Pressable>
  );
});

/** A line of the list view: the only view that shows every detail. */
export const ProjectRow = memo(function ProjectRow({
  project,
  isSelected,
  multiSelect,
  onPressProject,
  onLongPressProject,
}: ItemProps) {
  const size = formatFileSize(primaryAsset(project)?.metadata.fileSizeBytes);
  const due = useDueLabel(project);
  return (
    <Pressable
      style={[styles.row, isSelected && styles.rowSelected]}
      onPress={() => onPressProject(project)}
      onLongPress={() => onLongPressProject(project)}
    >
      <View style={styles.rowThumb}>
        <ProjectThumb project={project} style={styles.fill} />
        <Duration project={project} />
        {multiSelect && <Check isSelected={isSelected} />}
      </View>
      <View style={styles.rowText}>
        <Text maxFontSizeMultiplier={ROW_MAX_FONT_SCALE} style={styles.rowName} numberOfLines={1}>
          {project.name}
        </Text>
        <Text maxFontSizeMultiplier={ROW_MAX_FONT_SCALE} style={styles.rowMeta} numberOfLines={1}>
          {dateFormatter.format(project.updatedAt)} · {formatTypeLabel(project)} · {size}
        </Text>
        {due && (
          <Text maxFontSizeMultiplier={ROW_MAX_FONT_SCALE} style={styles.rowDue} numberOfLines={1}>
            {due}
          </Text>
        )}
      </View>
      {!multiSelect && <Icon name="chevronRight" size={20} color={colors.texto2} />}
    </Pressable>
  );
});

/** The latest project, large: what the user most likely came back for. */
export function ProjectHero({
  project,
  onPress,
  onLongPress,
  onOpen,
  multiSelect,
  isSelected,
}: {
  project: Project;
  onPress: (p: Project) => void;
  onLongPress: (p: Project) => void;
  onOpen: (p: Project) => void;
  multiSelect: boolean;
  isSelected: boolean;
}) {
  const { t } = useI18n();
  const due = useDueLabel(project);
  const heroMeta = primaryAsset(project)?.metadata;
  const age = -daysUntil(project.updatedAt);
  const edited =
    age <= 0
      ? t('Editado hoje')
      : age === 1
        ? t('Editado ontem')
        : t('Editado em {date}', { date: dateFormatter.format(project.updatedAt) });
  return (
    <Pressable
      style={[styles.hero, isSelected && styles.tileSelected]}
      accessibilityLabel={project.name}
      onPress={() => onPress(project)}
      onLongPress={() => onLongPress(project)}
    >
      {cropsInHighlight(heroMeta?.width, heroMeta?.height) ? (
        // The whole picture, over a blurred copy of itself so the frame never looks empty.
        <>
          <ProjectThumb project={project} style={styles.fill} blurRadius={20} />
          <View style={styles.heroWhole}>
            <ProjectThumb project={project} style={styles.fill} contain />
          </View>
        </>
      ) : (
        <ProjectThumb project={project} style={styles.fill} />
      )}
      <View style={styles.heroCaption}>
        <View style={styles.heroText}>
          <Text style={styles.heroName} numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={styles.heroMeta} numberOfLines={1}>
            {due ? `${edited} · ${due}` : edited}
          </Text>
        </View>
        {!multiSelect && (
          <Pressable style={styles.heroOpen} onPress={() => onOpen(project)}>
            <Text style={styles.heroOpenText}>{t('Abrir')}</Text>
          </Pressable>
        )}
      </View>
      {multiSelect && <Check isSelected={isSelected} />}
    </Pressable>
  );
}

/** The first picture of the group that exists: a project whose file is gone must not be the face. */
function GroupCover({ projects }: { projects: Project[] }) {
  const statuses = useStore(cardThumbStore);
  const cover =
    projects
      .slice(0, COVER_CANDIDATES)
      .find((p) => statuses[cardThumbPathOf(p) ?? ''] !== 'failed') ?? projects[0];
  return <ProjectThumb key={cover.id} project={cover} style={styles.fill} />;
}

/** A month or year, collapsed by default so the screen stays short however many projects exist. */
export function ProjectGroupRow({
  label,
  count,
  projects,
  expanded,
  multiSelect,
  isSelected,
  onPress,
  onLongPress,
}: {
  label: string;
  count: number;
  projects: Project[];
  expanded: boolean;
  multiSelect: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.groupRow, isSelected && styles.rowSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ expanded, selected: isSelected }}
    >
      <View style={styles.groupCover}>
        <GroupCover projects={projects} />
      </View>
      <Text style={styles.groupName} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.groupCount}>{count}</Text>
      {multiSelect ? (
        <View style={[styles.groupCheck, isSelected && styles.checkActive]}>
          {isSelected && <Icon name="check" size={13} color={colors.preto} />}
        </View>
      ) : (
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={20} color={colors.texto2} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.faixa,
  },
  tileRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.branco,
  },
  tileSelected: {
    borderWidth: 3,
    borderColor: colors.branco,
  },
  duration: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: BADGE_BACKGROUND,
  },
  durationText: {
    fontSize: 11,
    color: colors.branco,
  },
  check: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.branco,
    backgroundColor: colors.veu,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: {
    backgroundColor: colors.branco,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: PROJECT_ROW_HEIGHT,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.barra,
  },
  rowSelected: {
    backgroundColor: colors.barra,
  },
  rowThumb: {
    width: 96,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.faixa,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.texto,
  },
  rowMeta: {
    marginTop: 4,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  rowDue: {
    marginTop: 4,
    fontSize: fontSize.xs,
    color: colors.alerta,
  },
  hero: {
    marginHorizontal: 16,
    height: 170,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.faixa,
  },
  // Stops above the caption, which would otherwise cover part of the picture.
  heroWhole: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 64,
  },
  heroCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: BADGE_BACKGROUND,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.branco,
  },
  heroMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  heroOpen: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.texto,
  },
  heroOpenText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.canvas,
  },
  groupRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.barra,
  },
  groupCover: {
    width: 38,
    height: 38,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.faixa,
  },
  groupName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.texto,
  },
  groupCount: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  groupCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
