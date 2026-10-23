# Pesquisa: mais projetos open source para o editor web

Data: 2026-10-23. Pesquisa somente de leitura: nada foi clonado, instalado ou executado. Nenhum outro arquivo do projeto foi alterado.
Complementa `docs/research-open-editors.md` (OpenCut, opencut-classic, OpenReel, ClearCut), que nao foi repetido aqui.

Legenda:
- **[V]** = verificado na pagina do repositorio ou na API do GitHub (`api.github.com/repos/...`: `license.spdx_id`, `stargazers_count`, `pushed_at`), ou no arquivo LICENSE bruto.
- **[I]** = inferido, vindo de busca na web ou de conhecimento geral, nao confirmado no repositorio.
- Datas de atividade = `pushed_at` (ultimo push ao repositorio). Estrelas arredondadas quando vieram da pagina.

Criterio de licenca do produto: so MIT, BSD, Apache-2.0, ISC, zlib, MPL-2.0 (usado sem modificar). GPL/AGPL/LGPL so como "so ideias".

## 1. Resumo

- Os achados mais uteis sao: **omniclip** (MIT, editor inteiro sobre WebCodecs), **diffusionstudio/core** (MPL-2.0, composicao WebCodecs + Canvas2D com timeline, transicoes e keyframes), **WebAV** (MIT, SDK WebCodecs), **gl-transitions** (MIT, 100+ transicoes em GLSL) e **wavesurfer.js** (BSD-3, forma de onda pronta para a lacuna da timeline).
- Ficam **fora** por licenca: Remotion (licenca propria da empresa), designcombo/openvideo (hoje licenca dual "Other"), Etro, peaks.js, audiowaveform, FFmpeg/ffmpeg.wasm como dependencia do nucleo.
- Nenhum projeto substitui nosso nucleo (relogio unico, `opsAt` unico, um slot de decoder por clip). Ganhos reais: waveform/thumbnails, transicoes em WebGL, e a leitura de um editor completo MIT (omniclip) para comparar a timeline e o export.
- Ressalva: varios repositorios estao parados ha meses (diffusionstudio/core em 2025-11, WebAV em 2026-01, editly em 2025-05). Atividade conta na decisao.

## 2. Candidatos

### 2.1 Editores e motores NLE no navegador

**omniclip** - https://github.com/omni-media/omniclip
- Licenca: MIT [V] (API).
- Atividade: 1468 estrelas, ultimo push 2026-10-21 [V]. README anuncia "Omniclip 2.0 in development" [V, busca].
- O que faz bem: editor completo no navegador, WebCodecs para render, trim, split, transicoes, efeitos, texto, audio, imagem; roda sem conta e sem upload [V, descricao e busca]. Tem modo embutivel em componentes [V, busca].
- O que nos falta: exemplo de editor inteiro MIT (timeline, playback, export) para comparar com o nosso. Nao li o codigo-fonte nesta pesquisa.
- Peso/dependencias: nao verificado (precisa ler `package.json`).
- Cabe no WebView do telefone? [I] Provavel que nao no estado atual: README avisa que pode nao funcionar em aparelhos antigos.
- Veredito: **copiar codigo** para trechos isolados (com aviso MIT), mas so depois de ler `src/` - o estudo vem antes da copia. Pesquisa de codigo: M.

**diffusionstudio/core** (`@diffusionstudio/core`) - https://github.com/diffusionstudio/core
- Licenca: MPL-2.0 [V] (API e pagina). Permitido como biblioteca sem modificar.
- Atividade: 1249 estrelas, ultimo push 2025-11-18 [V]. Ha quase 11 meses sem push: risco de manutencao.
- O que faz bem [V, README]: motor de composicao de video no navegador; decodifica e codifica com WebCodecs (aceleracao de hardware); pinta quadros em Canvas 2D; timeline declarativa com camadas e cortes; efeitos, transicoes, keyframes e mascaras; modo de render de alta fidelidade para saida final. Agradece ao Vanilagy (autor do mediabunny, que ja usamos) [V].
- O que nos falta: referencia de composicao e transicoes com a mesma base tecnica (WebCodecs + Canvas2D). Serve para comparar `composition.ts` e `draw.ts`.
- Peso: [I] dependencias pequenas alem do mediabunny; nao medido.
- Cabe no WebView? [I] Sim em tese (Canvas2D + WebCodecs), mesmo risco de memoria que o nosso.
- Veredito: **usar como biblioteca** apenas num spike (um clip, um corte, uma transicao) para medir; nao trocar o nucleo. Se o spike for melhor, adotar por partes. Esforco do spike: M.

