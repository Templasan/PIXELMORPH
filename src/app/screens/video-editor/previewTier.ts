/**
 * Preview quality tiers of the web engine. Pure (no RN, DOM or Skia) so Jest can test it and the
 * DOM bundle can import it. Export ALWAYS uses the originals; tiers only change the preview.
 */
export type Tier = 'alta' | 'media' | 'baixa';
export type TierSetting = 'auto' | Tier;

export interface TierSpec {
  label: string;
  /** Long edge of the proxy the preview decodes; null: the sources as they are. */
  proxyLongEdge: number | null;
  canvas: { width: number; height: number };
  /** Video layers that decode live; the rest show their last decoded frame while playing. */
  maxLiveLayers: number;
}

export const TIER_SPECS: Record<Tier, TierSpec> = {
  alta: {
    label: 'Alta',
    proxyLongEdge: null,
    canvas: { width: 1920, height: 1080 },
    maxLiveLayers: 8,
  },
  media: {
    label: 'Média',
    proxyLongEdge: 1280,
    canvas: { width: 1920, height: 1080 },
    maxLiveLayers: 8,
  },
  baixa: {
    label: 'Baixa',
    proxyLongEdge: 960,
    canvas: { width: 1280, height: 720 },
    maxLiveLayers: 2,
  },
};

export interface TierEnv {
  /** navigator.deviceMemory in GB (a coarse bucket: 0.25 .. 8); undefined where unsupported. */
  deviceMemoryGb: number | undefined;
  /** VideoDecoder.isConfigSupported(1080p, prefer-hardware) said yes. */
  hardware1080: boolean;
}

/** <=3 GB: Baixa, <=6 GB: Média, else Alta; without 1080p hardware decode never above Média. */
export function autoTier(env: TierEnv): Tier {
  const gb = env.deviceMemoryGb;
  let tier: Tier = gb === undefined ? 'media' : gb <= 3 ? 'baixa' : gb <= 6 ? 'media' : 'alta';
  if (tier === 'alta' && !env.hardware1080) tier = 'media';
  return tier;
}

export function stepDownTier(tier: Tier): Tier {
  return tier === 'alta' ? 'media' : 'baixa';
}

/**
 * The tier in use: a manual choice wins; Automática is the env tier, lowered by the (once per
 * session) automatic step down.
 */
export function resolveTier(setting: TierSetting, auto: Tier, steppedDown: boolean): Tier {
  if (setting !== 'auto') return setting;
  return steppedDown ? stepDownTier(auto) : auto;
}

export const DROP_WINDOW_MS = 5000;
export const DROP_THRESHOLD = 0.1;
/** Fewer layer draws than this in a window say nothing (paused, idle). */
const MIN_DRAWS = 30;

/** Pure: more than 10 % of the window's layer draws late or dropped. */
export function isSustainedDrop(draws: number, bad: number): boolean {
  return draws >= MIN_DRAWS && bad / draws > DROP_THRESHOLD;
}

/**
 * Feeds one layer draw at a time (`badCount`: that draw showed a late frame, or frames were
 * dropped to catch up). Every 5 s window is judged on its own; returns true when the window just
 * closed with a sustained drop.
 */
export function createDropMonitor(windowMs = DROP_WINDOW_MS) {
  let start = -1;
  let draws = 0;
  let bad = 0;
  return {
    sample(nowMs: number, badCount: number): boolean {
      if (start < 0) start = nowMs;
      draws += 1;
      bad += badCount;
      if (nowMs - start < windowMs) return false;
      const hit = isSustainedDrop(draws, bad);
      start = nowMs;
      draws = 0;
      bad = 0;
      return hit;
    },
    reset() {
      start = -1;
      draws = 0;
      bad = 0;
    },
  };
}
