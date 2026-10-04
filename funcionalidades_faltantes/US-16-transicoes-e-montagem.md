# US-16 — Transições e montagem de múltiplos clipes: o que falta

Verificação feita em 04/10/2026 no emulador `Pixel_7` e lendo o código (`VideoEditorScreen.tsx`, `transitions.ts`).

## Resumo

| Critério | Status |
|---|---|
| RF-032 Transições (fade, slide, zoom, wipe) com duração e prévia ao vivo | ⚠️ Parcial |
| RF-058 Reordenar clipes por arrasto e unir em um único vídeo | ⚠️ Parcial |

## O que vi funcionando
- `TRANSITION_TYPES` = fade, slide, zoom e wipe (Desvanecimento, Deslize, Zoom, Wipe). A aba Transição tem seletor de tipo, "Nenhuma" e slider de duração, e o clipe mostra um marcador (`transitionMarker`).
- Os clipes podem ser movidos na timeline por arrasto (`moveClip`) e há botão "+" para adicionar clipes (`AddClipSheet`).
- A aba Transição só aparece quando o clipe selecionado tem um clipe anterior.

## Pendências
- **A prévia da transição mistura dois quadros estáticos:** o último quadro do clipe que sai (extraído do arquivo de vídeo, `fromFrameUri`) e o quadro atual do que entra. O vídeo toca de novo quando a transição termina. Não é a transição com os dois vídeos em movimento. Não testei no emulador, só o tipo e a compilação.
- **Unir os clipes em um único vídeo não é possível:** a exportação de vídeo está indisponível (ver US-30). A tela de exportação diz que unir clipes e aplicar transições exige um codificador nativo (classe FFmpeg) que não está neste build. `FFmpegVideoExportAdapter.ts` é um stub.
- **Reordenar:** o arrasto move o clipe no tempo, mas não testei o reordenamento entre vários clipes, nem como ele se comporta com transições já aplicadas.
- **Não testei ao vivo** a aplicação de uma transição nem a duração.
