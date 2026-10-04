# US-14 — Linha do tempo multifaixa com tela dividida: o que falta

Verificação feita em 04/10/2026 no emulador `Pixel_7` (build debug), abrindo o projeto "Trilha Serra", e lendo o código (`VideoEditorScreen.tsx`).

## Resumo

| Critério | Status |
|---|---|
| RF-005 Timeline com várias faixas (vídeo, imagem, texto, áudio) | ⚠️ Parcial |
| RF-053 Timeline e prévia lado a lado, redimensionáveis | ✅ Existe |
| RNF-009 Vídeo de 15 min em 4K sem queda de desempenho | ❌ Não comprovado |

## O que vi funcionando
- A tela mostra a prévia em cima e a timeline embaixo, com o divisor arrastável (`0.15` a `0.75`) e um botão de tela cheia.
- Faixas V1, TXT e A1, com olho de visibilidade, cadeado e botão "+" para adicionar clipe. Os blocos de clipe podem ser movidos e aparados por arrasto (`moveClip`, alças de início e fim).
- Ao tocar no clipe aparecem as abas: Aparar, Quadro, Transição, Velocidade, Correção, Áudio e Sobreposição.
- Desfazer/refazer funciona sobre a timeline inteira e é persistido (`history.push('tracks', …)`).

## Pendências
- **A prévia não toca o vídeo.** Ao apertar play, o tempo avança (00:00:02:06 depois de 3 s, por um `setInterval`), mas a imagem continua sendo a mesma miniatura estática. Não existe player de vídeo no código (nem `expo-video` nem `expo-av` no `package.json`, só `expo-video-thumbnails`). O mesmo vale para a prévia de transições e de edições de cor.
- **O projeto "Trilha Serra" abre com duas faixas de vídeo cheias de dados de demonstração.** Não testei a timeline com um vídeo real importado da galeria ou gravado pela câmera.
- **A timeline fica apertada com um clipe selecionado.** O painel de abas toma o lugar da faixa A1, que some da tela.
- **Faixa de imagem:** o critério pede faixas de vídeo, imagem, texto e áudio. A timeline inicial só cria V1, TXT e A1. Não vi como adicionar uma faixa dedicada a imagem.
- **RNF-009:** não medi desempenho com vídeo longo em 4K. Como não há decodificação de vídeo, o teste só faria sentido depois de existir um player.
- **RF-053** foi marcado como ambíguo no backlog (pode virar RNF de UI/UX). A funcionalidade existe, mas falta validar a classificação.
