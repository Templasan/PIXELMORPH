# Pesquisa: codigo-fonte dos candidatos permissivos (omniclip, WebAV, diffusion, wavesurfer, gl-transitions, regl/twgl, timeline, demuxers)

Data: 2026-10-23. Pesquisa somente de leitura: clones rasos em `...\scratchpad\research2\<nome>`, nada instalado, compilado ou executado. Nenhum outro arquivo do projeto foi alterado.
Complementa `docs/research-more-editors.md` (a lista de candidatos) e `docs/research-open-editors.md` (OpenCut, OpenReel, ClearCut: nao repetidos).

Legenda: **[V]** = visto no codigo/arquivo citado. **[I]** = inferido ou conhecimento geral, nao confirmado no codigo.
Criterio de licenca do produto fechado: copiar so de MIT/BSD/Apache-2.0/ISC/zlib; MPL-2.0 so como biblioteca sem modificar; GPL/LGPL/AGPL/proprietario: so ideias.

## 0. Resumo executivo

- **A descoberta principal: o motor util nao esta no repo `omniclip`, esta no `omni-media/omnitool` (MIT).** O `omniclip` da branch `main` (commit `cbe581a`, 2025-08-07) previsualiza com `<video>` + PixiJS e usa WebCodecs so no export; a branch `dev` (commit `576514a`, 2026-10-21, a data da pesquisa anterior) e a reescrita 2.0, cujo motor e o pacote `@omnimedia/omnitool` (repo separado, MIT, commit `c87fa88`, 2026-10-16). Li os tres. [V]
- **omnitool confirma nosso desenho e acrescenta tres pecas reaproveitaveis (MIT):** (1) forma de onda por piramide de picos (`timeline/parts/waveform/*`), (2) miniaturas por `CanvasSink` do mediabunny (`timeline/parts/filmstrip.ts`), (3) mixagem de audio em JS puro e decode/encode em Worker com `VideoFrame` passado por stream transferivel (`driver/*`, `export/parts/audio-mix.ts`). O relogio dele e o do audio (`AudioContext.currentTime`), como o nosso. [V]
- **Mover a composicao de Canvas 2D para WebGL: nenhum dos projetos traz numero medido de ganho.** [V] O unico argumento real e funcional (transicoes gl-transitions, chroma key, efeitos), nao de velocidade. omnitool compoe com Pixi (WebGL2) na thread principal e ate deixa comentario de "memory leaks on chrome" para WebGL. Recomendo WebGL **so como passo opcional para transicoes**, com WebGL cru (sem regl/twgl), e so depois de um spike medido no Poco.
- **Worker + OffscreenCanvas:** ninguem compoe em Worker. omnitool decodifica e codifica em Worker (compoe na thread principal); WebAV faz tudo na thread principal (so um timer em Worker); omniclip `main` decodifica e codifica em Workers com polling. Para nos o export em Worker e viavel (nosso `draw.ts` e puro e ja usa `OffscreenCanvas`), mas bloqueia em `OfflineAudioContext` (nao existe em Worker [I]) — a solucao e o mixer JS do omnitool.
- **diffusionstudio/core: descartar.** O repo nao contem o motor (so docs e playground), exige `licenseKey` (marca d'agua no render sem chave) e cabecalhos COOP/COEP (SharedArrayBuffer). [V]
- **wavesurfer.js, regl, twgl, react-timeline-editor, mp4box.js: nao adotar como dependencia.** Motivos concretos abaixo (decodifica o arquivo inteiro em memoria; regl/twgl nao conhecem `VideoFrame`; timeline DOM com `interactjs`+`react-virtualized` para mouse; mediabunny ja cobre demux).
- **web-demuxer: MIT no wrapper, mas `lib/` e FFmpeg sob LGPL** [V, README linha 321]. Para produto fechado e risco juridico; so plano B para formatos que o mediabunny nao abra.

## 1. Commits lidos e licencas (conferidas no arquivo LICENSE)

| Projeto | Commit lido | Data do commit | Licenca (arquivo LICENSE) |
| --- | --- | --- | --- |
| omniclip `main` | `cbe581a` | 2025-08-07 | MIT, "Copyright (c) 2024 Przemyslaw Galezki" [V]. `package.json` diz `ISC`: inconsistente, ambas permissivas; manter o aviso do LICENSE (MIT). |
| omniclip `dev` (2.0) | `576514a` | 2026-10-21 | MIT, "Copyright (c) 2025 Przemyslaw Galezki" [V]. So UI; o motor vem de `@omnimedia/omnitool` [V]. |
| **omnitool** (nao estava na lista; dependencia do omniclip 2.0) | `c87fa88` | 2026-10-16 | MIT, "Copyright (c) 2025 Przemyslaw Galezki" [V]. README: "Work In Progress, expect breaking changes" [V]. |
| WebAV | `42dd6fd` | 2026-01-10 | MIT, "Copyright (c) 2023 风痕" [V]. Pacote usa fork `@webav/mp4box.js` (licenca do fork nao verificada). |
| diffusionstudio/core | `4e784a7` | 2025-11-18 | MPL-2.0 [V], mas **sem codigo do motor no repo** (so `docs/` e `playground/`) [V]. |
| wavesurfer.js | `cdef4ac` | 2026-10-23 | BSD-3-Clause, "Copyright (c) 2012-2023, katspaugh and contributors" [V]. |
| gl-transitions | `66a9759` | 2026-10-21 | MIT [V]. Dos 125 shaders: 123 com `// License: MIT`, `StereoViewer.glsl` BSD-2, `InvertedPageCurl.glsl` BSD-3 [V]. |
| regl | `581f807` (v2.1.1) | 2026-06-21 | MIT, Mikola Lysenko [V]. |
| twgl.js | `d914d1e` (v7.0.2) | 2026-10-19 | MIT, Gregg Tavares [V]. |
| react-timeline-editor | `4148f4a` | 2026-01-25 | MIT, zdarcy [V]. |
| mp4box.js | `a221e74` (v2.4.1) | 2026-10-23 | BSD-3 (cláusula "Neither the name" presente) [V]. |
| web-demuxer | `9172171` (v4.0.0) | 2025-12-20 | MIT no codigo principal; `lib/` FFmpeg-derivado sob LGPL [V, README]. |

Cuidados de licenca dentro dos repos:
- gl-transitions: `burn0.glsl` e `perlin.glsl` citam `shadertoy.com/view/4dS3Wd` como origem [V]; Shadertoy usa por padrao CC BY-NC-SA, o cabecalho diz MIT mas a origem nao e confirmada: **nao copiar esses dois**. `StereoViewer` (BSD-2, "free for use ... with credit") e `InvertedPageCurl` (BSD-3, HP) pedem aviso proprio no arquivo copiado. [V]
- WebAV `chromakey.ts` e "adaptado de jameshfisher.com/2020/08/11/..." [V]: a origem do shader nao tem licenca declarada; tratar como **so ideia** (reescrever o shader, ele e curto).
- omniclip `main` traz fontes (Nippo FFL, Poppins/Noto OFL), `assets/transitions/transitions.rar` e `compositor/lib/*` (MIT, Jin) [V]: nada disso nos interessa.

## 2. omniclip (priority) e omnitool

### 2.1 omniclip `main` (v1.1.3): fraco para nos [V]

- **Reproducao:** cada clip e um `<video>` dentro de um `PIXI.Texture`; `compositor/controller.ts` `#on_playing` soma `performance.now()` por `requestAnimationFrame` (`#calculate_elapsed_time`) e chama `element.play()`/`currentTime = x` nos elementos. **Dois relogios** (o do rAF e o de cada `<video>`), sem correcao de deriva: exatamente a classe de bug que o README do projeto diz ter eliminado. Seek espera o evento `seeked` (`#onSeeked`). [V]
- **Composicao:** Pixi v7 (`preference: "webgl"`), `sortableChildren`, `zIndex = tracks.length - effect.track`. Transicoes: `gsap` anima `progress` de um filtro Pixi com GLSL do `gl-transitions`, renderizando "from"/"to" em `RenderTexture` 1920x1080 fixas (`transition-manager.ts`). [V]
- **Export** (`video-export/*`): um `Worker` de decode por clip (`decode_worker.ts`, `VideoDecoder`) + um `Worker` de encode (`encode_worker.ts`, H.264 `annexb`); demux com `web-demuxer` baixado de CDN (`tools/demuxer.ts`); cada frame decodificado vai por `postMessage` (clonado), e depois `draw_decoded_frame` copia o `VideoFrame` para um `<canvas>` 2D e recria uma `PIXI.Texture.from(canvas)` por frame (`video-manager.ts`). Espera frame com `setInterval(..., 100)` (polling). O resultado e H.264 cru que o **ffmpeg.wasm** (core baixado de unpkg) remuxa junto com o audio (`FFmpegHelper.merge_audio_with_video_and_mux`). [V]
- **Miniaturas** (`timeline/parts/filmstrip.ts`): `<video>` oculto, `currentTime = t`, espera `seeked`, `drawImage` num canvas 150x50, `toDataURL("image/webp")`. Lento e serial. **Forma de onda** (`waveform.ts`): `fetchFile(file)` (arquivo inteiro na memoria) + wavesurfer. [V]
- **Testes:** `timeline/controller.test.ts` tem os dois casos **comentados**. [V]
- Veredito: **nada para copiar do `main`** alem de ideias negativas (polling, ffmpeg.wasm, arquivo inteiro na RAM).

### 2.2 omniclip `dev` (2.0): so UI de timeline com ideias uteis [V]

O motor saiu para o omnitool. O que ha de aproveitavel na UI (todos MIT, `s/client/editor/ui/logic/parts/`):
- `interactions/drag/parts/snappy.ts` + `snappy.test.ts` (128 linhas de teste): `snap(x, threshold, targets)`, `getSnapCandidates(targets, movingClips, anchorStart)` — gera candidatos para **inicio e fim** do clip arrastado (`target - offsetStart`, `target - offsetEnd`), e `getMagneticInsertIndex` (insercao magnetica por centro). Nosso `snap()` em `src/ui/Timeline.tsx` (linhas ~85-100) recebe um unico instante e testa as bordas dos outros clips + playhead + 0; so a borda que o usuario puxa gruda. [V para o nosso, V para o deles]
- `interactions/roll/roller.ts`: **roll edit** (arrasta o corte entre dois clips adjacentes: um encurta, o outro alonga) com `roll(left, right, delta, leftMediaDuration, rightMediaDuration)`. Nao temos roll em `src/domain/timeline.ts` (so `trimClipIn/Out`, `rippleTrim`). [V]
- `TODO.md` lista slip edit, ripple, cut jumping: backlog deles, ainda nao feito. [V]
- Dependencias do `dev`: `@ai-sdk`, `better-auth`, `pg`, `posthog-js`, `fastify`, `@huggingface/transformers`: **nao e um editor leve**; usar so como fonte de ideias. [V]

### 2.3 omnitool: arquitetura (o que importa) [V]

Arquivos em `s/` do repo `omni-media/omnitool`.

- **Relogio/reproducao** (`timeline/renderers/player/parts/playback.ts`): `currentTime = playbackStart + (audioContext.currentTime - audioStartSec) * rate`. Ou seja, **o relogio do audio manda**, igual ao nosso `Player`/`AudioMixer.timeMs()`. O laco visual (`schedulers.ts` `realtime()`) so dispara `composite()` quando `now - lastComposite >= frameDuration`. Nao ha o suavizado de `getOutputTimestamp` que temos em `src/engine/audio.ts` — o nosso e melhor. O audio e agendado ate 0,75 s a frente (`while (timestamp - (ctx.currentTime ...) > 0.75) sleep 25`), o nosso 2 s (`AHEAD_S`).
- **Decodificacao e ciclo do frame** (`driver/fns/work.ts`, `timeline/renderers/export/parts/cursor.ts`): cada clip tem um **cursor so-para-frente** (`CursorVisualSampler`) que le `VideoSampleSink.samples(start, end)` **limitado ao fim do clip + cauda de transicao**, mantem `current` e `nextPromise`, escolhe o frame mais proximo do alvo e devolve **um clone** (`new VideoFrame(current)`); quem recebe fecha. Cursores de clips que passaram sao cancelados (`advance()`); proximos clips sao preparados com antecedencia de **500 ms** (`#prepareAhead`, decodifica o primeiro frame antes de aparecer). Reproducao reversa: `ReverseCursorVisualSampler`, janelas de 1 s com prefetch da janela anterior.
- **Worker + transferencia** (`driver/driver.ts`, `driver/fns/work.ts`): `Comrade.thread` (lib `@e280/comrade`, MIT) cria o Worker. `decodeVideo` cria um `TransformStream<VideoFrame,VideoFrame>` e **transfere o `writable`** mais uma `MessagePort` de cancelamento ao Worker; o Worker faz `for await (sample of sink.samples(start,end)) { frame = sample.toVideoFrame(); sample.close(); await writer.write(frame); frame.close() }`. `encode()` transfere `ReadableStream<VideoFrame>`, `ReadableStream<AudioData>` e o `writable` do `StreamTarget` do mediabunny; o Worker monta `Output` + `VideoSampleSource`/`AudioSampleSource` e escreve MP4/WebM/MOV/MKV. **A composicao nao esta no Worker**: `Compositor.setup()` roda na thread principal.
- **Composicao** (`driver/parts/compositor.ts`): Pixi v8 `autoDetectRenderer({preference:"webgl", preferWebGLVersion:2, preserveDrawingBuffer:true})` com o comentario `// webgl and webgl2 causes memory leaks on chrome`. Por frame: `Texture.from(layer.frame)` por camada e `texture.destroy(true)` no fim, `renderer.render(stage)`, `new VideoFrame(renderer.canvas, {timestamp:0})`. Transicoes: `RenderTexture` para "from" e "to" + filtro com o GLSL do gl-transitions (`features/transition/parts/fragment.ts`).
- **Transicao entre clips** (`renderers/parts/samplers/visual/parts/sequence.ts`, `transition.ts`): transicao e um item entre dois clips na sequencia; o clip que sai e amostrado com `allowHandles` (le alem do ponto de saida) e, se nao houver frame, **prende no ultimo instante valido** (`sampleTransitionHandle` clampa em `duration - 1`). Mesma ideia da nossa regra "o clip que sai continua tocando e depois segura o ultimo frame" em `src/domain/composition.ts` (`sourceTimeOf` com `FRAME_EPSILON_MS`).
- **Audio no export** (`export/parts/audio-mix.ts`, `resamplers.ts`, `audio-gain.ts`, `produce-audio.ts`): mixer em **JS puro** — soma blocos planares f32 de 1024 frames, clamp, `AudioData` f32-planar a 48 kHz; reamostragem linear; ganho por clip. Nao usa Web Audio, por isso roda em qualquer thread.
- **Export** (`export/produce.ts`, `produce-video.ts`): `fixedStep` por frame: `sampler.next(t)` -> `driver.composite(layers)` -> `new VideoFrame(composed, {timestamp: i*dt})` -> escreve no stream que o Worker de encode consome. O `produce()` nao e aguardado (`produce()` solto) e o backpressure vem do stream. Config padrao do encoder (`driver/parts/constants.ts`): `hardwareAcceleration: "no-preference" // prefer-hardware seems like 2x slower from what i been testing` — **uma afirmacao sem numeros**; nosso `exporter.ts` usa `prefer-hardware`: vale uma medicao A/B no Poco.
- **Miniaturas** (`timeline/parts/filmstrip.ts`): `Filmstrip.init(source, {frequency, canvasSinkOptions: {width:80,height:50,fit:"fill"}})` usa `mediabunny` **`CanvasSink.canvasesAtTimestamps(missing)`**, janela ativa = faixa visivel +- margem, so regenera quando a faixa chega perto da borda, cache `Map<tempo, canvas>` podado fora da janela, e uma **fila estatica** (`queue(...)`) serializa a geracao entre clips (`setTimeout` entre tiles para nao travar a UI). Testado em `demo/routines/filmstrip-test.ts` (10 miniaturas por segundo).
- **Forma de onda** (`timeline/parts/waveform/{collect,waveform,render,cache}.ts`): decodifica o audio **uma vez em streaming** (`driver.decodeAudio`, no Worker), canal 0, e guarda o maximo absoluto por 32 amostras (nivel mais fino) + **piramide de 7 niveis** (2048...32 amostras/pico) em `Float32Array`; renderiza **tiles** (`TARGET_TILE_WIDTH = 512`, `MAX_TILE_WIDTH = 4096` px) so da faixa visivel +- margem, escolhendo o nivel pelo zoom, com cache por tile e geracao cancelavel (`#generation`). O desenho padrao e 1 coluna por pixel (`fillRect(px, centro - h/2, 1, h)`).
- **Modelo de timeline:** itens em arvore (`Sequence`, `Stack`, `Clip`, `Transition`, `Gap`...) com `childrenIds` — mais geral que o nosso `Track/Clip`, sem ganho para o nosso produto. [V, nao detalhado]
- **Peso:** dependencias de runtime `pixi.js`, `pixi-filters`, `gsap` (no omniclip), `@huggingface/transformers`, `@e280/*`, `gl-transitions`, `mediabunny` [V, package.json]. O pacote inteiro nao cabe como dependencia no telefone; as pecas boas sao arquivos pequenos copiaveis.
- **Risco:** "WIP, breaking changes"; versao `1.1.0-145`; testes do pacote "disabled for now" (`"test": "echo \"node tests disabled for now\""`) embora exista `renderers.test.ts` (418 linhas, inclui "5s long export at 30fps renders exacly 150 frames"). Nenhuma mencao a Android/WebView em README ou codigo. [V]

### 2.4 O que o omnitool faz melhor que o nosso, e o que NAO

| Tema | omnitool | Nosso | Quem ganha |
| --- | --- | --- | --- |
| Relogio | audio (`currentTime`), sem suavizar | audio + `getOutputTimestamp` + piso nao-decrescente (`player.ts`, `audio.ts`) | **nos** |
| Clip tarde na borda | primeiro frame pre-decodificado a 500 ms; cursor limitado ao fim | slot por clip a 1500 ms, hold 400 ms, frame antigo ate o novo (`player.ts`, `feed.ts`) | **empate**, ours mais defensivo |
| Peso de decoders abertos | cancela cursor quando o clip passa | `MediaPool.prune` a cada 1 s | empate |
| Forma de onda / miniaturas | tem | **nao temos** (`Timeline.tsx` so desenha `<div>` com nome) | **omnitool** |
| Mixagem no export | JS puro, roda em Worker | `OfflineAudioContext` em janelas de 10 s (`audio.ts` `mixWindow`) | omnitool (por portabilidade para Worker); o nosso e mais simples e ja trata velocidade/fade |
| Export fora da thread principal | decode+encode em Worker (compoe na principal) | tudo na principal | omnitool (parcial) |
| Transicoes | 100+ via gl-transitions (Pixi) | so transformacoes (`domain/transitions.ts`) | omnitool |
| Reverso | janelas de 1 s | nao temos | omnitool |
| Memoria | `Texture.from` + `destroy` por frame por camada; WebGL "leaks" | sem texturas, `VideoSample.draw` direto no Canvas 2D | **nos** |

## 3. WebAV (`@webav/av-cliper`, `av-canvas`) [V]

- **Arquitetura:** `MP4Clip.tick(time)` devolve `{video: VideoFrame, audio: Float32Array[]}`; `VideoFrameFinder.find(time)` decodifica **uma GoP inteira por vez** (`#startDecode` procura o proximo IDR, le a faixa de bytes com `OPFSToolFile`, cria `EncodedVideoChunk` de todas as amostras, `dec.decode` todas, `flush()` sem `await`) e mantem `#videoFrames` (pre-decodifica enquanto houver menos de 10). `Combinator` (export) e um laco no thread principal: `OffscreenCanvas` 2D + `ctx.drawImage(frame)` por sprite, `new VideoFrame(cvs, {timestamp})`, `recodemux` (encoders + mux com `mp4box` fork). Backpressure: `letEncoderCalmDown` (se `encodeQueueSize > 50`, `sleep(15)`). Preview: `AVCanvas` com `workerTimer` (um Worker so de `setInterval` 16,6 ms para nao parar com a aba em segundo plano) e passo fixo de 1/30 s corrigido por `performance.now()`.
- **Sincronia A/V:** o audio e **empurrado como PCM por frame** e agendado com um acumulador `audioPlayAt = max(ctx.currentTime, audioPlayAt) + duracao` (`av-canvas.ts` `#render`); nao ha relogio mestre unico, o desvio so e tratado pulando passos. Pior que o nosso.
- **Camadas atrasadas:** `VisibleSprite` guarda `#lastVf` e continua desenhando-o quando nao chega frame novo (como nosso hold); `#autoPreFrame` prepara `preFrame(0)` dos sprites que comecam em ate 1 s (throttle de 500 ms); `previewFrame` liga `#waitingPreviewFrame` e **pula a renderizacao enquanto prepara**, para evitar flicker entre varios clips. Ideia ja coberta pelo nosso `drawStill` coalescido.
- **Miniaturas** (`MP4Clip.thumbnails`, `thumbnailByKeyFrame`): **decodifica so os keyframes** (`samples.filter(s => s.is_sync ...)`), desenha cada `VideoFrame` num `OffscreenCanvas` pequeno (100 px) e `convertToBlob`; cancelavel por `AbortController`; se o decoder falha sem nenhuma saida, **recomeca com `hardwareAcceleration: 'prefer-software'`**. E a forma mais barata de fazer miniaturas: custo = numero de keyframes, nao de frames.
- **Robustez de decoder:** trata o erro `'Codec reclaimed due to inactivity'` (recria o decoder), `fixFirstBlackFrame` (corrige `cts` do primeiro frame <200 ms) e reduz para software no primeiro erro de decode. [V] Vale conferir se o mediabunny 1.61 cobre isso por dentro [I, nao verificado].
- **WebGL:** so em `chromakey.ts` (WebGL2 num `OffscreenCanvas`; `gl.texImage2D(..., VideoFrame)` direto; usa `codedWidth/codedHeight`; saida `new VideoFrame(cvs, {alpha:'keep'})`). **Prova pratica de que o caminho `VideoFrame -> textura -> VideoFrame` e curto (~300 linhas)**; o resto do WebAV e Canvas 2D.
- **Worker:** nenhum para decode/composicao (`grep Worker` so em `worker-timer.ts`, `av-utils.ts`, demos). [V]
- **Peso e risco:** `@webav/mp4box.js` (fork), `opfs-tools`, `wave-resampler`; README "Compatible with Chrome 102+"; produto "WebAV Pro" separado; ultimo commit 2026-01-10. Leitura de GoP inteira (ate 30 MB de uma vez em `videosamples2Chunks`, fila ate 600 chunks) e arriscada com 800 MB de RAM no telefone [I]. Nada de Android WebView mencionado.
- **Veredito:** **so ideias** (miniaturas por keyframe, fallback software, `autoPreFrame`). Copiar nada alem de, no maximo, a ideia do `thumbnailByKeyFrame`. Nao adotar o SDK: troca nosso nucleo (relogio unico) por um pior.

## 4. diffusionstudio/core [V]

- O repo no commit `4e784a7` tem 133 arquivos, **todos docs (Next.js) e playground**; o motor e consumido do npm (`@diffusionstudio/core` / `core-v4`) [V, `playground/package.json`, `render.ts`].
- `README.md` linhas 122-140: exige `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: credentialless` (SharedArrayBuffer); uso gratis **com marca d'agua "Made with Diffusion Studio" no video renderizado**; remocao com `licenseKey` paga (chave assinada, verificada localmente). `docs/.../v3-v4.mdx` confirma `licenseKey` no construtor e remove `HTMLClip`/`WaveformClip`.
- Transicoes documentadas: `dissolve`, `slide-from-right/left`, `fade-to-black/white` (docs/transitions.mdx) — menos que o gl-transitions.
- **Veredito: descartar.** Marca d'agua + chave comercial + cabecalhos COOP/COEP (muito dificeis num WebView embutido) + codigo nao auditavel aqui. Nem como biblioteca MPL: o produto fechado nao pode embutir um render com marca d'agua.

## 5. wavesurfer.js [V]

- v8.0.3, `src/` com 8,7 mil linhas (renderer, plugins, espectrograma).
- `decoder.ts`: `audioCtx.decodeAudioData(arrayBuffer)` — **decodifica o arquivo inteiro** para um `AudioBuffer` (10 min estereo a 48 kHz ~ 230 MB em float) e antes disso carrega o arquivo na memoria (`fetcher.ts`). Contorno existente: passar `peaks` + `duration` ja prontos (`wavesurfer.ts` linhas ~553-560) — ai a biblioteca so desenha. `exportPeaks` usa `maxLength = 8000` pontos por canal.
- Desenho: `computeCanvasPlan`, `getLazyRenderRange` (canvases de largura maxima, so os visiveis +-1) — **mesma ideia dos tiles do omnitool**, ja implementada em ~30 linhas la.
- **Veredito: nao adotar.** Peso e escopo (player proprio, plugins, espectrograma) para algo que e: (1) gerar picos em streaming com o mediabunny e (2) pintar colunas num canvas. omnitool ja entrega isso em ~200 linhas MIT. Se quisermos o nome do pacote: BSD-3, dado que so pintaria picos nossos.

## 6. gl-transitions, regl, twgl.js [V]

### gl-transitions
- 125 transicoes `.glsl` (457 KB no total na pasta, texto), escritas em **GLSL ES 1.00** (WebGL 1), contrato fixo: funcao `vec4 transition(vec2 uv)` com `progress`, `ratio`, `getFromColor(uv)`, `getToColor(uv)`; parametros por `uniform ... // = valor`; nao definem `main()` nem `precision` [V, README].
- Integracao de referencia (MIT) no omnitool: `features/transition/parts/fragment.ts` declara `precision`, `uniform sampler2D from, to; progress, ratio, _fromR, _toR`, implementa `getFromColor/getToColor` com correcao de proporcao e `main(){ gl_FragColor = transition(vTextureCoord); }`. Reimplementavel em WebGL cru em ~40 linhas.
- Pacote npm `gl-transitions` traz tambem `glsl3/*` para WebGL2 e `compatibility.json` [V, README].
- **Veredito: copiar os `.glsl` selecionados (MIT, mantendo o cabecalho `// Author/License` de cada arquivo) — escolher 8-12 transicoes simples** (fade, wipeLeft/Right/Up/Down, directional, crosswarp, circleopen, radial, pixelize, squeeze...). Excluir `burn0`, `perlin` (origem Shadertoy), e so incluir `StereoViewer`/`InvertedPageCurl` com os avisos BSD embutidos.

### regl 2.1.1 e twgl.js 7.0.2
- regl: `lib/texture.js` classifica fontes como canvas/img/video/`ImageBitmap`/array; **nao reconhece `VideoFrame`** [V, grep]. twgl: `setTextureFromElement` le `element.width/height` [V]; `VideoFrame` expoe `displayWidth/codedWidth`, nao `width` — exigiria passar tamanhos manualmente.
- Para um passo que so desenha 1-3 quads com um shader, WebGL cru (`createShader`, `createProgram`, um buffer de 6 vertices, `texImage2D(frame)`) tem o tamanho de um dos dois "helpers"; o `chromakey.ts` do WebAV prova isso.
- **Veredito: nenhum dos dois.** (regl e twgl: MIT, sem problema de licenca; so nao compensam.) twgl.min tem ~65 KB em `dist/6.x` [V] e regl precisa de build [V]; nao vale para ~3 programas.

## 7. react-timeline-editor, mp4box.js, web-demuxer

- **react-timeline-editor (`@xzdarcy`)**: `packages/timeline` (2,9 mil linhas), depende de `interactjs`, `react-virtualized` (Grid), `framework-utils` [V]. Virtualiza **linhas** com `Grid`, interacao por `interactjs` (mouse/ponteiro, sem gestos de pinca nem playhead fixo). Auto-scroll durante arrastar (`useAutoScroll.ts`: velocidade proporcional a distancia fora da borda, max 3 px/frame) e linha de insercao entre faixas (`insertion_line.tsx`, `drag_preview.tsx`) sao as unicas ideias. **Veredito: so ideias**; nao adotar (conflita com `Timeline.tsx` de pinca/scrub e playhead fixo).
- **mp4box.js**: BSD-3, v2.4.1. Nada que o mediabunny nao resolva; WebAV usa fork proprio. **Nao adotar.**
- **web-demuxer**: `wasm` full 1131 kB gz (mov, mp4, avi, flv, mkv, webm, mpeg, asf, mpegts) e mini 493 kB gz (mov, mp4, mkv, webm, m4v) [V, README linhas 288-291]; roda em Worker. `lib/` e FFmpeg sob **LGPL** [V]: embutir o `.wasm` num produto fechado exige cumprir LGPL (oferecer fonte da lib e permitir substituicao) [I]. **Veredito: nao incluir por padrao**; plano B so se aparecer arquivo real de AVI/FLV/TS que o mediabunny nao abre (conferir antes na lista de formatos do mediabunny [I]) e com aval juridico.

## 8. Respostas diretas

### 8.1 Mover composicao de Canvas 2D para WebGL vale a pena?

Evidencia no codigo:
- omnitool compoe em WebGL2 via Pixi na **thread principal** e faz `Texture.from(VideoFrame)` + `destroy` por camada por frame; comentario do autor: "webgl and webgl2 causes memory leaks on chrome" (`compositor.ts` linha 35). Nenhuma medicao no repo. [V]
- omniclip `main` usa Pixi v7/WebGL; nenhuma medicao. [V]
- WebAV e diffusion (docs) compoem em Canvas 2D (diffusion: "Canvas2DContext e WebCodecs" no README); WebAV so usa WebGL em `chromakey.ts`. [V]
- **Nenhum projeto traz numero de ganho de velocidade.** [V] O que o WebGL entrega neles e funcionalidade (transicoes shader, filtros Pixi, chroma key).

Conclusao [I]: nao migrar a composicao inteira. Nosso gargalo medido e decodificacao/seek (README e `feed.ts`), nao o `drawImage`. O custo real de WebGL no telefone: contexto + textura RGBA por camada (1080p = ~8 MB cada), upload `texImage2D(VideoFrame)` por frame, perda de contexto, e o caminho do export (`CanvasSource` precisa do canvas desenhado no mesmo turno ou `preserveDrawingBuffer`). Pontos a favor de um passo GL **somente para transicoes/efeitos**: o `ctx.filter = brightness()` do `draw.ts` e o unico efeito por pixel que fazemos e depende do caminho de `filter` do Canvas 2D (custo em Android nao medido [I]).

Plano de decisao: spike de 1 dia no Poco medindo, para 1080p e 720p, 3 camadas, o tempo de composicao por frame em Canvas 2D (`pm.startTrace()`) contra um programa WebGL cru de 1 quad por camada com `texImage2D(frame)`. So adotar se (a) WebGL2 estiver disponivel no WebView do alvo e (b) o custo por frame nao passar de ~5 ms. Pecas a usar: **WebGL cru + GLSL do gl-transitions + wrapper de fragmento do omnitool; sem regl, sem twgl, sem Pixi.**

### 8.2 Alguem roda decode/composicao/export em Worker com OffscreenCanvas? Como passam os VideoFrame? Serve para nos?

- **omnitool:** decode em Worker (`work.ts decodeVideo`) e encode em Worker (`work.ts encode`); frames atravessam por **`WritableStream`/`ReadableStream<VideoFrame>` transferidos** (`this.thread.work.decodeVideo[tune]({transfer: [videoTransform.writable, port2]})`), cancelamento por `MessagePort`. Composicao na thread principal (Pixi). [V]
- **omniclip `main`:** decode e encode em Workers; frames por `postMessage({frame})` (clonagem estruturada, `frame.close()` depois). Composicao na principal. O `compositor/worker.ts` e a versao com `OffscreenCanvas` — **toda comentada**. [V]
- **WebAV:** nada em Worker alem do timer. [V]
- **Nenhum compoe em Worker com OffscreenCanvas** [V].
- **Serve para nos?** Sim para o **export**, nao para o preview. O export ja usa `new OffscreenCanvas(...)` e `drawFrame` aceita `OffscreenCanvasRenderingContext2D` (`draw.ts`, `Ctx2D`). Mover `exportComposition` para um Worker exige: (1) trocar `mixWindow` (que usa `OfflineAudioContext`, que **nao existe em Worker** [I]) pelo mixer JS do omnitool; (2) levar `MediaPool` para o Worker: `XMLHttpRequest` existe em Worker dedicado [I] (o `fetchBlob` atual funcionaria), mas o `FileReader` do host (`readChunk`) precisa de ponte por `MessagePort`; (3) `ExportSink` tambem por ponte; (4) o mediabunny roda em Worker (omnitool prova). Ganho esperado [I]: UI e gestos continuam fluidos durante o export, e o laco de export nao disputa o rAF do preview; **nao** e mais rapido por si so. Para o preview, transferir `VideoFrame` a cada tick custa uma ponte e nao ha caso de uso no nosso desenho de relogio unico.

### 8.3 Como fazem miniaturas e forma de onda baratas?

- **Miniaturas:** (a) omnitool: `CanvasSink.canvasesAtTimestamps` 80x50, janela visivel+margem, cache por tempo, fila serial entre clips, `setTimeout` entre tiles (`filmstrip.ts`); (b) WebAV: so keyframes (`thumbnailByKeyFrame`), `OffscreenCanvas` 100 px, `convertToBlob`; (c) omniclip `main`: `<video>` seek + `toDataURL` (a pior). **O mediabunny 1.61 instalado ja tem `CanvasSink` com `canvasesAtTimestamps` e `poolSize`** [V, `node_modules/mediabunny`]. Combinar (a) para o cache/janela com (b) quando o clip tem keyframes a ~1 s [I].
- **Forma de onda:** omnitool: leitura em streaming do audio com `AudioSampleSink` (aqui via Worker), canal 0, max-abs por 32 amostras, piramide de 7 niveis, tiles canvas de 512 px (`collect.ts`, `waveform.ts`). wavesurfer: decodifica tudo (nao serve). Memoria do omnitool: ~6 KB/s no nivel mais fino em `Float32Array` (48 kHz/32 = 1500 picos/s * 4 B); para nos basta ~100 picos/s em `Uint8Array` por clip (600 B/s, ~0,35 MB por 10 min) [I, conta].

### 8.4 Como evitam camadas atrasadas nas fronteiras e mantem a sincronia A/V?

- **omnitool:** relogio = audio; cursor so-para-frente por clip, limitado a `fim + transicao`; antecedencia de 500 ms decodificando o primeiro frame (`entry.ready`); clip que sai amostrado alem do ponto de saida e, sem frame, segura o ultimo valido. [V]
- **WebAV:** relogio por passo fixo + correcao por `performance.now()`; sprite guarda o ultimo frame; `autoPreFrame` 1 s a frente; pula o render enquanto prepara frames de preview. Audio sem relogio mestre. [V]
- **omniclip `main`:** nenhum mecanismo (dois relogios, seek aguardando `seeked`). [V]
- **Nosso:** equivalente ou mais forte (`Player.tick`, `Feed.restart` mantem o frame antigo, hold 400 ms, piso nao-decrescente do tempo, relogio do audio suavizado). O que ainda vale testar: reduzir `PREPARE_AHEAD_MS` de 1500 para 500-800 ms (menos decoders abertos, menos memoria) medindo "late" com o trace; e limitar o fim do iterador em `Feed.restart` ao fim do clip + cauda de transicao. [I]

## 9. Plano de adocao (maximo 10 passos, em ordem)

1. **Forma de onda por picos em streaming** — reimplementar a ideia de `omnitool/s/timeline/parts/waveform/{collect,waveform,render}.ts`.
   - Nossos arquivos: novo `src/engine/peaks.ts` (le o audio do clip com `AudioSampleSink` via `pool.input(uri)`, ~100 picos/s em `Uint8Array`, 2-3 niveis, cache por `uri`), `src/ui/Timeline.tsx` (um `<canvas>` por clip de audio/video com som, tiles so da faixa visivel), `src/engine/media.ts` (cache/limpeza).
   - Copiar ou reimplementar: reimplementar (200 linhas, simplificado); se copiar `collect.ts` ou `render.ts`, incluir aviso MIT "Copyright (c) 2025 Przemyslaw Galezki" no cabecalho do arquivo e no `NOTICE` do produto.
   - Esforco: M. Ganho: fecha a lacuna visivel da timeline; custo de memoria baixo (~0,3 MB por 10 min).
2. **Miniaturas na timeline** — `CanvasSink.canvasesAtTimestamps` (mediabunny, ja instalado) com cache por tempo e fila serial (ideia de `omnitool/.../filmstrip.ts`); fase 2: so keyframes (ideia de WebAV `thumbnailByKeyFrame`).
   - Nossos arquivos: novo `src/engine/filmstrip.ts`, `src/ui/Timeline.tsx` (fundo do clip), `src/engine/media.ts` (reusar `pool.input`; **gerar so com o player parado ou pausado**, para nao competir por decoders; contar no limite de decoders).
   - Reimplementar (a classe tem 175 linhas; copia MIT com aviso e possivel). Esforco: M. Ganho: orientacao visual no trim/split; custo de decode e o risco principal (medir no Poco).
3. **Extrair `snappy.ts` e acrescentar roll edit** — ideias de `omniclip-dev/.../interactions/drag/parts/snappy.ts` (+ testes) e `interactions/roll/roller.ts`.
   - Nossos arquivos: `src/ui/Timeline.tsx` (`snap()`: considerar tambem a borda final do clip arrastado), `src/domain/timeline.ts` (nova `rollEdit(left, right, delta)`), `tests/timeline-invariants.test.ts` (incluir roll no teste aleatorio).
   - Copiar `snappy.ts` + `snappy.test.ts` (MIT, aviso) ou reimplementar (30 linhas); roll: reimplementar nas nossas unidades (ms de fonte vs timeline). Esforco: S. Ganho: edicao mais precisa por toque.
4. **Spike WebGL para transicoes (gl-transitions)** — antes de qualquer codigo de produto, medir (secao 8.1) no Poco; se passar, passo GL opcional so quando `opsAt` devolver uma transicao-shader.
   - Nossos arquivos: novo `src/engine/gl.ts` (WebGL cru, ~200 linhas: programa + quad + `texImage2D`), `src/domain/transitions.ts` (adicionar `shader: string` ao tipo), `src/engine/draw.ts` (ramo para op de transicao: desenhar "from" e "to" em dois canvases 2D e misturar no GL), `src/engine/exporter.ts` (ler o canvas GL no `CanvasSource`).
   - Copiar: GLSL de 8-12 transicoes MIT escolhidas (manter cabecalho `Author/License`), mais o wrapper `getFromColor/getToColor` ideia de `omnitool/.../fragment.ts` (MIT) — aviso MIT de gl-transitions e de omnitool no `NOTICE`; **nao** copiar `burn0`/`perlin`; `StereoViewer` e `InvertedPageCurl` so com o texto BSD do proprio arquivo.
   - Esforco: L (spike S). Ganho: catalogo de transicoes sem tocar no nucleo; risco: WebGL no WebView do alvo e perda de contexto (precisa fallback para o fade em Canvas 2D que ja existe).
5. **Export em Worker** — mover `exportComposition` para um Worker dedicado com `OffscreenCanvas`.
   - Nossos arquivos: `src/engine/exporter.ts` (corpo vira modulo do Worker), novo `src/engine/export.worker.ts` + ponte (`MessagePort`) para `FileReader` e `ExportSink` de `src/ports/host.ts`, `src/engine/audio.ts` (novo `mixWindowJs` sem Web Audio), `src/engine/media.ts` (`fetchBlob` ja usa XHR; conferir em Worker).
   - Copiar: `omnitool/.../audio-mix.ts`, `resamplers.ts`, `audio-gain.ts` (MIT, aviso) como base do mixer JS; resto reimplementar (nosso `scheduleSpan` ja sabe velocidade e fade; o JS precisa reamostrar por `speed` e aplicar `spanGainAt`).
   - Esforco: L. Ganho: UI fluida durante o export; **nao** deve ser vendido como mais rapido. Risco: memoria no Worker (decoders do export mais os do preview) — manter o `prune` do export; medir pico.
6. **Janela de antecedencia menor e iterador limitado** — testar `PREPARE_AHEAD_MS` 500-800 ms e `sink.samples(start, end)` com fim = fim do clip + cauda de transicao (ideia de `omnitool` `cursor.ts` `getCursor`).
   - Nossos arquivos: `src/engine/player.ts` (constante), `src/engine/feed.ts` (`restart(sec, endSec?)`), `src/engine/media.ts` (passar o fim).
   - Reimplementar. Esforco: S. Ganho: menos decoders abertos e menos memoria; so aceitar se o trace de "late" nao piorar no Poco.
7. **Robustez de decoder: fallback para software e recriacao apos "Codec reclaimed"** — ideias de WebAV `VideoFrameFinder` (`downgradeSoftDecode`, mensagem `'Codec reclaimed due to inactivity'`). Primeiro verificar se o mediabunny ja faz isso internamente [I].
   - Nossos arquivos: `src/engine/feed.ts` (tratar erro do iterador e reabrir), `src/engine/exporter.ts` (se `isConfigSupported` prefer-hardware falhar no meio, repetir com software).
   - Reimplementar. Esforco: S. Ganho: menos falhas em aparelhos que matam decoders ociosos.
8. **A/B de `hardwareAcceleration` no export** — o omnitool afirma que `prefer-hardware` foi ~2x mais lento (WebM/VP9, sem numeros); nosso `exporter.ts` usa H.264 e `prefer-hardware` quando suportado. Medir tempo por frame nas duas opcoes no Poco antes de decidir.
   - Nossos arquivos: `src/engine/exporter.ts` (flag de teste). Sem copia. Esforco: S. Ganho: possivel export mais rapido ou confirmacao do que ja temos.
9. **Reproducao reversa (se o backlog pedir "reverso")** — janelas de 1 s com prefetch da janela anterior (`ReverseCursorVisualSampler`, `omnitool/.../cursor.ts`).
   - Nossos arquivos: `src/engine/feed.ts` (modo `reverse`), `src/domain/composition.ts` (`sourceTimeOf` com velocidade negativa), audio reverso a decidir (o omnitool so toca audio a velocidade 1).
   - Reimplementar. Esforco: L. Ganho: so se a story existir; nao antecipar.
10. **Ideia de UX: auto-scroll e linha de insercao ao arrastar clips entre faixas** — de `react-timeline-editor` (`useAutoScroll.ts`, `insertion_line.tsx`).
   - Nossos arquivos: `src/ui/Timeline.tsx`. Reimplementar (nossa timeline tem playhead fixo e pinca; ver se faz sentido). Esforco: S. Ganho: pequeno; fazer depois dos itens 1-3.

Fora do plano (de proposito): Pixi/gsap/ffmpeg.wasm/diffusion/WebAV como dependencias; wavesurfer; regl/twgl; mp4box.js; web-demuxer (plano B juridico); troca da composicao para WebGL sem spike.

## 10. O que nao foi verificado

- Nenhum codigo foi executado: nao medi tempos de composicao, decode, export ou memoria de nenhum projeto; todas as afirmacoes de desempenho acima sao leitura de codigo ou [I].
- Disponibilidade e desempenho de WebGL2 no WebView do Poco, e custo de `texImage2D(VideoFrame)` nesse aparelho: nao verificados.
- `OfflineAudioContext`/`AudioBuffer` indisponiveis em Worker: conhecimento geral [I]; confirmar no console do WebView antes do passo 5.
- Se o mediabunny 1.61 ja trata "codec reclaimed" e fallback para software: nao li o codigo do mediabunny (MPL-2.0).
- Licenca do fork `@webav/mp4box.js` e do pacote npm `@omnimedia/omnitool` publicado (so li o repo, nao o tarball do npm).
- Origem/licenca do shader original do chroma key do WebAV e das duas transicoes derivadas do Shadertoy (`burn0`, `perlin`).
- Atividade: a data do ultimo commit nao prova manutencao; issues e PRs nao foram lidos. Diferenca importante: omniclip `main` parou em 2025-08; o desenvolvimento ativo e `dev` + omnitool.
- Peso real de bundle (kB) de qualquer dependencia: nao medido (exceto os numeros do README do web-demuxer e os arquivos `dist` do twgl).
