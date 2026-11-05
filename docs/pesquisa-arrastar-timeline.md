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

## Vídeos pesados no A11

Medido em 2026-11-04, com arquivos em `/sdcard/Movies/pm_test_*`, que ficam no celular para os próximos testes. Fora da pasta do app não há cópia leve, então os primeiros mostram como é sem ela. Essa é a situação de um vídeo recém-importado, até a cópia ficar pronta.

| Arquivo, sem cópia leve | Quadro exato | Tocando |
|---|---|---|
| 1080p, 60 s, um quadro completo a cada 6 s | 3,6 s | 1,00, começa em 0,5 s |
| 1080p, 60 s, só quadros completos | 0,6 s | 1,00, começa em 0,5 s |
| 1080p em pé, 120 s, um a cada 6 s | 8,9 s | 0,99, começa em 2,5 s |
| 4K, 60 s | não terminou | não chegou a tocar |

Cópia em 540×960, 120 s, 3 Mbps, 44 MB em todas:

| Quadro completo a cada | Quadro exato | Reserva pronta em |
|---|---|---|
| 30 quadros (o que era) | 315 ms | 23 s |
| **10 quadros (o que ficou, em celular fraco)** | **219 ms** | **13 s** |
| 3 quadros | 167 ms | 9 s |

Em todas: arrastar custa cerca de 1 ms por salto, velocidade 1,00 ou 0,99, sem erro. A qualidade visual a 3 Mbps com quadros completos mais frequentes não foi avaliada, mas é só prévia; o vídeo final usa o original.

- **`optimizeForLatency`: testado, sem ganho.** 317 a 385 ms contra 315, e 222 a 227 contra 219. Fica de fora.
- **Durante os saltos exatos sem cópia leve apareceu "Decoding error."** Esse teste não passa por `session.seek`, então a reserva não se afasta. Pelo uso real com a cópia, em 3 rodadas, nenhum erro.
- **Ainda não testado:** a cópia nova gerada de verdade pelo app. As da tabela foram feitas com ffmpeg, com os mesmos parâmetros.

## Cópia leve gerada pelo próprio app, no A11 (2026-11-04)

Antes o hardware só aceitava até 1920×1440 e o Media3 não tentava software: a cópia de 4K falhava na hora, sem aviso. Agora usa `setEnableDecoderFallback(true)`.

| Vídeo | Cópia pronta em | Arrastar | Quadro exato | Tocar |
|---|---|---|---|---|
| 1080p em pé, 120 s | 71 s | 0,5 ms | 209 ms (340 a 560 ms com a reserva em andamento; 3,4 s no primeiro salto ao abrir) | 0,99, começa em 0,5 a 0,6 s |
| 4K, 60 s | 244 a 256 s | 1,2 ms | 231 ms | 0,98 a 0,99, começa em 0,5 s |

A cópia do app empatou com a do ffmpeg (209 contra 216 ms), com quadro completo a cada 10.

Tocar logo depois de arrastar, 3 camadas, celular a 38,5 °C: começa em 0,8 a 1,0 s, velocidade 0,91 a 0,98, pior travada 50 a 117 ms. Ainda abaixo da meta em início e velocidade.

Achados: miniaturas liam o original mesmo com cópia pronta, o que tirava o decodificador de hardware da prévia (erro -12). Agora leem a cópia. A página não decodifica 4K no A11, então a exportação falhava: agora refaz a partir de uma cópia 1080p, que é o máximo do codificador desse celular. A estabilização sumia com cópia em uso, porque buscava o movimento pelo arquivo da cópia.

## Ideia do dono para vídeos longos: picotar com prévia em blur

Mostrar na hora um blur do vídeo inteiro (a reserva já é isso), gerar a cópia em pedaços, começando por onde a pessoa está, e trocar o blur pela imagem boa conforme chegam. Ganha espera e não perder tudo se o sistema matar o app; não ganha tempo total, porque o A11 recusa mais decodificadores de hardware. O custo é a prévia saber qual arquivo cobre cada instante.

Ordem combinada: (1) reserva durante a cópia, em arquivos que a página decodifica; (2) testar um vídeo de 30 minutos no A11. Projeção sem medir: 18 min de cópia em 1080p; (3) só então os pedaços, se a espera incomodar ou o app morrer no meio.

## Hipóteses de velocidade testadas no A11 (2026-11-04, noite)