**WebAV (`@webav/av-cliper`)** - https://github.com/WebAV-Tech/WebAV
- Licenca: MIT [V] (API e pagina). Existe um produto pago separado, **WebAV Pro**, com licencas "Pro" (README) [V]. O pacote MIT aberto nao depende dele [I].
- Atividade: 2093 estrelas, ultimo push 2026-01-10 [V]. Parado ha ~9 meses.
- O que faz bem [V, descricao]: SDK para criar e editar video na web sobre WebCodecs. [I] Tem clips MP4/imagem/audio, canvas de composicao e exportacao; nao verifiquei a API nesta pesquisa.
- O que nos falta: segunda referencia de SDK WebCodecs MIT para comparar decodificacao e exportacao.
- Veredito: **so ideias** por ora; spike de comparacao se quisermos um segundo caminho. Esforco: M.

**Etro** - https://github.com/etro-js/etro
- Licenca: **GPL-3.0** [V] (API e pagina).
- Atividade: 1154 estrelas, ultimo push 2026-10-20 [V].
- O que faz bem: camadas e efeitos GLSL, render em `<canvas>` com WebGL [V]. Nao usa WebCodecs [V, pagina].
- Veredito: **so ideias** (GPL). Nao copiar nem depender.

**designcombo / OpenVideo** - https://github.com/openvideodev/react-video-editor (antes designcombo/react-video-editor)
- Licenca: **nao e MIT hoje**. A API marca "Other" [V]; o README descreve modelo de dupla licenca: "Free License" para pessoas, ONGs e empresas com ate 3 funcionarios, e "Company License" paga para o resto [V, README]. Espelhos antigos mostravam MIT [I]; nao usar o espelho como fonte.
- Atividade: 1819 estrelas, ultimo push 2026-06-30 [V].
- Stack: Next.js 15, PixiJS v8, Zustand, Tailwind [V]. Usa Remotion no repositorio segundo a descricao [V, topicos].
- Veredito: **descartar** para codigo (licenca nao permissiva para produto fechado). Ideias de UX apenas.

**Remotion** - https://github.com/remotion-dev/remotion
- Licenca: **Remotion License** (propria), API marca "Other" [V]. Texto [V, LICENSE.md]: empresas com mais de 3 funcionarios precisam de Company License paga; o texto proibe copiar ou modificar o codigo para vender ou sublicenciar um derivado seu, o que cobre um produto fechado feito sobre o Remotion [I, interpretacao].
- Atividade: 66703 estrelas, ultimo push 2026-10-23 [V].
- Veredito: **descartar** (produto fechado nao pode embutir). Para renderizar com React seria custo de licenca; nao recomendado.

**twick** - https://github.com/ncounterspecialist/twick
- Licenca: nao confirmada. API retornou "Other" (NOASSERTION) [V], o que nao e uma licenca OSI conhecida. Confirmar no arquivo LICENSE antes de qualquer uso.
- Descricao: SDK React para editor com timeline em canvas, render no navegador via WebCodecs, exportacao MP4 [V, busca].
- Atividade: dados inconsistentes na minha leitura (uma busca indicou ~467 estrelas e push em 2026-04-25; a API retornou outro numero e data). Nao confiar nos numeros.
- Veredito: **descartar** ate a licenca ser confirmada como permissiva.

**Shotstack Studio SDK** - https://github.com/shotstack/shotstack-studio-sdk
- Licenca: NOASSERTION [V, API]. A documentacao da Shotstack diz "source-available" sob **PolyForm Shield** [I, busca], que nao e OSI e proibe uso que concorra com a Shotstack.
- Veredito: **descartar** para codigo. Pode servir de ideia de UI.

