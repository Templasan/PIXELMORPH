# US-16 — Transições e montagem de múltiplos clipes: situação

Verificado em 04/10/2026 no emulador `Pixel_7` e lendo o código (`VideoEditorScreen.tsx`, `transitions.ts`, `exportPlan.ts`).

## Resumo

| Critério | Status |
|---|---|
| RF-032 Transições (fade, slide, zoom, wipe) com duração e prévia ao vivo | ⚠️ Parcial |
| RF-058 Reordenar clipes por arrasto e unir em um único vídeo | ⚠️ Parcial (união funciona; reordenar não testado) |

## O que está funcionando
- Tipos: desvanecimento, deslize, zoom e wipe, com duração ajustável e marcador no clipe. A aba Transição só aparece quando o clipe tem um clipe anterior.
- **Unir clipes em um único vídeo (RF-058):** agora é real. A exportação junta os clipes da primeira faixa de vídeo em um mp4 (ver US-30). Testei dividindo um vídeo de 9 s em dois clipes e exportando: o arquivo saiu com ~9 s, sem perda.
- Os clipes podem ser movidos na timeline por arrasto e há "+" para adicionar clipes (`AddClipSheet`).

## Pendências
- **A prévia da transição mistura dois quadros estáticos:** o último quadro do clipe que sai (extraído do arquivo de vídeo) e o quadro atual do que entra. O vídeo volta a tocar quando a transição termina. Não é a transição com os dois vídeos em movimento. Não testei no emulador.
- **Transições no arquivo exportado: funcionam, simplificadas.** Verifiquei quadro a quadro com o ffmpeg num vídeo de 3 clipes (fade de 1,4 s e deslize de 2 s): o fade escurece o clipe que sai e clareia o que entra, o deslize entra pela direita. Não cruzam os dois clipes ao mesmo tempo, e o wipe usa o mesmo movimento do deslize.
- **Reordenar:** o arrasto move o clipe no tempo e a exportação segue a ordem de início, mas não testei o reordenamento entre vários clipes.
- **Não testei ao vivo** a aplicação de uma transição nem a duração.