| Hipótese | Resultado | Decisão |
|---|---|---|
| Prioridade e velocidade máxima do codec, cópia sem áudio | 16,2 s para 30 s de vídeo em todas | Sem ganho, fora |
| A cópia em 1080p tem limite físico | 55 quadros/s; o aparelho declara 489.600 blocos/s, ou 1080p a 60 | Confirmado: cópia não acelera |
| Saída menor (360p) | 24 s contra 16 s | Sem ganho, fora |
| Pedaços em paralelo | O decodificador recusa o segundo, e o pedaço restante não acelera | Fora |
| Quadro exato lento durante a cópia | Os 6,9 s vinham do vídeo de teste, com quadro completo a cada ~6 s. Com um por segundo: 248 ms de mediana (pior 1,2 s), toca a 1,00 | Sem mudança. Falta conferir um vídeo real da câmera |
| Buffer de áudio maior (latencyHint) | Velocidade igual, cerca de 0,87 | Fora |
| Um nó de som por trecho de 20 ms atrasa o relógio | Em blocos de 0,5 s, com 3 camadas: começa em 0,38 a 0,44 s e estabiliza em 1,00 (0,97 no total) | Adotado |
| Duas cópias no 4K | Uma de 1080p serve à prévia e à exportação: 278 ms, toca a 1,00; exportação de 418 s para 183 s depois da cópia | Adotado |
| MP4 fragmentado, legível enquanto é escrito | Primeira imagem do 4K em 32 s, em vez de ~4 min; toca até onde a cópia chegou | Adotado só acima de 1080p |
| Cópia de 540p feita a partir da de 1080p | Não foi gerada; a causa provável é o arquivo fragmentado não informar duração (não confirmada). A de 1080p já bastava | Retirado |
| Importar copia o arquivo duas vezes | Mover a cópia do seletor: 30 min de 63 s para 16 s | Adotado |

Medidas finais: cópia de 1080p de 30 min em cerca de 12 min 40 s, com o app aberto até o fim; de 2 min em 68 s. 4K de 1 min em 244 a 256 s. Vídeo tipo câmera de 60 s: importa em 7 s; durante a cópia, arrastar 0,1 ms e quadro exato de 180 a 991 ms; o app em segundo plano por 25 s não matou a cópia; depois dela, 107 a 154 ms; exportação em 1080×1920 em 211 s.

Pendente: se o sistema matar o app, a cópia recomeça do zero. Várias camadas de 4K ao mesmo tempo não foram testadas, e cada uma usa uma cópia de 1080p; o hardware decodifica o equivalente a duas a 30 quadros/s. Estalo ao dar play ou pausa: resolvido e confirmado de ouvido pelo dono no A11. O fade de 12 ms sozinho não bastou; o som parou ao manter a saída de áudio ligada durante a pausa, por 30 s.

## Comparativo A11 × Poco (2026-11-04)

Poco (modelo 24095PCADG), Android 16, 8 GB, arm64. O A11 está no modo de celular fraco (cópia de 540p, ou de 1080p acima de 1080p). O Poco usa a cópia de 720p. O A11 foi medido antes das duas últimas mudanças (cópia não passa da taxa do original, aviso de importação depois do seletor).

| Medida | A11 | Poco |
|---|---|---|
| Importar 30 min (466 MB) | 16 s | 6 a 8 s |
| Cópia, 1080p de 2 min | 68 s | não medida com relógio limpo |
| Cópia, 1080p de 30 min | 12 min 40 s | 3 min 37 s |
| Cópia, 4K de 1 min | 244 a 256 s | 51 s |
| Quadro exato, vídeo tipo câmera, durante a cópia | 180 a 991 ms | 153 a 218 ms |
| Quadro exato, vídeo tipo câmera, depois da cópia | 107 a 154 ms | 185 ms de mediana |
| Quadro exato, 30 min | 215 ms | 225 ms |
| Quadro exato, 4K | 278 ms | 223 ms |
| Arrastar | 0,1 a 1,5 ms | 0,4 a 1,4 ms |
| Tocar, 3 camadas: início | 0,31 a 0,49 s | 0,27 a 0,45 s |
| Tocar, 3 camadas: velocidade estável | 1,00 | 1,00 |
| Exportar 60 s em 1080×1920 | 211 s | 39 s |
| Exportar 4K de 60 s em 720p | 183 s, mais a cópia | 35 s |

Achados no Poco: a cópia de 720p a 5 Mbps tinha 1,14 GB para um original de 466 MB, e acima de 1 GB a página lê em pedaços pela ponte. Com a taxa limitada: 576 MB, quadro exato de cerca de 680 ms para 225 ms, reserva de 251 s para 45 s. Quadros completos 3 vezes por segundo em toda cópia. O aviso de importação desenhava 120 quadros por segundo atrás do seletor (110% de CPU, agora cerca de 15%); a AppState não muda ali, porque o seletor é translúcido. Pedaços em paralelo funcionam no Poco, mas não compensam: 1080p 6,0 s contra 7,3 s; 4K 9,2 a 11 s contra 8,1 s.

Em `file://` o Android 16 não deixa a página ler `/sdcard/Movies`, então os testes de 3 camadas no Poco usaram o arquivo do projeto, três vezes.