**editly** - https://github.com/mifi/editly
- Licenca: MIT [V]. 5543 estrelas, ultimo push 2025-05-12 [V] (parado).
- O que faz: editor declarativo por linha de comando/API em Node com ffmpeg [V, descricao]. Nao roda no navegador.
- Veredito: **so ideias** (ordem de camadas e transicoes declarativas). Descartar para runtime.

**motion-canvas** - https://github.com/motion-canvas/motion-canvas
- Licenca: MIT [V]. 19449 estrelas, ultimo push 2026-07-02 [V].
- O que faz: animacao programatica com geradores sobre Canvas 2D; orientado a animacao de codigo, nao a edicao de video de usuario [I].
- Veredito: **so ideias**.

**ffmpeg.wasm** - https://github.com/ffmpegwasm/ffmpeg.wasm
- Wrapper: MIT [V]. 17902 estrelas, ultimo push 2026-09-29 [V].
- Licenca do nucleo FFmpeg compilado (`@ffmpeg/core`): depende das flags de build; a pesquisa anterior marcou como possivelmente GPL [I, `docs/research-open-editors.md`]. Nao verificado aqui.
- Peso: WASM grande, lento em telefone [I].
- Veredito: **descartar** para o caminho de edicao (ja decidido na pesquisa anterior).

### 2.2 Transicoes e compositing (WebGL/WebGPU)

**gl-transitions** - https://github.com/gl-transitions/gl-transitions
- Licenca: **MIT** [V, arquivo LICENSE bruto: "MIT License, Copyright (c) 2017-present gl-transitions contributors"]. O README diz que duas transicoes sao BSD [V]; checar a licenca de cada arquivo de transicao antes de copiar.
- Atividade: 2161 estrelas, ultimo push 2026-10-21 [V].
- O que faz bem [V, README]: mais de 100 transicoes em GLSL (funcoes pequenas que misturam duas imagens), com traducao para WGSL, SkSL, Metal etc.; CI que renderiza cada transicao.
- O que nos falta: catalogo de transicoes (wipe, slide, zoom, blur, glitch...) pronto. Hoje so temos transicoes por track em Canvas2D.
- Peso: arquivos de GLSL; nada de runtime por si.
- Cabe no WebView? Depende de WebGL no WebView Android (nao verificado nesta pesquisa; pesquisa anterior tambem marcou WebGPU como incerto). WebGL 1/2 e mais provavel que WebGPU [I].
- Veredito: **copiar codigo** (os GLSL, com aviso MIT e checagem das duas BSD) **se** adotarmos um passo WebGL para transicoes. Sem WebGL, so ideias. Esforco: M (passo WebGL + testes no aparelho); L se incluir fallback Canvas2D.

**regl** - https://github.com/regl-project/regl
- Licenca: MIT [V]. 5588 estrelas, ultimo push 2026-10-17 [V].
- O que faz: camada funcional sobre WebGL, pequena e madura [V, descricao].
- Veredito: **usar como biblioteca** se o passo WebGL for aprovado. Alternativa: twgl.

**twgl.js** - https://github.com/greggman/twgl.js
- Licenca: MIT [V]. 3025 estrelas, ultimo push 2026-10-19 [V].
- O que faz: "tiny WebGL helper library" [V]. Mais baixo nivel que regl, sem abstracao de estado.
- Veredito: **usar como biblioteca** (alternativa a regl; escolher um dos dois).

**luma.gl** - https://github.com/visgl/luma.gl
- Licenca: MIT [V, arquivo LICENSE bruto]. A API marca NOASSERTION; o arquivo e MIT.
- Atividade: 2486 estrelas, ultimo push 2026-10-23 [V].
- Peso: grande, pensado para visualizacao de dados [I].
- Veredito: **descartar** para o telefone (peso e escopo). Ideias apenas.

**PixiJS** - nao verificado nesta pesquisa (licenca MIT segundo conhecimento geral [I]). Usado pelo openvideo; peso alto para o nosso caso [I]. Veredito: **descartar** por peso, a nao ser que fosse o motor de composicao inteiro.

### 2.3 Timeline (UI)

