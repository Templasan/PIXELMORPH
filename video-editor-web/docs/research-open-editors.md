# Pesquisa: editores de video open source (OpenCut, OpenReel, ClearCut)

Data: 2026-10-23. Pesquisa somente de leitura: nada dos repositorios foi instalado, compilado ou executado.
Clones rasos em `...\scratchpad\research\{opencut,opencut-classic,openreel,clearcut}`.

Legenda: **[V]** = visto no codigo (arquivo citado). **[I]** = inferido / conhecimento geral, nao confirmado no codigo.
Siglas: **OR** = openreel-video, **OC** = OpenCut (reescrita), **OCc** = opencut-classic, **CC** = ClearCut.

## 0. Resumo executivo

- **OpenCut (o repo enviado) e um esqueleto.** A reescrita tem 1256 linhas de Rust no total e `apps/desktop/src/panels/timeline.rs` tem 20 linhas ("Timeline" escrito num div) [V]. `apps/web/src/routes/editor.tsx` tem 12 linhas [V]. O README diz que a versao util e o **opencut-classic**, por isso clonei tambem `opencut-app/opencut-classic` (MIT, commit cf5e79e, 2026-05-17) e li esse.
- **OpenReel** e o maior (150 mil linhas TS em `packages/core`), mas a reproducao no preview e um monolito: `apps/web/src/components/editor/Preview.tsx` tem **8388 linhas** com varios caminhos de playback paralelos, e usa `<video>` do navegador. A parte aproveitavel e a de **exportacao** (prime/atraso do AAC, limites WebCodecs, fallback de hardware), **cache de proxy** e **gestos de toque**.
- **ClearCut** e Android nativo (Kotlin/Media3). Nao ha codigo copiavel para a web, mas tem boas **ideias**: fundir cortes adjacentes para o decoder nao reiniciar, orcamento de instancias de codec, politica de memoria, fallback de decoder.
- **Nada disso e melhor que o nosso nucleo** (relogio unico, `opsAt` unico para preview/export, um slot de decoder por clip, hold de 400 ms, export em streaming). Os ganhos reais estao nas **lacunas do nosso editor**: nao temos miniaturas nem forma de onda na timeline, nao temos orcamento global de decoders, nao fundimos cortes, ripple so em um caso, export na thread principal.

## 1. Licencas (conferidas nos arquivos LICENSE)

| Repo | Licenca | Detalhe |
| --- | --- | --- |
| OpenCut `LICENSE` | MIT, "Copyright 2026 OpenCut" [V] | Unico LICENSE. `crates/media/setup/ffmpeg.json` declara `"license": "LGPL-2.1-or-later"` para binarios FFmpeg que sao **baixados**, nao estao no repo [V]. Nada para copiar. |
| opencut-classic `LICENSE` | MIT, "Copyright 2025-2026 OpenCut" [V] | Usa `mediabunny ^1.29.1`, `zustand`, wgpu (Rust). |
| OpenReel `LICENSE` | MIT, "Copyright (c) 2024-2026 Augustus Otu and Contributors" [V] | `packages/*/package.json` nao declaram licenca propria (nenhum campo `license` nos pacotes) [V]. `apps/desktop/LICENSES/` traz textos GPL-2/GPL-3 e notas FFMPEG.md/BLENDER.md: o desktop **empacota FFmpeg GPL (libx264/libx265) e Blender como processos separados** [V]. Nao usar nada de `apps/desktop`. |
| ClearCut `LICENSE` | MIT, "Copyright (c) 2026 SysAdminDoc" [V] | `NOTICE`: empacota **FFmpegKitNext LGPL-3.0-or-later**, OpenH264, libass; DeepFilterNet (Apache-2.0/MIT) [V]. Codigo e Kotlin: so ideias. |

Dependencias do OpenReel a **evitar** (verificar licenca antes de qualquer uso): `@ffmpeg/core` e `@ffmpeg/core-mt` 0.12.6 (o core costuma ser GPL por conter x264 [I]), `gsap` (licenca propria "no charge", nao OSI [I]), `@paper-design/shaders` (licenca nao verificada), `@astryxdesign/*` (desconhecida). `three`, `immer`, `zustand`, `idb-keyval`, `onnxruntime-web`, `@mediapipe/tasks-vision` sao MIT/Apache [I]. **Nenhum dos arquivos que recomendo depende dessas bibliotecas**; so de `mediabunny` (MPL-2.0 sem modificar, ok).

Regra pratica para tudo abaixo: o codigo MIT pode ser copiado para o produto fechado mantendo o aviso de copyright (comentario no cabecalho do arquivo + entrada no arquivo de avisos de terceiros). Onde digo "reimplementar a ideia" e porque o codigo original e pequeno, acoplado ao modelo deles, ou em outra linguagem.

## 2. OpenReel (github.com/Augani/openreel-video, commit 367d7e9, 2026-10-17)

