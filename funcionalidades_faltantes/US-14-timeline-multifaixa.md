# US-14 — Linha do tempo multifaixa com tela dividida: o que falta

Verificação feita em 04/10/2026 no emulador `Pixel_7` (build debug), abrindo o projeto "Trilha Serra", e lendo o código (`VideoEditorScreen.tsx`).

## Resumo

| Critério | Status |
|---|---|
| RF-005 Timeline com várias faixas (vídeo, imagem, texto, áudio) | ✅ V1, IMG, TXT e A1 |
| RF-053 Timeline e prévia lado a lado, redimensionáveis | ✅ Existe |
| RNF-009 Vídeo de 15 min em 4K sem queda de desempenho | ⚠️ Medido no emulador (queda leve); falta aparelho real |

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
- ~~Faixa de imagem~~ **Resolvido:** a timeline passa a ter V1 (vídeo), IMG (imagem), TXT (texto) e A1 (áudio). Projetos salvos antes ganham uma faixa IMG vazia ao abrir (`ensureImageTrack`). O botão "+" da IMG importa da galeria ou de um projeto, e a faixa de cima vence na prévia (`topClipAt`: a imagem aparece sobre o vídeo onde os dois existem). Testes em `video-timeline.test.ts`. Limite: a exportação continua usando só a primeira faixa de vídeo (imagens sobrepostas não vão para o mp4; ver US-30).
- **RNF-009, medido em 05/10/2026 no emulador `Pixel_7` (build debug, x86_64):** vídeo gerado com ffmpeg, 3840×2160, 30 fps, 15:00, H.264 12 Mbps, 1,36 GB. O editor abriu o projeto em poucos segundos, mostrou 3840×2160 e a duração 15:00 e a timeline ficou normal. Durante o play (12 s), a interface gerou 375 quadros: mediana 19 ms, p90 28 ms, p95 34 ms, p99 81 ms. O mesmo teste com um clipe de 720p e 4 s deu mediana 17 ms, p90 18 ms, p99 19 ms. Ou seja, o 4K de 15 min custa uns 2 ms na mediana e 10 ms no p90, com picos ocasionais de ~80 ms, sem travar. Memória do app 728 MB de PSS nos dois casos (o player só carrega o trecho que toca). Ressalvas: o emulador decodifica 4K em software, é build de debug e a interface roda a ~30 fps; o veredito "sem queda significativa" precisa ser repetido em aparelho real, em build release.
- **RF-053** foi marcado como ambíguo no backlog (pode virar RNF de UI/UX). A funcionalidade existe, mas falta validar a classificação.
