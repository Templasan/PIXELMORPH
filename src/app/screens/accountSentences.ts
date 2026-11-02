/** Ends `text` with exactly one period, whether or not it already has one. */
export function endSentence(text: string): string {
  return `${text.replace(/\.+$/, '')}.`;
}

/** Joins sentences with one space. Empty parts are skipped, so they leave no stray period. */
export function joinSentences(parts: string[]): string {
  return parts.filter(Boolean).map(endSentence).join(' ');
}