**wavesurfer.js** - https://github.com/katspaugh/wavesurfer.js
- Licenca: **BSD-3-Clause** [V]. 10449 estrelas, ultimo push 2026-10-23 [V].
- O que faz bem [V, descricao "Audio waveform player"]: desenha forma de onda a partir de picos (`peaks`), com zoom e regioes. Aceita picos precalculados.
- O que nos falta: lacuna direta. Hoje nao temos forma de onda na timeline (pesquisa anterior, item 1).
- Veredito: **usar como biblioteca** so para desenhar; os picos continuam sendo gerados por nos (leitura sequencial de `AudioSampleSink`, como o OCc). Esforco: S/M.

**react-timeline-editor** (`@xzdarcy`) - https://github.com/xzdarcy/react-timeline-editor
- Licenca: **MIT** [V]. 800 estrelas, ultimo push 2026-01-25 [V] (parado ha ~9 meses).
- O que faz: componente React de timeline de animacao, arrastar/redimensionar linhas e cursor [V, descricao].
- Peso: pequeno [I].
- Encaixe: nossa timeline e customizada e tem regras proprias (playhead fixo, gestos de toque). Trocar por esse componente conflitaria com `src/ui/Timeline.tsx`.
- Veredito: **so ideias** (como estrutura de linhas e arrastar). Nao usar como biblioteca.

**vis-timeline** - https://github.com/visjs/vis-timeline
- Licenca: NOASSERTION na API [V]. README indica dupla licenca Apache-2.0/MIT [I]; o arquivo LICENSE-APACHE-2.0 nao foi encontrado no branch develop (404) [V]. Confirmar antes de qualquer uso.
- Atividade: 2569 estrelas, ultimo push 2026-10-22 [V].
- O que faz: timeline generica de itens e intervalos com DOM [V, descricao].
- Encaixe: DOM pesado para milhares de clips, nao e um NLE (sem frame, sem trim com gesto) [I].
- Veredito: **descartar**.

**animation-timeline-js** - nao confirmado: API do GitHub retornou 404 para `ievgennaida/animation-timeline-js` [V]. Busca indica MIT no npm [I].
- Veredito: **so ideias** (controle em canvas para keyframes). Nao adotar sem verificar o repositorio.

### 2.4 Waveform, thumbnails e decodificacao

**peaks.js (BBC)** - https://github.com/bbc/peaks.js
- Licenca: **LGPL-3.0** [V]. 3410 estrelas, ultimo push 2026-10-21 [V].
- Veredito: **so ideias** (LGPL).

**audiowaveform (BBC)** - https://github.com/bbc/audiowaveform
- Licenca: **GPL-3.0** [V]. 2170 estrelas, ultimo push 2025-08-24 [V]. Programa C++ de linha de comando, nao roda no navegador.
- Veredito: **descartar** para codigo. Ideia: formato de picos e resolucao fixa (ja tratado no OCc).

**mp4box.js** - https://github.com/gpac/mp4box.js
- Licenca: **BSD-3-Clause** [V]. 2475 estrelas, ultimo push 2026-10-23 [V].
- O que faz: demux/mux MP4 no navegador (port do MP4Box) [V].
- Encaixe: mediabunny ja faz isso e e o nosso caminho. Util so como plano B para um arquivo que o mediabunny nao abre [I].
- Veredito: **so ideias** (plano B).

**web-demuxer** - https://github.com/bilibili/web-demuxer
- Licenca: **MIT** [V]. 201 estrelas, ultimo push 2025-12-20 [V].
- O que faz: demux em WASM feito para WebCodecs, cobre formatos como MKV/FLV [V, descricao].
- Veredito: **usar como biblioteca** apenas como fallback de formatos que o mediabunny nao abre (checar antes com um arquivo real). Esforco: S.

**Vanilagy/mediabunny** (nosso, referencia) - MPL-2.0 [V], 7364 estrelas, ultimo push 2026-10-22 [V]. Ja usado.

## 3. O que cada achado nao cobre (lacunas nao pesquisadas)

- Editores para mobile (apps ou WebViews Android) de codigo aberto: nao pesquisei separadamente; os achados acima sao de navegador desktop.
- Testes de editor (estrategias de teste end-to-end de timeline): nao pesquisado.
- Licencas de transicoes individuais do gl-transitions (as duas BSD): nao listadas.