### a. Modelo de dados e undo
- `packages/core/src/types/timeline.ts`: `Timeline { tracks, subtitles, duration, markers }`; `Track { clips[], transitions[], locked, hidden, muted, solo, groupId }`; `Clip { startTime, duration, inPoint, outPoint, effects[], audioEffects[], transform, keyframes[], speed, reversed, volume, fade, automation, colorGrading }`. Tempos em **segundos (float)**. Transicoes ficam em `Track.transitions`, nao no clip [V]. Tipos de clip de texto/forma/svg/sticker vivem fora de `tracks` em listas separadas do projeto (`getActiveTextClips`, `getActiveShapeClips`... em `video/video-engine.ts` linhas ~660) [V].
- Undo por **comandos com inverso explicito**: `actions/action-history.ts` (pilhas `undoStack/redoStack`, limite 1000, agrupamento por `groupId`), `actions/inverse-action-generator.ts` (935 linhas, um `invert()` por tipo de acao), `actions/action-executor.ts` (2080 linhas) [V]. Alem disso existem **mais dois mecanismos de historico** (historico de clips de texto/grafico e `templateUndoStack`, com `redoJournal` para ordenar os tres) em `apps/web/src/stores/project-store.ts` (linhas ~140-145, 3174-3245) [V]. Complexidade alta; nosso `application/history.ts` (from/to) e mais simples e suficiente.

### b. Playback e relogio
- Relogio mestre = **`AudioContext.currentTime`**: `packages/core/src/playback/master-timeline-clock.ts` (`currentTime = startTimelineTime + (ctx.currentTime - startAudioContextTime) * rate`, `seek`, `setLoop`, `reportVideoTime` mede deriva em ms, `shouldSkipFrame/shouldRepeatFrame`) [V]. E a mesma ideia do nosso `Player` ("o som lidera").
- Mas a reproducao real nao passa por esse controlador de forma limpa: em `apps/web/src/components/editor/Preview.tsx` ha caminho "nativo" com **elementos `<video>`** (`document.createElement("video")`, `video.play()`, sincroniza com `video.currentTime` quando a diferenca > 0.1 s, linhas ~3640-3880), caminho multi-track por `requestAnimationFrame` (`processMultiTrackFrame`, ~5100-5940), caminho GPU (`renderFrameWithGPU`) e `renderFrameDirectly` para pausado [V]. `packages/core/src/video/playback-engine.ts` (buffer de ~60 frames) **nao e usado** pelo app (so e exportado em `video/index.ts`) [V, por grep].
- Fronteira de clips: `getTransitionAtTime` + `findNativeClipById`; nao ha pre-abertura de decoder do proximo clip alem de `loadVideoForClip` do clip inicial e `lastGoodFrameRef` (guarda o ultimo frame bom como `ImageBitmap` e o redesenha quando o novo nao chega, ~linha 5879) [V]. Equivale ao nosso hold de 400 ms, sem limite de tempo visivel.
- Scrub: `decodeDebounceRef` (debounce por `setTimeout`), contador `decodeRequestSeqRef` para descartar pedidos velhos, cache de `<video>` por midia com LRU (`videoElementCacheRef`, `evictOldestVideoElement`) e liberacao dos elementos apos parar de arrastar (`scheduleScrubVideoRelease`) [V]. `PlaybackController.scrubTo` tem timeout de render e fecha o `ImageBitmap` atrasado que chega depois do timeout (evita vazamento de GPU) [V] (`playback/playback-controller.ts` ~311-440).

### c. Decodificacao
- Mediabunny **1.25.3** (`pnpm-lock.yaml`), nosso 1.61.0 [V]. Em `media/mediabunny-engine.ts`: `ExportFrameDecoder` (linhas 70-215) usa `CanvasSink` com `poolSize: 2`, iterador sequencial `canvases(t)`, frame atual + proximo, e reinicia o iterador so se o tempo recua. E essencialmente nosso `Feed.at`.
- `getFrameAtTime` (linha 630) **abre um `Input` + `CanvasSink` novos a cada chamada** e guarda o resultado num cache chaveado por `nome-tamanho-tempo-largura` [V]. Ineficiente.
- Ha um `ParallelFrameDecoder` + `decode-worker.ts` (workers com `BlobSource`) ligado em `VideoEngine.initialize` [V], mas o caminho principal de preview nao depende dele.
- Cadeia de fallback de decode: mediabunny -> `<video>` + seek + `drawImage` (`decodeClipBitmap`, `video-engine.ts` 2148-2216) -> proxy -> ffmpeg.wasm (`media/ffmpeg-fallback.ts`) [V].
- **Arquivo inteiro em memoria**: `MediaItem.blob` e passado a `BlobSource`; audio por `blob.arrayBuffer()` + `decodeAudioData` do arquivo todo (`playback-controller.ts` 671-690) [V]. Em um video de 10 min estereo 48 kHz isso e ~230 MB de float32 [I]. Pior que o nosso (BlockReader + `AudioBufferSink` em janela de 2 s).
- Cache de frames: `video/frame-cache.ts` (LRU por bytes, padrao 100 frames / 500 MB), `frame-ring-buffer.ts` (3-8 `ImageBitmap`) [V]. 500 MB estoura nosso orcamento de 800 MB.

