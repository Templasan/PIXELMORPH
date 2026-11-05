/**
 * Preview quality: which copy the preview decodes and how much it draws. Export always reads the
 * originals. The tier rules below are also in photo-editor-web/src/domain/previewQuality.ts (the
 * two pages are separate bundles): keep those lines identical in both.
 */
export type Tier = 'alta' | 'media' | 'baixa';
/** What the person picked: a tier, or 'auto' (the tier the phone's memory suggests). */
export type QualitySetting = 'auto' | Tier;

/** Automatic tier from navigator.deviceMemory (GB). Unknown counts as Média. */
export function autoTier(deviceMemoryGb: number | undefined): Tier {
  if (deviceMemoryGb === undefined) return 'media';
  return deviceMemoryGb <= 3 ? 'baixa' : deviceMemoryGb <= 6 ? 'media' : 'alta';
}

/** The tier in use: the person's pick, or the automatic one. */
export function tierOf(setting: QualitySetting, deviceMemoryGb: number | undefined): Tier {
  return setting === 'auto' ? autoTier(deviceMemoryGb) : setting;
}

/** The app sets window.__pmQuality before the page loads; anything else means 'auto'. */
export function qualitySettingOf(raw: unknown): QualitySetting {
  return raw === 'alta' || raw === 'media' || raw === 'baixa' ? raw : 'auto';
}

/** Preview short edge per tier. Baixa is the old low-end path, Média the normal one. */
export const PREVIEW_SHORT_EDGE: Record<Tier, number> = { alta: 1080, media: 720, baixa: 540 };

/** Video layers that keep decoding while playing (the rest hold their frame). */
export const LIVE_LAYER_CAP: Record<Tier, number> = { alta: 8, media: 4, baixa: 2 };
