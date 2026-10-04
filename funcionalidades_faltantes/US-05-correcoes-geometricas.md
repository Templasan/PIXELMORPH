# US-05 — Correções geométricas e orientação: o que falta

Verificação feita em 04/10/2026 no emulador `Pixel_7` (build debug) e lendo o código. A maior parte dos testes de Geometria foi feita em sessões anteriores, junto com os ajustes de performance.

## Resumo

| Critério | Status |
|---|---|
| RF-048 Perspectiva por 4 pontos | ✅ Funciona |
| RF-078 Rotação 90/180/270° e correção por EXIF | ⚠️ Parcial (só fotos) |
| RF-054 Espelhamento H/V com opacidade | ✅ Funciona |

## O que está funcionando
- Perspectiva: os 4 pontos arrastáveis (`PerspectiveHandles.tsx`) deformam a imagem, "Redefinir" volta ao original e o ✓ aplica a correção ao projeto, podendo ser repetida.
- Rotação de 90/180/270°, rotação fina de -45 a +45 e botão "Auto EXIF" (`applyExifOrientation`).
- Espelhar H e Espelhar V (o ícone de V foi corrigido), com slider de opacidade do espelho.

## Pendências
- **RF-078 pede rotação também para vídeos.** Não existe nenhuma rotação no editor de vídeo (`grep rotat` não achou nada em `VideoEditorScreen.tsx` nem em `src/modules/video-editor`). Fazer: botões de 90/180/270° e correção automática pelos metadados de orientação do vídeo.
- **Auto EXIF:** não vi se o botão avisa quando a foto não tem metadado de orientação.
- **Espelhamento "ambos":** dá para ligar H e V juntos, mas não há um botão único para os dois.