### d. Composicao
- Duas rotas: WebGPU (`video/webgpu-renderer-impl.ts`, shaders WGSL em `video/shaders/`) e Canvas2D (`video/canvas2d-fallback-renderer.ts`, `ctx.filter`), escolhidas por `renderer-factory.ts` (`"gpu" in navigator`) [V]. WebGPU no WebView do Android nao e garantido [I], entao o que serve para nos e a rota Canvas2D.
- `VideoEngine.renderFrame` (`video-engine.ts` 639+) compoe em `OffscreenCanvas` por camada, depois `createImageBitmap(canvas)` para entregar o frame (copia extra por frame) [V].
- Transicoes: `video/transition-engine.ts` (1598 linhas), ~25 tipos em Canvas2D (crossfade, wipe, slide, zoom, push, circleReveal, blur, glitch, pixelate...) com easing, funcao `renderTransitionToCanvas(outgoing, incoming, type, progress)` [V]. Catalogo util como referencia, MIT.
- Texto: `text/title-engine.ts`, `text/text-animation.ts`; fundo letterbox com cor/blur (`backgroundFillMode`) [V].

### e. Exportacao
- `export/export-engine.ts`: laco por frame `renderFrame -> backend.addVideoFrame`, com `waitForVideoOperation` (aborto via `AbortController`, fecha frames atrasados), pausa de 2 ms a cada 5 frames (`needsFrameThrottling`) e **audio em blocos** renderizado por `OfflineAudioContext` (`encodeTimelineAudioToBackend`, `AUDIO_EXPORT_CHUNK_DURATION_SECONDS`) com `setTimeout(0)` entre blocos para o GC [V].
- `export/webcodecs-backend.ts`: `StreamTarget` chunked de 4 MB gravando em `FileSystemWritableFileStream`, `Mp4OutputFormat({fastStart:false, onMoov})`, **laco de preferencia de hardware** (`prefer-hardware` -> `no-preference`) testando `VideoEncoder.isConfigSupported` [V].
- **`export/audio-priming.ts` + `export/mp4-audio-timing.ts`**: mede o atraso do codificador AAC codificando um chirp conhecido e correlacionando (`measureSignalDelay`), e depois reescreve o `moov` (edit list) para os players pularem o priming e o padding final. Resolve o desvio A/V de ~44 ms do AAC [V]. Nao sei se o mediabunny 1.61 ja faz isso sozinho [I].
- `export/webcodecs-limits.ts` (`resolveWebCodecsExportLimits`): limita a 1080p quando o codec e vp9/av1/h265 ou o video > 120 s, e 30 fps para video longo [V].
- `export/export-worker.ts` existe (VideoSampleSource/AudioSampleSource num Worker, `StreamTarget` que posta chunks) mas **nenhum codigo o instancia**: `exportWorker` nunca recebe valor em `export-engine.ts` [V, por grep]. Codigo morto; o export roda na thread principal.

### f. Proxies, miniaturas, waveform
- **Proxy**: `apps/web/src/services/preview-proxy-cache.ts` (`PreviewProxyCache`): fila FIFO com `AbortController` por job, `resolve(projectId, item, purpose)` devolve o original quando `purpose === "export"`, `failPlayback(id, blob)` desliga o proxy se ele falhar ao tocar (e ignora falha tardia de um proxy ja substituido), `revision` que so muda quando a fonte visual muda (nao em progresso), `sameSource()` para invalidar [V]. Gerado por `MediaBunnyEngine.generateProxy` (540p, 1 Mbps, **`keyFrameInterval: 1`**, via `Conversion`) e `convertMedia` usa `Mp4OutputFormat({fastStart:"in-memory"})` + `BufferTarget` = o proxy inteiro fica na RAM [V]. Limiares: 4K, > 600 s ou > 500 MB (`PROXY_THRESHOLDS` em `media/ffmpeg-fallback.ts`) [V]. O audio continua vindo do original (`getOriginalMediaItem`) [V].
- **Miniaturas**: `generateFilmstripThumbnails` (`CanvasSink.canvasesAtTimestamps`, `poolSize` ate 20, JPEG q0.6 como `blob:` URL) [V].
- **Waveform**: `generateWaveform` usa `AudioSampleSink.samplesAtTimestamps` com um ponto por 1/100 s (acesso aleatorio por ponto: lento) [V]; `media/waveform-generator.ts` guarda em memoria (20 itens) e em IndexedDB, varias resolucoes (10-500 amostras/s) [V].

### g. UI da timeline e toque
- `components/editor/Timeline.tsx` (1753 linhas): snap com limite em px convertido para segundos (`snapSettings.snapThreshold / pixelsPerSecond`), snap ao playhead e a bordas de clip, indicador de snap, zoom por Ctrl+roda, scroll automatico para manter o playhead visivel durante o play, seleção em caixa com Shift/Ctrl aditiva, atalhos em `services/keyboard-shortcuts.ts` (play, frame +-1, +-1 s, +-5 s, clip anterior/proximo, I/O de loop, split, trim ate o playhead, ripple delete, copiar/colar/duplicar) [V].
- **Toque** (bom): `timeline/touch-gestures.ts` (`useTimelineTouchGesture`) separa corpo do clip (toque = selecionar, **deslize nativo = rolar a timeline**) de uma **alca de mover dedicada** (`TimelineTouchMoveHandle.tsx`, botao 44x44 no clip selecionado) e das alcas de trim (44 px, `touch-action: none`, fundo transparente); `setPointerCapture`; `listenTimelineGesture` filtra por `pointerId` (ignora outros dedos); ignora eventos de mouse sinteticos por 1000 ms depois de um toque (`suppressMouseUntil`). CSS em `editor-responsive.css` (`.editor-compact [data-timeline-trim]{width:44px; touch-action:none}`), modo compacto `(max-width:1100px), (pointer:coarse) and (max-width:1366px)` [V]. Teste: `Timeline.touch.test.tsx` simula PointerEvents em jsdom [V].
- Magnetismo da trilha principal: nao ha. Colocacao por politica `gap | stack-above` (`timeline/timeline-placement.ts`) e `rippleDeleteClip` no `clip-manager.ts` [V].

