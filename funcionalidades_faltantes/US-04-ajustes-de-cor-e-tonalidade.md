# US-04 — Ajustes finos de cor e tonalidade: situação

Verificado em 04/10/2026 no emulador `Pixel_7` e lendo o código. Atualizado depois das correções do mesmo dia.

## Resumo

| Critério | Status |
|---|---|
| RF-047 Temperatura, matiz, saturação, luminosidade + histograma em tempo real | ✅ Funciona (histograma confirmado ao arrastar um slider) |
| RF-029 Curvas por canal RGB com histograma ao vivo | ✅ Funciona |
| RF-063 Nitidez e redução de ruído com prévia em zoom | ✅ Funciona (prévia 3× confirmada) |
| RF-059 Cor seletiva com tolerância | ✅ Funciona |

## O que foi feito
- **Cor seletiva:** novo slider "Dessat. resto" (0 a 100, padrão 100) controla o quanto o restante da imagem é dessaturado. Antes era fixo em 100 % e o usuário só podia ter tudo cinza. Campo `desaturarResto` em `SelectiveColorAdjustments`, ligado ao uniform `selectiveDesaturateOthers`. Teste em `tests/modules/color-adjustments.test.ts`. Testado no emulador: com 18, o mar volta a mostrar cor.
- **Histograma ao vivo:** confirmado no emulador. Ao subir a exposição para +3, o histograma muda na hora e concentra tudo no branco.
- **Aba Detalhe:** a prévia em zoom de 3× aparece com a imagem real.
- O ✓ da aba Ajustes continua zerando também o novo campo.

## Pendências
- **Cor seletiva só tem 7 cores fixas** (Vermelho, Laranja, Amarelo, Verde, Ciano, Azul, Magenta). Não dá para escolher uma cor tocando na imagem. O critério não exige isso.
- **Projetos salvos antes desta mudança** abrem com "Dessat. resto" em 100, que é o comportamento antigo.
