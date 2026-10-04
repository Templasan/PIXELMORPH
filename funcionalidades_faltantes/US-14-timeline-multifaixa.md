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
- ~~A prévia não toca o vídeo~~ **Resolvido:** a prévia agora usa `expo-video` (`ClipVideo.tsx`) e toca o vídeo real, seguindo o relógio da timeline (pausado = vai ao quadro exato, tocando = corrige desvio acima de 0,35 s). Testado no emulador com um vídeo de 9 s importado da galeria. Aprovado pelo usuário e registrado em `docs/dependencies.md`.
- **Causa de fundo corrigida:** o clipe apontava para a miniatura JPEG do projeto em vez do arquivo de vídeo (`buildInitialTracks`), então nem a extração de quadros via arquivo funcionava. Também corrigi a duração: vídeos que o seletor informa com duração 0 agora têm a duração lida pelo próprio player (`probeVideoDurationMs`); antes saíam com clipe vazio.
- **Limites do player:** só o clipe de vídeo sob o cursor toca (não há mixagem de várias faixas de vídeo ao mesmo tempo) e a tela cheia ainda mostra o quadro estático.
- **Testado com vídeo real importado da galeria** (9 s, 1080×2400). Não testei com vídeo gravado pela câmera do emulador (gera arquivos pretos). O projeto "Trilha Serra" é de demonstração e sua origem é uma imagem.
- **A timeline fica apertada com um clipe selecionado.** O painel de abas toma o lugar da faixa A1, que some da tela.
- **Faixa de imagem:** o critério pede faixas de vídeo, imagem, texto e áudio. A timeline inicial só cria V1, TXT e A1. Não vi como adicionar uma faixa dedicada a imagem.
- **RNF-009:** ainda não medido (vídeo de 15 min em 4K). Agora que existe player, dá para medir em aparelho real; o emulador não serve para isso.
- **RF-053** foi marcado como ambíguo no backlog (pode virar RNF de UI/UX). A funcionalidade existe, mas falta validar a classificação.
