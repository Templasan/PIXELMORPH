# US-05 — Correções geométricas e orientação: situação

Verificado em 04/10/2026 no emulador `Pixel_7` e lendo o código. Atualizado depois das correções do mesmo dia.

## Resumo

| Critério | Status |
|---|---|
| RF-048 Perspectiva por 4 pontos | ✅ Funciona |
| RF-078 Rotação 90/180/270° e correção por EXIF | ✅ Foto e vídeo |
| RF-054 Espelhamento H/V com opacidade | ✅ Funciona |

## O que foi feito
- **Rotação de vídeo (RF-078):** cada clipe tem agora `rotation` (0, 90, 180 ou 270). Na aba Correção do editor de vídeo há os botões "⟲ 90°" e "⟳ 90°", com o valor atual ao lado. A rotação entra no histórico (desfazer/refazer) e é salva com o projeto. A prévia gira e se reajusta ao painel. Testado no emulador em 180° e 270°. Lógica pura em `rotateClip` (`Track.ts`), com teste em `tests/modules/video-rotation.test.ts`.
- **Auto EXIF:** quando a foto não tem rotação nos metadados, o app avisa "Esta foto já está na orientação correta" em vez de gravar uma edição vazia. Testado no emulador.
- **Bug corrigido de passagem:** selecionar um clipe no editor de vídeo disparava um loop de re-render ("Maximum update depth exceeded", com travadas de vários segundos). O efeito do 360° dependia de `selected`, um objeto novo a cada render, e atualizava estado. Passou a ser um valor derivado com `useMemo`. Confirmado: 0 erros no log depois da correção.

## Pendências
- ~~Correção automática de vídeo pelos metadados~~ **Resolvido:** verifiquei com um vídeo de teste gerado com ffmpeg (1280×720 com tag de rotação de 90°). O seletor informa 720×1280, a prévia (`expo-video`) mostra a imagem em pé e o mp4 exportado mantém a tag e fica idêntico à referência do ffmpeg. Ou seja, a correção pelos metadados já acontece no player, no tamanho do projeto e na exportação. Para o usuário ver isso, a aba Correção mostra "Orientação do arquivo: gravado girado em 270°, corrigido automaticamente" (leitura nativa em `probeVideoRotation`, texto em `orientation.ts`, com teste).
- **Rotação manual de vídeo na exportação:** vai para o arquivo (ver US-30); a rotação gravada no arquivo original é preservada.
- **Espelhamento "ambos":** dá para ligar H e V juntos, mas não há um botão único para os dois.