### h. Truques de performance
Poucos que valham: fechar `ImageBitmap` atrasado depois de timeout, AAC priming, limites de export, publicar o playhead *antes* de awaits de render para o audio nao parecer adiantado (`Preview.tsx` ~3840, comentario no codigo) [V]. O resto (WebGPU, workers de decode, ring buffer) esta ligado a caminhos que o app nao usa ou duplica copias.

### i. Testes
Vitest em quase todo modulo (`*.test.ts`), `fast-check` em `packages/core/src/test/{fc-config,generators}.ts`, testes de toque/performance com Testing Library, e2e Playwright em `apps/studio/e2e` (1 spec) [V]. Os 3 apps nativos (iOS/Android) **nao usam WebView**: `docs/android-port/` descreve reconstruir o app em Kotlin/Media3, e `docs/MOBILE-PARITY.md` lista regras de timeline compartilhadas (fonte do tempo = `inPoint + local*speed` limitado a `[inPoint,outPoint)`; faixa visual principal sempre ligada) [V].

## 3. OpenCut (reescrita) e opencut-classic

**OpenCut (reescrita)**: esqueleto. Rust `apps/desktop` (GPUI) com paineis vazios, `crates/media` so contem o setup que baixa FFmpeg LGPL, `apps/web` com 3 rotas minimas. README: "being rewritten from the ground up" [V]. Nenhum valor tecnico hoje.

**opencut-classic** (`apps/web/src`, 26.5 mil linhas TS + `rust/` 4.3 mil linhas), arquitetura limpa por "managers" (`core/managers/*.ts`):

- **a. Modelo**: `timeline/types.ts` -> `SceneTracks { overlay[], main, audio[] }`: **a trilha principal e um slot estrutural**, nao uma trilha qualquer [V]. Tempo = `MediaTime`, inteiro em **ticks de 1/120000 s** (`rust/crates/time/src/media_time.rs`, `TICKS_PER_SECOND = 120_000`), divisivel por 24/25/30/48/50/60 e por 24000/1001 e 30000/1001, entao frames exatos sem ponto flutuante [V]. Velocidade em `retime/rate.ts` (0.01x a 5x, `maintainPitch`). Keyframes por **canais por caminho de propriedade** (`docs/keyframes.md`: `ElementAnimations.channels`, registro de propriedades animaveis, resolver `resolve.ts`) [V].
- **Undo**: `core/managers/commands.ts` (`CommandManager`: `execute/undo/redo`, `Command` com `execute()`/`undo()`, restaura a selecao so se o comando declarar `selectionOverride`) [V].
- **Ripple como "reactor"**: `ripple/diff.ts` (279 linhas) compara `beforeTracks` x `afterTracks`, acha os **intervalos liberados** (vacated menos joined) e `ripple/apply.ts` desloca os elementos seguintes; roda depois de **qualquer** comando quando `isRippleEnabled` [V]. Assim apagar, mover e trimar fecham o buraco sem codigo por operacao.
- **Trilha principal magnetica**: `timeline/placement/main-track.ts` (`enforceMainTrackStart`: o primeiro elemento da principal vai sempre a 0) [V].
- **Snap**: `timeline/snapping/{build,resolve,threshold,types}.ts`, 862 linhas no total com ripple/placement. Fontes de snap plugaveis (`element-snap-source.ts`, `playhead-snap-source.ts`, `animation-snap-points.ts`), tipos `element-start|element-end|playhead|bookmark|keyframe`, limite de 10 px convertido por zoom [V].
- **b. Playback**: `PlaybackManager` usa **relogio de parede** (`playbackStartWallTime`, `playbackTimer`) e o audio e um `audio-manager.ts` separado [V campos; detalhe do agendamento: I]. Dois relogios, o problema que eliminamos.
- **c. Decode**: `services/video-cache/service.ts` (337 linhas): um sink mediabunny (`CanvasSink`) **por mediaId** (clips da mesma midia compartilham decoder), `frameChain` + `seekGenerations` (ultimo pedido vence), `iterateToTime` se o alvo esta ate 2 s a frente, senao `seekToTime`; prefetch de 1 frame [V]. Equivale ao nosso `Feed`; o nosso e mais seguro (um slot por clip).
- **d. Render**: arvore de cena (`services/renderer/scene-builder.ts` -> `RootNode` com nos video/image/text/sticker/efeito/mascara) e compositor wgpu em WASM com backend WebGL (`rust/crates/gpu`, feature `wasm = ["wgpu/webgl"]`) [V]. Exige toolchain Rust/WASM, peso de WASM e GPU no WebView: nao serve.
- **e. Export**: `scene-exporter.ts`: `CanvasSource` + `BufferTarget` (MP4 inteiro em memoria), na thread principal, **audio da timeline inteira num `AudioBuffer`** [V]. Pior que o nosso.
- **f. Miniatura/waveform**: `media/thumbnail.ts` (JPEG data URL, max 1280x720), `media/waveform-summary.ts` (baldes de pico de 128 amostras, `sourceKey`) e `services/waveform-cache` [V].
- **g. UX**: `timeline/hooks/use-edge-auto-scroll.ts` (rAF, `edgeThreshold=100 px`, `maxScrollSpeed=15`, intensidade proporcional a proximidade da borda) [V]; atalhos, marcadores (`bookmarks`), multi-selecao, grupos (`group-move`, `group-resize`).
- **i. Testes**: ~30 arquivos `*.test.ts` (fps, retime, placement, snapping, timeline) [V].

