# Arrastar e pular na linha do tempo: diagnóstico e plano

Escrito em 2026-11-04. Nada daqui está implementado ainda. Celular de teste: Samsung A11 (SM-A115M, serial `R9QN708EGRB`), Android 10, só 32 bits (`armeabi-v7a`), 2,9 GB de memória, sem giroscópio.

## O que o dono quer

Pular e arrastar na linha do tempo com a sensação do CapCut, mesmo no A11. O critério é "isso é aceitável num app profissional?", não a comparação com versões antigas.

## O que já foi decidido

- **Não trocar o motor por nativo.** O dono já testou o Media3 semanas atrás: o WebView usou mais memória, mas foi mais estável, e o Media3 foi muito instável.
- **WebAssembly não resolve o salto.** O app já decodifica por hardware (WebCodecs, confirmado no A11). WASM trocaria isso pelo processador. Só vale para formatos sem suporte, como o áudio AMR.
- **Multithread não acelera o salto**, porque a espera é pelo decodificador. Ajudaria a gerar miniaturas e reserva em segundo plano. Levar o desenho para um Worker só se a medição do arraste mostrar disputa na thread principal. Em `file://` não há `SharedArrayBuffer`.

## Medições no A11

Com a build `b9ac3bf`, celular quente (cerca de 39 °C) e com cerca de 20% de bateria.

| O quê | Valor | Meta (bom / aceitável) |
|---|---|---|
| Velocidade tocando | 1,00; 2 e 3 camadas 0,99, sem quadro atrasado | 1,00 / 0,98 |
| Espera depois do play | cerca de 0,4 s (1,2 s no primeiro play após abrir) | 0,2 / 0,5 s |
| Pior travada | cerca de 70 ms (480 ms no primeiro play) | 50 / 150 ms |
| Pular | 0,15 a 0,35 s | 0,1 / 0,3 s |
| Desenhar um quadro | menos de 5 ms (15 ms com rosto) | não é o gargalo |
| Thread principal tocando | 37% ociosa, 3 tarefas longas em 10 s, até 132 ms | não é o gargalo |

Ainda não medido: o arraste em si, e o salto dividido por etapas. A suspeita de que o gargalo é a decodificação vem da leitura do código e precisa dessa medição.

Armadilha: `uiautomator dump` bloqueia o aparelho e dá falsa lentidão, e ler a tela a cada quadro (`getImageData`) também. Medir com `pm.startTrace()` e `pm.stopTrace()`.

## Problemas no nosso caminho do salto

Em `video-editor-web/src/engine/player.ts` e `feed.ts`:

1. Só existe "quadro exato": todo movimento do dedo pede o trabalho completo.
2. `feed.seek` chama `releaseAll()`: joga fora a fila decodificada, mesmo se o quadro estiver nela.
3. Nada fica guardado depois de mostrado.
4. Pedido novo espera o anterior (`await this.busy`), sem cancelar.
5. `runStills` espera todas as camadas (`Promise.all`): a mais lenta atrasa a imagem.
6. A cópia leve tem um quadro completo por segundo (`PROXY_KEYFRAME_SECONDS`): até uns 30 quadros por salto.
7. As miniaturas já geradas para a linha do tempo não são usadas pela prévia.

## O que os projetos de referência fazem

Os dois têm licença MIT. Sobre o CapCut, não há fonte técnica pública encontrada.

**OpenReel** (`Augani/openreel-video`), a referência web anotada em `docs/foundation-plan.md`:
- Usa a mesma biblioteca que nós, mas, em `Preview.tsx`, tem um `<video>` escondido por arquivo para miniaturas e arraste, com `currentTime`, `seeked` e `requestVideoFrameCallback`. O comentário diz que é bem mais confiável que o `CanvasSink` da MediaBunny para busca aleatória.
- Modo de arrastar separado (`startScrubbing`, `scrubTo`, `endScrubbing` em `playback-bridge.ts`): move a interface na hora e sincroniza o motor uma vez ao soltar.
- Cancela decodificações velhas por número de pedido, com uma pequena espera (`cancelPendingScrubDecode`).
- Guarda o último quadro bom (`lastGoodFrameRef`), para nunca mostrar tela vazia.
- Reserva de até 100 quadros, com configuração de 30 à frente e 10 atrás (`packages/core/src/video/frame-cache.ts`).

**WebAV** (`WebAV-Tech/WebAV`), `packages/av-cliper/src/clips/mp4-clip.ts`, código comentado em chinês. O dono lembrava de "um app chinês": confirmar se é este.
- Mantém um decodificador aberto. Só recomeça ao voltar no tempo ou pular mais de 3 s.
- Abandona o pedido anterior quando chega outro.
- Mantém uns 10 quadros decodificados à frente.
- Miniaturas têm decodificador próprio.

