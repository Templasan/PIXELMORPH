import type { Project, ProjectPriority, MediaAsset } from '@modules/projects';
import { rawFormatLabel } from '@modules/photo-editor/domain';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function primaryAsset(project: Project): MediaAsset | undefined {
  return project.assets[0];
}

function formatTypeLabel(project: Project): string {
  const asset = primaryAsset(project);
  if (!asset) return project.type.toUpperCase();

  const raw = rawFormatLabel(asset.metadata.mimeType);
  if (raw) return raw;

  const subtype = asset.metadata.mimeType.split('/')[1]?.toUpperCase() ?? project.type;
  if (project.type === 'video') {
    const is4k = (asset.metadata.width ?? 0) >= 3840;
    return `${subtype === 'QUICKTIME' ? 'MOV' : subtype} ${is4k ? '· 4K' : ''}`.trim();
  }
  if (subtype === 'VND.ADOBE.PHOTOSHOP') return 'PSD';
  return subtype;
}

function formatDuration(durationMs: number | undefined): string | null {
  if (!durationMs) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

function formatBitRate(asset: MediaAsset | undefined): string {
  if (!asset?.metadata.durationMs || !asset.metadata.fileSizeBytes) return '—';
  const kbps = (asset.metadata.fileSizeBytes * 8) / asset.metadata.durationMs;
  return `${Math.round(kbps)} kbps`;
}

function daysUntil(date: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - startOfToday.getTime()) / msPerDay);
}

const priorityLabel: Record<ProjectPriority, string> = {
  low: 'baixa',
  medium: 'média',
  high: 'alta',
};

function formatDateInput(date: Date | undefined): string {
  if (!date) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export {
  dateFormatter,
  primaryAsset,
  formatTypeLabel,
  formatDuration,
  formatFileSize,
  formatBitRate,
  daysUntil,
  priorityLabel,
  formatDateInput,
};
