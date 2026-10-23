/**
 * Preview quality tiers of the web engine. Pure (no RN, DOM or Skia) so Jest can test it and the
 * DOM bundle can import it. Export ALWAYS uses the originals; tiers only change the preview.
 */
/** The web side's status when the System WebView has no WebCodecs (also the fallback trigger). */
export const NEEDS_WEBVIEW = 'O motor de vídeo precisa do Android System WebView atualizado';

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

/**
 * The automatic tier from the device. Sources above 1080p no longer drop it to Média: Alta decodes
 * their 1080p proxy (see previewUriFor), not the 4K original.
 */
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

/**
 * '720': the editor's default proxy (every editor needs it). '540': only the web engine's Baixa
 * tier asks for it; '1080': only Alta, for sources above 1080p (a 4K original decodes at 29 fps
 * with 1.8 s seeks on the Poco, and the Alta canvas is 1920×1080 anyway). Their entries sit in
 * proxyStore under `<source uri>#540` / `#1080`.
 */
export type ProxyVariant = '720' | '540' | '1080';
/** The proxyStore key of a source's proxy. */
export const proxyKey = (sourceUri: string, variant: ProxyVariant = '720') =>
  variant === '720' ? sourceUri : `${sourceUri}#${variant}`;

/** Proxy state the preview needs (mirrors previewProxy's ProxyEntry). */
export interface ProxyState {
  status: string;
  uri?: string;
}

/** Which file the preview decodes for `uri` at `tier` (export never uses this). */
export function previewUriFor(tier: Tier, state: Record<string, ProxyState>, uri: string): string {
  const ready = (key: string) => (state[key]?.status === 'ready' ? state[key].uri : undefined);
  const p720 = ready(proxyKey(uri));
  if (tier === 'alta') {
    // Up to 1080p ('none': no 1080p proxy needed) the original is fine; above it, the 720p proxy
    // stands in until the 1080p one exists (or if it failed), instead of decoding the 4K original.
    if (state[proxyKey(uri, '1080')]?.status === 'none') return uri;
    return ready(proxyKey(uri, '1080')) ?? p720 ?? uri;
  }
  return tier === 'baixa' ? (ready(proxyKey(uri, '540')) ?? p720 ?? uri) : (p720 ?? uri);
}
