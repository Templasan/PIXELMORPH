/**
 * PixelMorph design tokens — flat, dark-only UI (Photoshop CC 2015 / Vegas Pro reference).
 * Source: Estrutura Telas/PixelMorph/src/imports/pasted_text/pixelmorph-prototype.md
 */
export const colors = {
  barra: '#242424',
  painel: '#2E2E2E',
  canvas: '#141414',
  faixa: '#1C1C1C',
  linha: '#2E2E2E',
  texto: '#F2F2F2',
  texto2: '#A8A8A8',
  acento: '#2F7FE0',
  acentoFraco: 'rgba(47,127,224,0.1)',
  acentoFraco2: 'rgba(47,127,224,0.3)',
  perigo: '#D25252',
  ok: '#5FB98F',
  alerta: '#E0A85C',
  veu: 'rgba(0,0,0,0.6)',
  veuForte: 'rgba(0,0,0,0.65)',
  icone: '#B0B0B0',
  branco: '#FFFFFF',
  preto: '#000000',
} as const;

export type ColorToken = keyof typeof colors;
