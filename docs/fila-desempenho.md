# Fila de desempenho e memória (aberta em 07/11/2026)

Itens levantados nas medições do Poco e na auditoria "original × prévia". Ordem sugerida: risco primeiro.
Marque `[x]` e o commit quando resolver. Detalhes das medições: `docs/relatorio-desempenho-2026-11-07.md`.

| # | Item | Onde | Por que importa | Feito |
|---|---|---|---|---|
| 1 | **Fotos na linha do tempo do vídeo** (time-lapse, stop-motion) abertas inteiras e todas de uma vez; cache de 12 fotos re-decodifica o original em loop | `video-editor-web/src/engine/previews.ts` (`picture()`), `engine/media.ts` (`MAX_BITMAPS`, `picture()`); sem cópia leve de foto no editor de vídeo | 40 fotos de 12 MP ≈ 1,9 GB transitórios: risco de o WebView morrer | [ ] |
| 2 | **Primeira abertura de foto grande ~19 s** | importação (`copyToAppStorage`) + `lightCopyOf` (Skia decodifica o original inteiro) | a cópia leve leva < 1 s depois de pronta; separar quanto é cópia do arquivo e quanto é decodificação | [ ] |
| 3 | **Editor de foto chega a ~1 GB de memória** (Poco, foto 50 MP + ferramentas de IA) | `photo-editor-web` (buffers por quadro em `engine/scene.ts`, texturas, bitmaps) | celular de 3 GB (A11) pode fechar o editor | [ ] |
| 4 | **Exportar PSD > 2 min** | `psdOf` em `photo-editor-web/src/application/session.ts` | trava a demonstração; medir em qual etapa | [ ] |
| 5 | **Panorama de muitas fotos passa do tamanho máximo de imagem** e falha ao salvar | `engine/compose.ts` (largura sem teto), `domain/panorama/panoramaLayout.ts` | 6 fotos 3:2 → 18432 px de largura; acima de ~16384 px o `toBlob` falha | [ ] |
| 6 | **Imagem de sobreposição/dupla exposição anterior fica na memória da GPU** | `engine/photoGl.ts` (`blendTextures` só limpa no `dispose()`) | vazamento a cada troca de imagem (até ~21 MB cada) | [ ] |
| 7 | **"Aplicar e recomeçar": miniatura da grade não mostra os ajustes aplicados** | `src/app/screens/projects/cardThumbMaker.ts` (lê o arquivo, sem a lista `bakes`) | a grade mostra a foto "antes" | [ ] |
| 8 | **"Aplicar e recomeçar": ferramentas de IA analisam a cópia sem os ajustes** | `session.ts` (`lightUri` para `segmentSubject`, `labelImage`, `detectFaces`) | perspectiva aplicada desalinha recorte/rostos | [ ] |
| 9 | **Código morto**: caminho antigo de cópia de foto | `src/app/screens/photo-editor/photoProxy.ts`, `photoProxySkia.ts` (`makePhotoProxy`, `writeLightCopy`), teste `tests/app/photo-proxy.test.ts`; também `video-editor-web/src/engine/engine.ts` sem importadores | confunde quem lê o código | [ ] |
| 10 | **Cada "Aplicar" guardado custa ~1,3 s na exportação de 50 MP** (um passe na foto inteira, com leitura de volta da GPU a cada passe) | `withBakes` em `photo-editor-web/src/application/session.ts` | projeto com 4 "Aplicar" exportou com 6,8 s só para abrir o original; encadear os passes na GPU sem ler de volta | [ ] |
| 11 | **Gerar o arquivo da exportação era lento e variava (2–14 s)**: o `toBlob` do navegador só codifica JPEG/PNG quando a página está parada, e o ícone girando a mantinha animando | `exportImage`, `makeProject` → `engine/encodeCanvas.ts` (worker) | foto 1080×2400: JPEG 1,4–1,9 s, PNG 2,1 s, HEIC 2,2–2,4 s no total; 50 MP JPEG ~22 s → 9,1 s | [x] `7182ddb` |
| 12 | **Medir as ferramentas de IA no A11** (recortar fundo, retrato, rostos, cena, remover) | — | no Poco levam 0,9–2,7 s; no A11 podem passar do aceitável | [ ] |
