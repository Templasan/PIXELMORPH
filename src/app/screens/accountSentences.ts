/** Ends `text` with exactly one period, whether or not it already has one. */
export function endSentence(text: string): string {
  return `${text.replace(/\.+$/, '')}.`;
}

/** Joins sentences with one space. Empty parts are skipped, so they leave no stray period. */
export function joinSentences(parts: string[]): string {
  return parts.filter(Boolean).map(endSentence).join(' ');
}

type Translate = (text: string, params?: Record<string, string | number>) => string;

/**
 * Files the media server did not take. "Desligado" (off) only when the server did not answer at
 * all; a server that answered and refused (quota, error) is not off.
 */
export function pendingUploadsSentence(n: number, serverOffline: boolean, t: Translate): string {
  if (serverOffline) {
    return n === 1
      ? t('Servidor de mídia desligado: 1 arquivo pendente.')
      : t('Servidor de mídia desligado: {n} arquivos pendentes.', { n });
  }
  return n === 1
    ? t('1 arquivo não enviado pelo servidor de mídia.')
    : t('{n} arquivos não enviados pelo servidor de mídia.', { n });
}
