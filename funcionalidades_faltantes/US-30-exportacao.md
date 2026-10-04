# US-30 — Exportação em múltiplos formatos e otimização: situação

Verificado em 04/10/2026 no emulador `Pixel_7` e lendo o código (`ExportSheet.tsx`, `VideoExportSheet.tsx`, `modules/pixelmorph-video-export`).

## Resumo

| Critério | Status |
|---|---|
| RF-057 Foto em JPEG, PNG, WebP e HEIC | ⚠️ Parcial (sem HEIC) |
| RF-061 Vídeo em GIF animado | ✅ Funciona (lento) |
| RF-017 Vídeo com presets de redes sociais | ✅ Funciona (Android) |
| RNF-013 Compressão inteligente | ✅ Funciona para foto; vídeo usa bitrate por preset |
| RNF-011 Vídeo de 1 min em Full HD em até 2 min | ⚠️ Promissor, sem medição nesse tamanho |

## O que foi feito
- **Exportação de vídeo real.** Módulo local `modules/pixelmorph-video-export` (Kotlin) usa o **Media3 Transformer** do Google (mesma versão do `expo-video`, codificador por hardware, sem FFmpeg). Junta os clipes da primeira faixa de vídeo em um mp4 H.264/AAC, respeitando corte, velocidade, rotação e quadros congelados (o quadro congelado vira uma imagem mantida pelo tempo definido). Planejamento puro em `exportPlan.ts` (com testes).
- **Presets de rede social para vídeo (RF-017):** Original (mantém o formato, limita a 1920 no lado maior), Instagram Reels, TikTok, YouTube Full HD, YouTube Shorts e WhatsApp 720p, cada um com resolução e bitrate. Tela `VideoExportSheet.tsx`, com progresso, cancelamento e "Salvar na galeria".
- **Testado no emulador:** vídeo de 9 s importado da galeria, preset WhatsApp 720p. Arquivo gerado em 5,1 s, 1280×720, 3,7 MB; confirmei no próprio arquivo (leitura do contêiner mp4): 9,43 s, trilha de vídeo H.264 1280×720. Depois dividi o clipe em dois e exportei de novo: 5,2 s e mesmo tamanho (união sem perda). "Salvar na galeria" funcionou depois de autorizar a permissão.
- **Foto:** JPEG, PNG e WebP com a compressão inteligente, como antes.
- **Escolha de biblioteca:** o FFmpeg-kit está arquivado pelos autores e o projeto proíbe pacotes sem manutenção. O Media3 Transformer é mantido pelo Google (AndroidX), licença Apache 2.0, e já fazia parte do app por meio do `expo-video`.

- **GIF animado (RF-061):** aba "GIF ANIMADO" na exportação, com quadros por segundo (5/10/15), número de cores (32 a 256) e largura (240/360/480 px). Os quadros saem do arquivo, são reduzidos com Skia e codificados em JS com `modern-gif` (nova dependência aprovada, registrada em `docs/dependencies.md`; o `gifenc`/`omggif` estão sem manutenção desde 2022). Planejamento puro em `gifPlan.ts` (com testes), corta em 15 s.
- **Testado no emulador e conferido decodificando o arquivo:** vídeo de 7 s com a lista rolando, 5 fps, 240 px: GIF89a válido, 37 quadros 240×533, 970 KB, 32 quadros diferentes (os outros 5 são momentos parados da gravação). O teste achou um bug real, que corrigi: `expo-video-thumbnails` busca só o quadro-chave mais próximo (`OPTION_CLOSEST_SYNC`), então vídeos com poucos quadros-chave (como gravação de tela) davam todos os quadros iguais. O módulo nativo ganhou `extractFrame` com busca exata (`OPTION_CLOSEST`), usado no GIF e nos quadros congelados da exportação.

## Pendências
- **GIF é lento:** 37 quadros a 240 px levaram 39 s e 95 quadros a 360 px levaram 96 s no emulador, em build de desenvolvimento. A codificação roda na thread JS e trava a tela no fim. Fazer: medir em build release e em aparelho real; se continuar lento, mover a codificação para uma thread nativa.
- **HEIC não é suportado** (`UNSUPPORTED_IMAGE_FORMATS`). Depende de um codificador nativo que o Skia não tem. Fazer: avaliar, ou deixar fora do escopo.
- **Transições (fade, slide, zoom, wipe) não entram no arquivo:** a exportação usa corte seco. A prévia mostra a transição, mas o mp4 não. Fazer: efeito de transição por quadro no Media3 (Presentation + OverlayEffect) ou sequência com sobreposição.
- **Só a primeira faixa de vídeo é exportada.** Faixas de texto, imagem sobreposta, picture-in-picture, correção de brilho, estabilização, 360° e áudio da faixa A1 ainda não são aplicados no arquivo.
- **Só Android.** O módulo é Kotlin. O iOS precisaria de uma versão em AVFoundation (o app, por ora, só roda Android).
- **RNF-011:** só medi um vídeo de 9 s a 720p (5,1 s no emulador, aproximadamente 0,57× o tempo real). Falta medir 1 min em Full HD em aparelho de gama média; o emulador não serve de referência.
- **Presets de bitrate e o RNF-013** para vídeo são fixos por preset, e não adaptados à complexidade da cena.
- **Os adapters antigos continuam como stubs:** `FFmpegVideoExportAdapter`, `ExpoImageExportAdapter`, `ExpoShareAdapter`. Não são usados; podem ser removidos.
