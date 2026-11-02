import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@core/theme';
import type { Project } from '@modules/projects';
import { useI18n } from '@core/i18n';
import { daysUntil, priorityLabel } from './projectFormat';

interface ReminderBannerProps {
  pendingProjects: Project[];
  nearest: Project;
}

export function ReminderBanner({ pendingProjects, nearest }: ReminderBannerProps) {
  const { t } = useI18n();
  return (
    <View style={styles.reminderCard}>
      <View style={styles.reminderStripe} />
      <View style={{ flex: 1, paddingVertical: 4, paddingHorizontal: 8 }}>
        <Text style={styles.reminderTitle}>
          {pendingProjects.length === 1
            ? t('{n} projeto pendente', { n: pendingProjects.length })
            : t('{n} projetos pendentes', { n: pendingProjects.length })}
        </Text>
        <Text style={styles.reminderSubtitle}>
          {nearest.name}{' '}
          {(() => {
            const days = daysUntil(nearest.dueDate!);
            if (days < 0) return t('atrasado há {n} dia(s)', { n: Math.abs(days) });
            if (days === 0) return t('vence hoje');
            return t('vence em {n} dia(s)', { n: days });
          })()}
          {nearest.priority
            ? ` · ${t('Prioridade {p}', { p: t(priorityLabel[nearest.priority]) })}`
            : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reminderCard: {
    margin: 2,
    backgroundColor: colors.faixa,
    borderWidth: 1,
    borderColor: colors.linha,
    flexDirection: 'row',
  },
  reminderStripe: {
    width: 3,
    backgroundColor: colors.alerta,
  },
  reminderTitle: {
    fontSize: 11,
    color: colors.texto,
    fontWeight: '600',
  },
  reminderSubtitle: {
    fontSize: 11,
    color: colors.texto2,
    marginTop: 1,
  },
});
