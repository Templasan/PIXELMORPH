/**
 * PixelMorph design tokens — flat, dark-only UI (Photoshop CC 2015 / Vegas Pro reference).
 * Source: Estrutura Telas/PixelMorph/src/imports/pasted_text/pixelmorph-prototype.md
 */
export const colors = {
  barra: '#252525',
  painel: '#2F2F2F',
  canvas: '#1A1A1A',
  faixa: '#1F1F1F',
  linha: '#3C3C3C',
  texto: '#E4E4E4',
  texto2: '#8E8E8E',
  acento: '#3A8FDE',
  acentoFraco: 'rgba(58,143,222,0.1)',
  acentoFraco2: 'rgba(58,143,222,0.3)',
  perigo: '#D25252',
  ok: '#5FB98F',
  alerta: '#D2A05E',
  veu: 'rgba(0,0,0,0.6)',
  veuForte: 'rgba(0,0,0,0.65)',
  icone: '#B0B0B0',
  branco: '#FFFFFF',
  preto: '#000000',
} as const;

export type ColorToken = keyof typeof colors;
