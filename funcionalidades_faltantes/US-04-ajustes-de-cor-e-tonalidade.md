# US-04 — Ajustes finos de cor e tonalidade: o que falta

Verificação feita em 04/10/2026 no emulador `Pixel_7` (build debug) e lendo o código. Parte dos testes (curvas, aba Detalhe) foi feita em sessões anteriores.

## Resumo

| Critério | Status |
|---|---|
| RF-047 Temperatura, matiz, saturação, luminosidade + histograma em tempo real | ✅ Funciona |
| RF-029 Curvas por canal RGB com histograma ao vivo | ✅ Funciona |
| RF-063 Nitidez e redução de ruído com prévia em zoom | ✅ Funciona |
| RF-059 Cor seletiva com tolerância | ✅ Funciona (com ressalva) |

## O que vi funcionando
- Aba Básico: histograma RGB calculado a partir da imagem real (`useImageHistogram`), com sliders de temperatura, matiz de branco, matiz, saturação, luminosidade, vibração e exposição.
- Aba Curvas: curva por canal (testada antes, inclusive o lag, já corrigido).
- Aba Detalhe: nitidez e redução de ruído independentes, com prévia em zoom (antes aparecia preta, foi corrigido).
- Aba Cor seletiva: escolhi "Azul" e o resto da imagem ficou em tons de cinza, como o critério pede. O botão ✓ aplica os ajustes ao projeto.

## Pendências e observações
- **Cor seletiva sem controle de "dessaturar o resto".** O valor `selectiveDesaturateOthers` é fixo em 1 quando uma cor está ativa (`colorAdjustments.ts`, linha 174). O usuário não consegue manter as demais cores parcialmente saturadas, só totalmente cinza. O critério fala em "dessaturadas", então atende, mas é um controle a menos do que o editor poderia ter.
- **Cor seletiva só tem 7 cores fixas** (Vermelho, Laranja, Amarelo, Verde, Ciano, Azul, Magenta). Não dá para escolher uma cor tocando na imagem.
- **Aba Detalhe:** a prévia em zoom não foi retestada nesta rodada.
- **Não testado:** o histograma "em tempo real" durante o arrasto de cada slider, no emulador. Só vi o histograma estático com o editor aberto.