## Onde podemos estar errando em relação a eles

Lido no código em 2026-11-04, sem medir ainda.

**1. Um decodificador novo a cada salto. É a suspeita principal.** `feed.seek` chama `sink.getSample`, e na MediaBunny 1.61 isso passa por `mediaSamplesAtTimestamps`, que cria um decodificador, decodifica desde o último quadro completo, faz `flush` e fecha, a cada chamada. Decodificador de hardware no Android pode custar caro para abrir. O WebAV deixa o seu aberto e só recria ao voltar ou pular mais de 3 s. O OpenReel, no caminho com `<video>`, deixa até dois abertos e só muda `currentTime`; quanto o navegador reaproveita por dentro não foi verificado.

**2. Sem `optimizeForLatency`.** O nosso `VideoSampleSink` é criado sem opções de decodificador, se a leitura de `media.ts` estiver certa. Sem isso, o decodificador pode segurar vários quadros antes de entregar o primeiro. A MediaBunny aceita a opção, e nenhum dos dois repositórios foi visto usando, então é uma ideia nossa a medir.

**3. Sem espera antes de decodificar.** O OpenReel espera cerca de 50 ms e, se chegou pedido novo, nem começa. O nosso começa todo pedido.

**4. Fila curta.** Guardamos até 2 quadros à frente; o WebAV, uns 10. Fila maior usa mais memória, então precisa de medida no A11.

**5. Sem qualidade de prévia à escolha.** O OpenReel oferece automático, cheia, metade e um quarto. O nosso agora escolhe pela memória do aparelho, sem opção para o usuário.

**O que nós fazemos bem e eles não:** não fechamos o quadro em tela ao recomeçar, juntamos pedidos (`stillWanted`) e o relógio segue o som. O OpenReel tem timeouts fixos de 250 e 300 ms nesse caminho, o que pode dar quadro errado em celular lento: não copiar sem cuidado.

**Medição a fazer primeiro:** dividir o tempo do salto em abrir o decodificador, demultiplexar, decodificar e desenhar, e comparar `getSample`, um decodificador mantido aberto, e `<video>`.

## Plano, na ordem

Cada passo é medido no A11 antes e depois, incluindo a memória.

1. **Modo de arrastar:** interface na hora, pedidos velhos cancelados, último quadro bom na tela. Exato só ao soltar. Registrar as tarefas longas durante o arraste.
2. **Experimento de decodificador:** medir o salto com `getSample` (hoje), com um decodificador mantido aberto, com `optimizeForLatency` e com `<video>`, na cópia leve. O resultado do OpenReel no computador não garante o mesmo no A11.
3. **Saltos curtos para a frente sem recomeçar**, e sem jogar a fila fora.
4. **Reserva de quadros perto do cursor**, bem menor que a do OpenReel, e liberada quando a memória apertar. O app já chegou a 534 MB no A11.
5. **Miniaturas enquanto arrasta**, geradas em segundo plano.

Se ainda faltar: cópia leve com mais quadros completos. Testar antes: um relato de 2013 no fórum da Qualcomm conta que um arquivo só com quadros completos não tocou num Samsung com Snapdragon, e um a cada dois funcionou. O A11 também é Snapdragon. O arquivo fica maior, e a cópia demora mais para criar.

Limite esperado: o quadro exato dificilmente será instantâneo nesse hardware. O objetivo é a imagem responder ao dedo na hora. Vale comparar com o CapCut no próprio A11, se o dono instalar, para saber o alvo real.

## Regras para o A11

O celular é pessoal do dono: instalar por cima pode, apagar nada dele, não abrir a galeria nem o seletor de fotos, não dar permissões, não fazer login, não mudar configuração do sistema. Build para ele: `./gradlew.bat assembleRelease -PreactNativeArchitectures=armeabi-v7a` em `C:\ve`.

## Fontes

- OpenReel: [Preview.tsx](https://github.com/Augani/openreel-video/blob/main/apps/web/src/components/editor/Preview.tsx), [frame-cache.ts](https://github.com/Augani/openreel-video/blob/main/packages/core/src/video/frame-cache.ts), [playback-bridge.ts](https://github.com/Augani/openreel-video/blob/main/apps/web/src/bridges/playback-bridge.ts)
- WebAV: [mp4-clip.ts](https://github.com/WebAV-Tech/WebAV/blob/main/packages/av-cliper/src/clips/mp4-clip.ts)
- [Fórum da Qualcomm sobre scrubbing no Android](https://developer.qualcomm.com/forum/qdn-forums/mobile-technologies/multimedia-optimization-hexagon-sdk/video/27161) (2013, relato de uma pessoa)
- [Artigo sobre motor de edição mobile](https://dev.to/beefedai/memory-safe-mobile-video-editing-engine-timeline-design-optimizations-4em0) (fonte secundária, não verificada)
