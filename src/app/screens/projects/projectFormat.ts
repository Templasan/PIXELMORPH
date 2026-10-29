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

/** RF-037: platform codec names (MediaExtractor MIME) as people know them. */
const CODEC_NAMES: Record<string, string> = {
  'video/avc': 'H.264',
  'video/hevc': 'H.265 (HEVC)',
  'video/av01': 'AV1',
  'video/x-vnd.on2.vp9': 'VP9',
  'video/x-vnd.on2.vp8': 'VP8',
  'video/mp4v-es': 'MPEG-4',
  'video/3gpp': 'H.263',
  'audio/mp4a-latm': 'AAC',
  'audio/opus': 'Opus',
  'audio/vorbis': 'Vorbis',
  'audio/mpeg': 'MP3',
  'audio/flac': 'FLAC',
  'audio/3gpp': 'AMR',
  'audio/raw': 'PCM',
};

/** "H.264 + AAC" from a file's track codecs; unknown ones keep their MIME. */
function codecLabel(mimes: readonly string[]): string {
  return mimes.map((m) => CODEC_NAMES[m] ?? m).join(' + ');
}

export {
  codecLabel,
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
