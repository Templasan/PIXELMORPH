import { t } from '../i18n';

/** What the editor says when this device cannot decode a file (the decoder's own text is not shown). */
export const UNDECODABLE_TEXT = 'Este aparelho não conseguiu mostrar este vídeo.';

/**
 * The text the player's error shows, or null when it should not show at all. A decoding failure
 * while a light copy is being made stays quiet: the 'Preparando vídeo' badge already explains it.
 */
export function playerErrorText(message: string, preparing: boolean): string | null {
  if (!/decod/i.test(message)) return message;
  return preparing ? null : t(UNDECODABLE_TEXT);
}
