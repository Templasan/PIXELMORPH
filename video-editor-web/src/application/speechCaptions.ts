import { DEFAULT_TEXT } from '../domain/textCaption';
import { clipEndMs, createClip, type Clip } from '../domain/Track';
import { t } from '../i18n';
import type { SpeechSegment } from '../ports/host';
import { captionName } from './textEdit';

/** Smaller than a title, so a line of speech fits. */
const CAPTION_SIZE = 0.05;
const MIN_CAPTION_MS = 300;
/** The model's way of writing "no speech here": [Music], (applause), [BLANK_AUDIO]. */
const NOT_SPEECH = /^[[(*♪].*[\])*♪]$/;

/**
 * RF-069: text clips, ordinary and editable, for what was said in a clip. Segment times count from
 * the clip's in-point, in the source's time, so the clip's speed and place on the timeline apply.
 */
export function captionClips(segments: readonly SpeechSegment[], clip: Clip, color: string): Clip[] {
  const speed = clip.speed ?? 1;
  const end = clipEndMs(clip);
  const out: Clip[] = [];
  let free = clip.startMs;
  for (const segment of segments) {
    const content = segment.text.trim();
    if (!content || NOT_SPEECH.test(content)) continue;
    const startMs = Math.max(free, Math.round(clip.startMs + segment.startMs / speed));
    const stopMs = Math.min(end, Math.round(clip.startMs + segment.endMs / speed));
    const durationMs = Math.max(stopMs - startMs, MIN_CAPTION_MS);
    if (startMs >= end) break;
    out.push({
      ...createClip({
        name: captionName(content),
        sourceUri: '',
        color,
        startMs,
        sourceDurationMs: durationMs,
        outPointMs: durationMs,
      }),
      // Lines follow each other: a fade on each would make them blink.
      text: {
        ...DEFAULT_TEXT,
        content,
        size: CAPTION_SIZE,
        animIn: { type: 'none', ms: 0 },
        animOut: { type: 'none', ms: 0 },
      },
    });
    free = startMs + durationMs;
  }
  return out;
}

/** What to tell the person, from the code the app answered with. */
export function speechErrorText(code: string): string {
  switch (code) {
    case 'NO_AUDIO':
      return t('Este clipe não tem som.');
    case 'NETWORK':
      return t('Sem conexão para baixar o modelo. Tente de novo com internet.');
    case 'BAD_MODEL':
      return t('O modelo baixado veio com defeito. Tente de novo.');
    case 'TOO_LONG':
      return t('O clipe passa de 30 minutos. Divida antes de gerar as legendas.');
    case 'NO_ENGINE':
      return t('Este aparelho não consegue gerar legendas.');
    default:
      return t('Não foi possível gerar as legendas.');
  }
}