## 4. Ranking: o que adotar em seguida (maximo 8)

1. **Estudar omniclip (MIT)** - ler `src/` para timeline, playback e export; comparar com `src/ui/Timeline.tsx` e `src/engine/exporter.ts`. Trechos copiados com aviso MIT. Por que: e o unico editor completo MIT sobre WebCodecs e fornece uma segunda referencia pratica. Esforco: M (leitura e comparacao, sem trocar nada).
2. **wavesurfer.js (BSD-3) para forma de onda** - desenhar picos gerados por nos na timeline. Por que: fecha a lacuna mais visivel da timeline (pesquisa anterior, item 1). Esforco: S/M.
3. **gl-transitions (MIT), GLSL de transicoes** - copiar shaders selecionados com aviso, checando as duas BSD. Por que: catalogo de 100+ transicoes pronto. Exige passo WebGL no WebView (validar no Poco antes). Esforco: M.
4. **regl ou twgl (MIT) para o passo WebGL** - escolher um, so se o item 3 for aprovado. Por que: base pequena e madura para o item 3. Esforco: M.
5. **Spike com diffusionstudio/core (MPL-2.0, sem modificar)** - um clip, um corte, uma transicao; comparar com nosso `composition.ts`/`draw.ts` no Poco (memoria, seek, fluidez). Por que: mesma base tecnica, licenca aceitavel; risco: repositorio parado desde 2025-11. Esforco: M.
6. **web-demuxer (MIT) como fallback de formato** - so se houver arquivo real que o mediabunny nao abre. Por que: cobertura de formatos sem trocar o demuxer principal. Esforco: S.
7. **Spike com WebAV (MIT)** - comparar a API de clip/composicao com a nossa e medir. Por que: segundo SDK WebCodecs MIT; risco: parado desde 2026-01 e produto Pro separado. Esforco: M.
8. **react-timeline-editor (MIT) so como referencia de gestos e linhas** - sem adotar a biblioteca. Por que: ideias para arrastar e redimensionar clips. Esforco: S.

Descartados por licenca ou peso: Remotion, openvideo/designcombo, Twick (licenca nao confirmada), Shotstack Studio (PolyForm Shield), Etro (GPL), peaks.js (LGPL), audiowaveform (GPL), ffmpeg.wasm (nucleo), luma.gl, vis-timeline, PixiJS.

## 5. Fontes principais

- API do GitHub: `https://api.github.com/repos/<dono>/<repo>` para omni-media/omniclip, WebAV-Tech/WebAV, diffusionstudio/core, etro-js/etro, openvideodev/react-video-editor, gl-transitions/gl-transitions, Vanilagy/mediabunny, katspaugh/wavesurfer.js, xzdarcy/react-timeline-editor, gpac/mp4box.js, bilibili/web-demuxer, ffmpegwasm/ffmpeg.wasm, motion-canvas/motion-canvas, mifi/editly, remotion-dev/remotion, greggman/twgl.js, regl-project/regl, bbc/peaks.js, bbc/audiowaveform, visgl/luma.gl, visjs/vis-timeline, shotstack/shotstack-studio-sdk.
- LICENSE brutos: `raw.githubusercontent.com/gl-transitions/gl-transitions/master/LICENSE`, `raw.githubusercontent.com/visgl/luma.gl/master/LICENSE`, `raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md`.
- Paginas: `https://github.com/omni-media/omniclip`, `https://github.com/WebAV-Tech/WebAV`, `https://github.com/diffusionstudio/core`, `https://github.com/openvideodev/react-video-editor`.
- Buscas na web (licenca de Shotstack, nome de repositorio do Twick, e descricoes de projetos): usadas so como indicio [I].

## 6. O que nao foi verificado

- Nenhum codigo-fonte dos projetos foi lido (exceto LICENSE e README); a leitura de `src/` e o primeiro passo recomendado.
- Peso de dependencias e tamanho de bundle: nao medidos.
- Suporte a WebGL no WebView Android do nosso alvo: nao verificado; depende do aparelho.
- Atividade: `pushed_at` nao garante manutencao ativa; issues e PRs nao foram lidos.
