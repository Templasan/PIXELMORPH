# Arrastar e pular na linha do tempo: diagnóstico e plano

Escrito em 2026-11-04. Nada daqui está implementado ainda. Celular de teste: Samsung A11 (SM-A115M, serial `R9QN708EGRB`), Android 10, só 32 bits (`armeabi-v7a`), 2,9 GB de memória, sem giroscópio.

## Estado em 2026-11-04

Feito: reserva de quadros em segundo plano (`engine/scrubFrames.ts`, `domain/scrubPlan.ts`). Um salto mostra na hora o quadro mais próximo da memória, e o exato vem 90 ms depois de o dedo parar.

Medido no A11, quente, num clipe de 24,5 s: cada salto custa cerca de 1 ms (pior 6 ms), 60 de 60 desenhados, antes cerca de 300 ms até a imagem mudar. O quadro exato chega em cerca de 360 ms depois de parar. A reserva tem 25 quadros, 5,5 MB, e fica pronta em cerca de 6,5 s se ninguém mexer.

Limites: o quadro aproximado vem de até meio segundo antes ou depois, com 180 px no lado menor, então fica borrado e um pouco fora de lugar até o exato chegar. Até a reserva ficar pronta, e num clipe recém-importado, o salto é como antes. Enquanto se arrasta, a reserva não avança.

Testado e descartado: a tag `<video>` no A11: abrir levou mais de 6 s e o quadro veio em cerca de 600 ms, contra cerca de 300 ms no nosso caminho.

Achado: arrastar enquanto a reserva era feita dava "Decoding error.", porque o A11 tem poucos decodificadores de hardware. Agora a reserva e as miniaturas soltam o decodificador por 1,5 s depois de cada salto, e o quadro exato tenta de novo antes de mostrar erro.

Tocar logo depois de arrastar, com 3 camadas, no emulador (só vale para a lógica): o tempo começa em 0,3 a 1,5 s, antes 1,6 a 2,8 s. O quadro da reserva já conta como imagem pronta, e só um quadro exato em andamento é esperado. Testado e descartado: não esperar esse quadro. O relógio saía em 0,1 s, mas a imagem ficava congelada por uns 2 s, porque os decodificadores corriam atrás do tempo. Falta medir no A11.

Falta sentir na mão, e medir com várias camadas e com clipes longos.

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
2. **Experimento de decodificador:** medir o salto com `getSample` (hoje), com um decodificador mantido aberto e com `optimizeForLatency`, na cópia leve. Serve para o quadro exato chegar mais rápido. `<video>` já foi testado e descartado.
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

## Exportar foto

Foto de 13 MP. Trocar `toBlob` por `toDataURL` foi testado e desfeito: no emulador deu 4,2 s contra 0,13 s, mas no A11 `toBlob` levou 1,25 s com a tela travada 0,5 s, e `toDataURL` 1,45 s com 1,4 s travada. **Número de emulador não decide isso.**

No A11, exportação de 12 s: abrir a foto 2,4 s, GPU 0,4 s, desenhar a cena 2,5 s, codificar 1,8 s, salvar de 4,6 a 8,3 s. A galeria e a ponte, medidas à parte com uma imagem do mesmo tamanho, levam menos de 0,6 s, então a causa da etapa de salvar ainda está aberta. Um `dex2oat` de outro app usava de 3 a 5 núcleos durante essas medições, o que infla os números.

## Trocar abas no editor de fotos

Sem causa demonstrada, nada mudou. No emulador, cada aba desenha em cerca de 32 ms (dois quadros) e o clique custa até 1 ms de JavaScript. A exceção é Sugestões, com 54 a 133 ms e tarefas longas de cerca de 120 ms; a análise da foto no painel é a suspeita, sem confirmação. O A11 marcou de 44 a 50% de quadros atrasados com `gfxinfo`, mas em poucos quadros (16 a 18), e esse número pode não representar o desenho dentro do WebView. Medir no A11 pelo mesmo caminho do emulador antes de mexer.
