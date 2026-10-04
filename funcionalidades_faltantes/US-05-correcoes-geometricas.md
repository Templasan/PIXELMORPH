# US-05 — Correções geométricas e orientação: situação

Verificado em 04/10/2026 no emulador `Pixel_7` e lendo o código. Atualizado depois das correções do mesmo dia.

## Resumo

| Critério | Status |
|---|---|
| RF-048 Perspectiva por 4 pontos | ✅ Funciona |
| RF-078 Rotação 90/180/270° e correção por EXIF | ⚠️ Foto completa; vídeo gira, mas sem correção automática |
| RF-054 Espelhamento H/V com opacidade | ✅ Funciona |

## O que foi feito
- **Rotação de vídeo (RF-078):** cada clipe tem agora `rotation` (0, 90, 180 ou 270). Na aba Correção do editor de vídeo há os botões "⟲ 90°" e "⟳ 90°", com o valor atual ao lado. A rotação entra no histórico (desfazer/refazer) e é salva com o projeto. A prévia gira e se reajusta ao painel. Testado no emulador em 180° e 270°. Lógica pura em `rotateClip` (`Track.ts`), com teste em `tests/modules/video-rotation.test.ts`.
- **Auto EXIF:** quando a foto não tem rotação nos metadados, o app avisa "Esta foto já está na orientação correta" em vez de gravar uma edição vazia. Testado no emulador.
- **Bug corrigido de passagem:** selecionar um clipe no editor de vídeo disparava um loop de re-render ("Maximum update depth exceeded", com travadas de vários segundos). O efeito do 360° dependia de `selected`, um objeto novo a cada render, e atualizava estado. Passou a ser um valor derivado com `useMemo`. Confirmado: 0 erros no log depois da correção.

## Pendências
- **Correção automática de vídeo pelos metadados de orientação:** não existe. O seletor de galeria (`expo-image-picker`) não informa a rotação do vídeo e não há outra biblioteca de leitura de metadados no projeto. Hoje a rotação do vídeo é manual.
- **Rotação de vídeo só na prévia e no projeto:** a exportação de vídeo continua indisponível (ver US-30), então a rotação ainda não vai para um arquivo final.
- **Espelhamento "ambos":** dá para ligar H e V juntos, mas não há um botão único para os dois.