## 4. ClearCut (github.com/SysAdminDoc/ClearCut, commit fbac89e, 2026-10-06)

Android nativo, 53 mil linhas Kotlin, 315 arquivos de teste, `AGENTS`-style. Historico raso de 1 commit; README com dezenas de funcoes e changelog muito longo; pasta `work/` com centenas de screenshots/XML de depuracao comitados. Muitas afirmacoes de funcionalidade nao verificadas por mim; li so os trechos citados.

- **a. Modelo/undo**: `model/Project.kt` (601 linhas, `Clip` com `trimStartMs/trimEndMs/timelineStartMs/speed/speedCurve/headTransition/tailTransition`...). Undo real = **snapshots** (`saveUndoState(label)`); `engine/EditCommand.kt` e um esqueleto de comandos que o proprio comentario diz ser "foundation for a future migration" [V]. `ui/editor/GestureUndoTransaction.kt`: guarda o snapshot no inicio do gesto e **so cria entrada de undo se algo mudou** ao soltar; cancelar restaura [V].
- **b. Playback**: `engine/VideoEngine.kt` usa Media3 `CompositionPlayer` (experimental) e **reconstroi a Composition inteira a cada edicao** (`prepareTimeline` -> `setComposition` + `prepare`) [V]. `PreviewRenderPolicy.includesTransitions(previewMode) = !previewMode`: **transicoes nao aparecem no preview**, so no export [V] (o oposto da nossa regra). Bug do Media3 1.11 (issue #54): depois do fim da sequencia o compositor nao aceita mais frames; solucao deles e observar o fim (`EndOfInputWatchingVideoGraphFactory`) e **trocar o player** (`replaceSpentPreviewPlayer`) [V]. Mapeamento timeline<->midia em `PreviewTimelineMapping.kt` (30 linhas) [V].
- **Fundir cortes adjacentes** (`VideoEngine.kt` 179-222, `canCoalesceAdjacentPreviewCuts`/`coalesceAdjacentPreviewCuts`): dois clips consecutivos da **mesma fonte**, com `left.trimEnd == right.trimStart`, mesma velocidade, sem efeitos/keyframes/mascaras/transicoes/fades, mesmo volume/opacidade/transformacao/cor, viram **um** item no preview. Assim o corte (split sem efeito) nao reinicia o decoder [V].
- **c. Decodificacao/recuperacao**:
  - `engine/CodecInstanceBudget.kt` (324 linhas): semaforo por MIME com teto = **menor `maxSupportedInstances` dos decoders** do aparelho (`MediaCodecList`), padrao 4 se desconhecido; "leases" cancelaveis separadas para decoder, retriever, player e pipeline, e snapshot de diagnostico. Evita que miniatura, waveform, proxy e preview disputem decoders [V].
  - `engine/Media3DecoderFallback.kt`: `setEnableDecoderFallback(true)` tenta o proximo decoder quando o primeiro falha e **registra no historico do export** que usou fallback (OEMs que reportam errado, androidx/media#2751) [V].
  - `engine/MemoryTrimPolicy.kt`: `onTrimMemory` -> acoes (limpar miniaturas, waveforms, cache de proxy) por nivel de pressao [V]. `AudioDecodeBudget.kt`: teto de 96 milhoes de amostras PCM em memoria [V].
- **f. Proxy**: `ProxyResolutionPolicy.kt` (puro, 52 linhas): proxy = fracao da **altura exibida** (considera rotacao); **nao gera proxy se a fonte ja e menor ou igual a camada alvo** (`UseSource`) [V]; `ProxyEngine.kt` (mutex por fonte, arquivo de 0 bytes = ausente, cancelamento limpa o arquivo, `Presentation.createForHeight` + arredondar ao multiplo do encoder); `ProxyWorkflowEngine.kt`: tres camadas (miniatura, proxy, original), usa proxy no preview se a altura original > 1080, **sempre original no export**, e `mediaVersion` para descartar proxy pronto de uma fonte que mudou [V]. Chave do arquivo = SHA-256 da URI (nao detecta troca do conteudo) [V].
- **Miniaturas**: `ThumbnailCachePolicy.kt` (heap/8; configuravel 32-256 MB, teto heap/4, heap/8 em aparelho com pouca RAM), `ThumbnailStripPolicy.kt` (as tiras vivas no Compose ficam abaixo da **metade** desse orcamento, expulsando as mais antigas), `TimelineScrollPerformancePolicy.kt` (janela de cache 160 dp a frente, 80 dp atras; pre-carga = metade da janela visivel, minimo 2 s; so renderizar conteudo caro se visivel), cache de tiras com **zoom quantizado em passos de 0.25** (`Timeline.kt` ~682) [V].
- **e. Export**: Media3 Transformer; `ExportOutputVerifier` verifica o arquivo gerado (tem video/audio, duracao, dimensoes, faststart); `ExportResumePolicy` retoma MP4 parcial so em casos seguros; `ThermalHeadroomPolicy` interpreta estado termico; erros de export separados em 7 causas; normalizacao CFR de fonte VFR antes do render; "smart trim" por GOP para cortes puros [V pelos nomes e cabecalhos; corpo nao lido].
- **g. Timeline**: pixels/ms = `zoomLevel * 0.15`, snap de 8 dp, snap a bordas/marcadores/batidas (`findSnapTarget` em `TimelineInteractionPolicy.kt`, 3 linhas), alca de trim 14 dp visual / **28 dp de toque**, haptico ao encaixar (`HapticFeedbackType.TextHandleMove`), pinch com `detectTransformGestures` mantendo o centro do pinch estavel, long press = multi-selecao, nudge por teclado 100 ms / 1 s com Shift, `rippleDeleteClips`, trims/slips de clips ligados (`linkedClipIds`) [V]. Playhead livre, nao fixo no centro.
- **i. Testes**: funcoes puras "Policy" com testes JVM (`TimelineEditingTest.kt` 1043 linhas, `AutoSaveStateTest.kt`...) [V].

## 5. O que trazer para o nosso editor

Ordem: valor / esforco. Esforco: S (<= 1 dia), M (2-4 dias), L (> 1 semana).

### 1. Miniaturas e forma de onda na timeline (lacuna nossa) - **M**
- **O que**: tiras de miniaturas nos clips de video e picos de audio nos clips de audio/video. Hoje `src/ui/Timeline.tsx` e todo `src/` nao tem nada disso (grep por thumb/waveform/peaks: 0 resultados).
- **Como** (ideias de OR/OCc/CC): miniaturas com `CanvasSink.canvasesAtTimestamps` num `poolSize` pequeno, JPEG baixo, **ler do proxy** (decode barato), so clips **visiveis** mais uma margem de metade da tela (CC `thumbnailPreloadPaddingMs`), **zoom quantizado em passos de 0.25** para a chave do cache (CC), orcamento **em bytes** com expulsao do mais antigo (CC `ThumbnailStripPolicy`: ate metade do cache de miniaturas). Waveform: **leitura sequencial** `AudioSampleSink.samples()` reduzida a baldes de pico (OCc `waveform-summary.ts`: balde de 128 amostras), **nao** `samplesAtTimestamps` por ponto como o OR (lento, uma busca por ponto). Persistir no armazenamento do app via `EditorHost`.
- **Por que**: a edicao no telefone depende de ver onde cortar; hoje so ha blocos coloridos.
- **Licenca**: reimplementar a ideia (o codigo deles e pequeno e acoplado). Nada a copiar.
- **Cuidado**: miniatura e waveform tambem abrem decoders; passar pelo orcamento do item 2 e pausar durante o play.

### 2. Orcamento global de decoders (CodecInstanceBudget) - **S/M**
- **O que**: uma fila/semaforo unico em `MediaPool` (`src/engine/media.ts`) para todo trabalho que abre `VideoDecoder`: slots do preview, exportacao, miniaturas, proxies. Prioridade: preview > export > miniaturas. Teto inicial conservador (4, como o CC usa quando nao sabe) e ajustavel por tier em `previewTier.ts`.
- **Por que**: `feed.ts` ja documenta que 3 decoders abertos/fechando ao mesmo tempo deixaram seeks em 1.1 s com picos de 3 s no Poco. O `maxLiveLayers` limita camadas, mas nao o trabalho de fundo.
- **Licenca**: reimplementar a ideia (MIT, mas Kotlin). Opcional M: o host nativo pode informar `MediaCodecInfo.CodecCapabilities.getMaxSupportedInstances()` por `EditorHost` para o teto real.

### 3. Fundir cortes adjacentes em `composition.ts` - **M**
- **O que**: ao montar a composicao, clips consecutivos da mesma fonte com `outPoint == inPoint` seguinte, mesma velocidade, sem transicao/efeito/keyframe/fade e mesmos parametros (a lista exata esta em `canCoalesceAdjacentPreviewCuts`, CC `VideoEngine.kt` 179-205) passam a ser **uma camada com uma chave de decoder so**. O clip continua separado no modelo e na UI; so `buildComposition` funde.
- **Por que**: o caso mais comum de edicao (dividir e apagar/mover pedaco) hoje cria dois slots (`MediaOp.key` e "estavel por clip") e, na fronteira, o decoder do segundo precisa abrir e posicionar (`PREPARE_AHEAD_MS`, hold de ate 400 ms). Fundido, nao existe fronteira: nada de camada atrasada no corte. Exporta o mesmo resultado (continua `opsAt` unico), entao nao quebra a regra de "um caminho de desenho".
- **Licenca**: reimplementar (MIT permitiria portar; e curto). Cobrir com teste no `timeline-invariants`: fundir nao muda a imagem em nenhum `t`.

### 4. Ripple generico por diferenca antes/depois + trilha principal magnetica - **M** (S so a regra de inicio)
- **O que**: portar `ripple/diff.ts` + `apply.ts` + `shift.ts` do opencut-classic (MIT, ~370 linhas, so tipos de trilha a adaptar): depois de qualquer edicao com Ripple ligado, calcular intervalos liberados e puxar o que vem depois. Mais `enforceMainTrackStart` (primeiro clip da trilha principal sempre em 0).
- **Por que**: `videoEditorStore.ts` so aplica ripple em `trimOutWithRipple` (linhas ~121-130); apagar, mover e trim-in nao fecham o buraco. A abordagem por diferenca cobre todos os casos sem codigo por operacao e sem mexer em `domain/timeline.ts`.
- **Licenca**: pode copiar (MIT, com aviso) ou reimplementar. **Decisao de produto**: no OCc o ripple tambem desloca trilhas de overlay/audio; definir se o nosso e por trilha ou por todas.

### 5. Teste e correcao do A/V do AAC no export (audio-priming + edit list) - **M**
- **O que**: primeiro **medir**: exportar um video com um clique de audio e conferir o deslocamento em ffprobe/Audacity. So se houver ~44 ms de atraso, portar `export/audio-priming.ts` e `export/mp4-audio-timing.ts` do OR (MIT, ~300 linhas; usam `Mp4OutputFormat({onMoov})` e regravacao do `moov` por posicao, que o nosso `ExportSink.write(position, data)` ja suporta).
- **Por que**: `exporter.ts` codifica AAC via `AudioBufferSource` sem compensacao. O OR passou por esse problema real.
- **Licenca**: copiar com aviso (MIT) apos validar. Pode ser inutil se o mediabunny 1.61 ja escreve a edit list [I, nao verificado].

### 6. Proxy: GOP curto, descartar proxy desatualizado, desligar proxy que nao toca - **S**
- **O que**: (a) confirmar que o proxy gerado pelo app nativo usa `keyFrameInterval` <= 1 s (OR `generateProxy` usa 1 s); (b) `mediaVersion`/hash no resultado do proxy para nao aplicar proxy pronto de uma fonte trocada (CC `shouldApplyProxyResult`); (c) se um `Feed` falha ao abrir o proxy, cair para o original e marcar o proxy como com erro (OR `failPlayback`); (d) nao gerar proxy se a fonte ja e <= camada alvo (CC `ProxyResolutionPolicy`: `previewUriFor` ja cobre 1080p).
- **Por que**: o custo de seek no Poco depende da distancia ao keyframe anterior; GOP longo no proxy e a causa mais provavel de seeks lentos [I]. Estas regras ficam na fronteira do `EditorHost`/`previewTier.ts`.
- **Licenca**: so ideias.

### 7. Cadeia de fallback de decode - **M**
- **O que**: se `VideoSampleSink`/`Feed.restart` falhar para uma fonte (codec com decoder de hardware quebrado, comum em OEMs; CC `Media3DecoderFallback`), tentar: mesmo arquivo com decoder de software (se o mediabunny 1.61 expuser `hardwareAcceleration` no decoder, **a verificar**), depois proxy, depois `<video>` + `drawImage` so para quadros parados (OR `decodeFrameWithVideoElement`), e registrar que houve fallback (para o export dizer a verdade, como CC).
- **Licenca**: reimplementar.

### 8. Gestos de toque da timeline - **S**
Itens a conferir/portar em `src/ui/Timeline.tsx` (`TAP_SLOP_PX=6`, `SNAP_PX=8`, pointer map para pinch):
- alca de trim com area de toque de **44 px** (OR) / 28 dp (CC) e visual menor, `touch-action: none` nas alcas;
- ignorar mouse sintetico logo apos um toque e filtrar por `pointerId` (OR `touch-gestures.ts`, ~60 linhas, MIT, **pode copiar**);
- **auto-scroll na borda** ao arrastar um clip (OCc `use-edge-auto-scroll.ts`: borda 100 px, velocidade ate 15 px/frame proporcional a proximidade). No nosso layout de playhead fixo no centro, isso vira "avancar o tempo enquanto o dedo fica na borda" - exige adaptacao;
- **haptico ao encaixar** (CC): `navigator.vibrate(8)` no WebView [I, depende da permissao VIBRATE do host];
- snap com **fontes plugaveis e tipadas** (OCc `snapping/types.ts`: element-start/end, playhead, bookmark, keyframe), util quando entrarem marcadores e keyframes.

### 9. Uma entrada de undo por gesto (GestureUndoTransaction) - **S**
Garantir que arrastar/trimar crie um unico item de undo e que cancelar restaure (CC `GestureUndoTransaction.kt`, 60 linhas). Conferir `createHistory.push` em `session.ts`/`videoEditorStore.ts`; se ja e assim, ignorar.

### 10. Politica de memoria sob pressao - **S**
CC `MemoryTrimPolicy` mapeia nivel de `onTrimMemory` para acoes (limpar miniaturas, waveform, proxy). No nosso caso: evento `memoryPressure` no `EditorHost` (o app RN recebe `onTrimMemory`/`AppState`) que dispara `MediaPool.prune(vazio)` + fecha bitmaps + esvazia caches de miniatura. Hoje `MAX_BITMAPS = 12` e por **contagem** (`media.ts`): trocar por bytes (largura x altura x 4) quando entrarem as miniaturas. Orcamento total <= 800 MB: nenhum cache pode ser "500 MB" como o `frame-cache.ts` do OR.

### 11. Limites de export por aparelho - **S**
Copiar a ideia de `resolveWebCodecsExportLimits` (OR, MIT, 60 linhas): limitar resolucao/fps conforme codec e duracao, e o laco `prefer-hardware` -> `no-preference` ja temos em `exporter.ts` (um `isConfigSupported`); acrescentar verificacao do tamanho (`canEncodeVideo` com a resolucao pedida) e mensagem clara ao usuario quando reduzir.

### 12. Verificar o arquivo exportado (CC `ExportOutputVerifier`) - **S**
Reabrir o MP4 com `Input` do mediabunny ao final e checar: tem video, duracao ~ esperada, dimensoes, audio quando esperado, tamanho > 0. Falha vira erro claro em vez de arquivo mudo/quebrado na galeria.

### 13. Tempo em ticks inteiros (OCc `MediaTime`, 120000/s) - **L, baixa prioridade**
Resolve arredondamento de quadro com 23.976/29.97 fps sem ponto flutuante. Nosso dominio usa ms (`frameMath.ts`); migrar tudo e invasivo. So vale se aparecerem erros de quadro duplicado/perdido. **So inspiracao**.

### 14. Testes de toque com PointerEvent em jsdom/happy-dom - **S**
`Timeline.touch.test.tsx` do OR mostra como simular `PointerEvent` (`class TestPointerEvent extends MouseEvent`) e `requestAnimationFrame` controlado. Hoje testamos so dominio/composicao; um teste de gesto para trim/move/pinch pega regressao de UI. Reimplementar (o arquivo e especifico do app deles).

### Nao trazer
- ffmpeg.wasm, WebGPU, three.js, wgpu/WASM, gsap, transformers/onnx (peso, licenca incerta ou nao cabe no WebView de 800 MB).
- `<video>` como motor de playback (OR): perde precisao de quadro e controle; so como ultimo fallback para quadro parado.
- Reconstruir a composicao inteira a cada edicao (CC) e preview sem transicoes (CC).

## 6. Onde eles fazem PIOR ou nao serve para WebView movel

- **OR**: `Preview.tsx` de 8388 linhas com 4 caminhos de playback; reproducao por `<video>`; arquivo inteiro em RAM (`blob`) e `decodeAudioData` do arquivo todo; cache de frames de ate 500 MB; `getFrameAtTime` reabre `Input` a cada chamada; copia `OffscreenCanvas -> ImageBitmap` por frame; proxy MP4 em `BufferTarget` na RAM; `export-worker.ts` morto (export na thread principal); tres mecanismos de undo; mediabunny 1.25.3 antigo.
- **OCc**: relogio de parede + audio separado (dois relogios); export com `BufferTarget` e audio da timeline inteira num `AudioBuffer`; um decoder por midia compartilhado entre clips; compositor Rust/WASM + WebGL.
- **OC (reescrita)**: nao existe ainda.
- **CC**: nativo (nao reutilizavel como codigo), preview sem transicoes, reconstrucao total da composicao por edicao, dependencia de API experimental do Media3 com bug que exige trocar o player, repositorio com historico de 1 commit e pasta `work/` cheia de artefatos de depuracao. As afirmacoes de funcionalidades no README sao muitas e nao verificadas.
- **Ninguem** exporta em Worker; nao ha codigo de referencia para isso. Tirar o laco de export da thread principal (mediabunny + `OffscreenCanvas` no Worker) seria projeto nosso, **L**, com ganho de fluidez da UI durante o export [I].

## 7. O que NAO e verificado

- Nada foi executado; o comportamento vem de leitura de codigo. Codigo morto foi apontado por busca textual (`grep`), nao por analise de grafo.
- Licencas de dependencias marcadas [I] vem de conhecimento geral, nao de arquivos do repo (os `node_modules` nao existem). Conferir `LICENSE` de cada pacote antes de qualquer adocao.
- Corpos de `ExportDelegate.kt`, `SmartRenderEngine.kt` e do audio-manager do OCc nao foram lidos; as linhas sobre eles sao so pelos nomes/cabecalhos.
- Se o mediabunny 1.61 ja corrige o priming do AAC ou expoe preferencia de decoder por software nao foi verificado (so li o nosso `package.json`).
