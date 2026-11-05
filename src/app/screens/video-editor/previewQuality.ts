// Which preview copies each preview tier reads. Pure (no RN, no proxy store import) so Jest can
// test it. The tiers are chosen in the web editor (domain/previewQuality.ts).
import { proxyKey, type ProxyVariant } from './previewTier';

export type PreviewTier = 'alta' | 'media' | 'baixa';

/** The copies a tier's preview reads, lightest first: Baixa 540 (1080 for a file above it), Média 720, Alta 1080. */
export function variantsOf(tier: PreviewTier): ProxyVariant[] {
  return tier === 'baixa' ? ['540', '1080'] : tier === 'media' ? ['720'] : ['1080'];
}

/** The part of a proxy entry this mapping reads (ProxyEntry in previewProxy.ts has all of it). */
interface CopyEntry {
  status: string;
  progress: number;
  uri?: string;
  partialUri?: string;
}

export interface PreviewCopies {
  /** Copies still being made for these sources at this tier (the page waits for them). */
  pendingKeys: string[];
  /** Original uri → the finished copy the preview reads now. */
  map: Record<string, string>;
  /** Original uri → a copy still being written, readable up to `progress` percent. */
  partial: Record<string, { file: string; progress: number }>;
}

/** What the preview reads for `uris` at `tier`, given the proxy store's state. */
export function previewCopiesOf(
  tier: PreviewTier,
  uris: readonly string[],
  state: Record<string, CopyEntry | undefined>
): PreviewCopies {
  const variants = variantsOf(tier);
  const pendingKeys = uris
    .flatMap((uri) => variants.map((variant) => proxyKey(uri, variant)))
    .filter((key) => state[key]?.status === 'pending' || state[key]?.status === 'running');
  const map: Record<string, string> = {};
  const partial: Record<string, { file: string; progress: number }> = {};
  for (const uri of uris) {
    // The lightest finished copy wins (Baixa: 540 before 1080).
    const ready = variants
      .map((variant) => state[proxyKey(uri, variant)])
      .find((e) => e?.status === 'ready');
    if (ready?.uri) map[uri] = ready.uri;
    // A copy still being written can be read in part; only Baixa and Alta use the 1080 one.
    const full = variants.includes('1080') ? state[proxyKey(uri, '1080')] : undefined;
    if (full?.status === 'running' && full.partialUri) {
      partial[uri] = { file: full.partialUri, progress: Math.floor(full.progress) };
    }
  }
  return { pendingKeys, map, partial };
}
