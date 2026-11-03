# Como melhorar o PixelMorph: revisão de 03/11/2026

Revisão só de leitura: nenhum código foi alterado e nada foi rodado em emulador ou celular.

Legenda de confiança:
- **conferido**: li o caminho no código depois da análise.
- **lido**: um revisor leu o código, mas não conferi de novo.
- **a medir**: depende de aparelho.

Esforço: P (pequeno), M (médio), G (grande).

## Ordem recomendada

1. Corrigir os bugs das camadas (bloco 1) e só depois commitar.
2. Proteger os dados do usuário (bloco 2).
3. Fazer o pacote pequeno de segurança (bloco 3).
4. Tirar o que é falso das telas e limpar o que está morto (blocos 4 e 5).
5. Novos recursos (bloco 6): keyframes, borracha e cor do vídeo primeiro; IA depois.

## 1. Bugs nas camadas (ainda sem commit)

| # | Gravidade | Problema | Cenário | Correção | Confiança |
|---|---|---|---|---|---|
| 1 | Perda de dados | Passos de camada expulsam os ajustes do histórico, e o histórico é o único lugar onde os ajustes são salvos | Ajustar exposição, pintar 200 traços, reabrir: ajustes perdidos. Mais de 200 ajustes já causavam o mesmo antes das camadas | Salvar `saved.adjustments` no app (`PhotoEditorWebScreen.tsx:140`, `session.ts:355`) | conferido |
| 2 | Resultado errado | Texto salvo muda de lugar: a referência vertical passou de `alphabetic` para `middle` | Reabrir projeto antigo com texto ou meme: o texto desce cerca de 0,35 da altura da fonte, na prévia e no export | Marcar o formato novo e converter o `y` antigo uma vez (`scene.ts:237`) | conferido |
| 3 | Resultado errado | Tamanho e centro saltam em 45° no giro livre | Clipe 16:9 em tela cheia: 1920 de largura a 44°, 1080 a 46° | Encaixar pela caixa girada (cos/sen) (`draw.ts:47`) | conferido |
| 4 | Resultado errado | Texto ou foto novos podem ficar sob um vídeo | V1 de 0 a 5 s, V2 de 6 a 10 s, texto em 5,5 s vai para V1 e fica coberto a partir de 6 s | Só aceitar faixas acima da última ocupada naquele trecho (`placement.ts:35`) | conferido |
| 5 | Interface | Caixa da prévia funciona durante o play | O som reinicia a cada movimento. Se o clipe acaba durante o arraste, o gesto fica preso e a edição seguinte pode voltar a linha do tempo | `session.pause()` no início do gesto (`PreviewHandles.tsx:56`) | conferido |
| 6 | Interface | Faixa travada ainda pode ser editada | Girar, excluir, duplicar, sliders, excluir faixa; vídeo novo entra em V1 travada; texto e forma travados mudam pelo formulário | Checar a trava em `withSelected`, excluir, duplicar, `mainTrack` e nos rascunhos | lido |
| 7 | Interface | Desviar um pouco para a faixa de áudio cancela o arraste do clipe | Arrastar em V1 passando por A1: o clipe volta ao lugar original | Se o destino for recusado, mover na própria faixa (`Timeline.tsx:277`) | lido |
| 8 | Interface | Pinça sobre a caixa da foto move a camada em vez de dar zoom | Dois dedos sobre uma imagem grande selecionada | Guardar `pointerId` e passar o segundo dedo para o zoom (`PhotoView.tsx:436`) | lido |
| 9 | Interface | Primeiro arraste de clipe em "Preencher" salta | Vídeo 9:16 preenchendo tela 16:9 | Calcular a altura pelo formato real da imagem (`PreviewHandles.tsx:107`) | lido |
| 10 | Menor | Reordenar faixas de áudio está invertido | Com A1 e A2, ▲ desce a faixa e arrastar não faz nada | Inverter os passos nas faixas de áudio (`Timeline.tsx:227`) | lido |
| 11 | Menor | Máquina de escrever desliza com texto alinhado à esquerda ou direita | A largura é medida no texto parcial | Medir o texto inteiro (`draw.ts:120`) | lido |
| 12 | Possível travamento | Export de foto decodifica cada camada em 4096 px, mesmo as pequenas | Cinco camadas somam cerca de 300 MB num celular fraco | Carregar no tamanho que a camada usa (`session.ts:463`) | a medir |
| 13 | Possível | Alça de reordenar pode perder o dedo ao descer | O React reinsere a linha e a captura se perde | Capturar em `.layer-list` | a medir |
| 14 | Possível | Linha fixa da lista pode transbordar com fonte grande do sistema | Linha com prazo a partir de 1,3× | `maxFontSizeMultiplier` (`ProjectCard.tsx:294`) | a medir |

## 2. Proteção dos dados

Reclamações comuns em outros editores: travar ao salvar, projeto que não abre mais depois de um crash, e autosave que não salva nada.

| Problema | Cenário | Correção | Esforço | Confiança |
|---|---|---|---|---|
| Fechar o editor não força o salvamento | O salvamento espera 400 ms; editar e sair logo perde a última edição. Não há aviso de `pagehide` nem o botão Voltar do Android força a gravação | Gravar antes de `close` e em `pagehide` | P | conferido |
| `timeline.json` é sobrescrito direto | App morto no meio da gravação deixa um JSON quebrado e o projeto não abre | Gravar em temporário, mover e guardar um `.bak` (`VideoEditorWebScreen.tsx:152`) | P | conferido |
| Limite de 6 MB no AsyncStorage | O log pode ocupar até 5 MB do mesmo banco; ao encher, tudo para de salvar | Aumentar `AsyncStorage_db_size_in_MB`, reduzir o log para cerca de 512 KB | P | conferido |
| Falha ao salvar é invisível | Disco cheio: o usuário continua editando e perde tudo | Faixa "não salvo" e nova tentativa | P | lido |
| Edições de vídeo não sincronizam | Só as chaves do AsyncStorage sobem; `timeline.json` fica de fora e a sync diz "Tudo em dia" | Incluir a timeline como blob do projeto (`LocalProjectData.ts:32`) | M | conferido |
| Camadas grandes podem travar o projeto | Valor acima de cerca de 2 MB falha ao ler e o editor não abre | Reutilizar o gravador em partes do histórico e tratar o erro | P | a medir |
| Mídia apagada só aparece no export | O editor abre pela cópia leve | Checar o original ao abrir e oferecer religar | P | lido |
| WebView morta deixa tela em branco | Falta de memória num vídeo grande | `onRenderProcessGone`: registrar, recarregar, avisar | P | lido |
| Disco vaza | Exports em cache, versões antigas de bake, `imports/`, `media/cloud/` | Apagar depois do uso e varrer o resto | M | lido |

## 3. Segurança

| Problema | Cenário | Correção | Esforço | Confiança |
|---|---|---|---|---|
| Qualquer link troca a conta | Um link `pixelmorph://auth-callback#access_token=...` entra na conta do atacante e a próxima sync envia os projetos para lá | Exigir fluxo pendente ou confirmação antes de `setSession` (`SupabaseAuthGateway.ts:67`) | P | conferido |
| Sync envia qualquer `file://` recebido | Um payload baixado pode apontar para arquivos privados do app | Limitar ao `documentDirectory` (`SyncProjectsUseCase.ts:414`) | P | lido |
| Depuração da WebView ligada no release, com acesso amplo a arquivos | Com USB autorizado dá para ler qualquer arquivo; usei isso ontem no emulador. Não achei forma de injetar código hoje | Ligar a depuração só por flag de build. Restringir navegação e caminhos no host, e adicionar CSP. Depois, migrar para `WebViewAssetLoader` | P a M | conferido |
| Release assinado com a chave de debug que está no repositório | Quem tem a chave instala outro APK por cima e lê os dados | Chave própria. **Exige desinstalar no celular, o que apaga os projetos locais: decisão sua** | P | conferido |
| Backup e permissão amplos | `allowBackup` inclui tokens e mídia; `SYSTEM_ALERT_WINDOW` sobrando | Desligar ou excluir do backup; bloquear a permissão | P | parte conferida |
| Projeto apagado continua na nuvem | Só marca `deleted_at`; o payload e os arquivos ficam e a cota enche | Limpar o payload e apagar os arquivos | M | lido |
| Supabase sem limite por usuário | Uma conta confirmada enche o banco gratuito | Limites por trigger | P | lido |
| Servidor de mídia aceita conexões lentas | Sem autenticar, mantém sockets abertos; token ruim sempre consulta o Supabase | Fechar no 401, limitar conexões e cachear recusas | P | lido |
| URL do servidor fixa no build | O ngrok grátis muda de endereço e exige novo APK | Domínio reservado ou configuração em tempo de execução; só HTTPS fora do dev | P | lido |

Os caminhos de arquivo do servidor e a regra RLS por usuário foram lidos e estão certos.

## 4. Telas falsas (as regras do projeto proíbem dados falsos em produção)

- **Presets** (acessível pelo Explorar): seis presets inventados, botão "Novo preset" sem ação. Ligar a `listPresets` ou tirar a rota. Conferido.
- **Tutoriais**: ensina máscaras e "Remover objeto com IA", que não existem no editor. Esconder ou reescrever. Conferido.
- **Comunidade**: sem entrada no app, com usuários falsos. Apagar. Lido.
- Versão "2.4.1" fixa na tela de Conta, enquanto o app é 0.1.0. `SPRINT_2_STATUS.md` desatualizado. Lido.
- **Sem acessibilidade e tradução completas:** componentes de `core/ui` e controles da câmera sem rótulos para o TalkBack; Câmera, RAW, Ajuda e outras telas sem tradução. Lido.

## 5. Limpeza e tamanho do APK

- Cerca de 4.500 linhas mortas em `src/modules/video-editor` e `src/modules/photo-editor`, mantidas vivas por cerca de 30 testes. Lido.
- Dependências sem uso: `@expo/dom-webview`, `reanimated-color-picker` (conferidas), `mediabunny` na raiz (lido).
- `logcat.txt` (14 MB), `monkey_logs.txt` e `FILETREE.txt` versionados. Conferido.
- APK arm64 de 61,9 MB: R8 e shrink desligados; o scanner de código de barras sem uso custa 5,8 MB. Exigem novo teste completo de release. Lido.

## 6. Recursos novos, pela pesquisa

### Editores: o que falta perto dos concorrentes

| Recurso | Por quê | Como | Esforço |
|---|---|---|---|
| Keyframes de posição, escala, giro e opacidade | Premiere mobile e PowerDirector têm; é o próximo passo natural das camadas | `sampleKeyframes` já existe em `webScene.ts`; aplicar em `mediaOp` | M |
| Borracha e travar transparência (foto) | O ibis Paint tem travar transparência; hoje um traço só sai desfazendo ou apagando a camada | Traço com `destination-out`; as camadas já desenham em buffer quando preciso | P |
| Tocar na foto ou na prévia para selecionar a camada | Hoje só se seleciona pela lista ou pela timeline | Teste de clique com `layerBox` e `boxOf` | P |
| Cor no vídeo: contraste, saturação, temperatura | Hoje só há brilho | `ctx.filter` já é usado em `draw.ts` | P |
| Máscaras, clonagem e liquify (US-06 e US-07) | Só existem os modelos, sem nenhuma tela | Pintar máscara reaproveita as camadas; liquify precisa de shader | G |
| Pastas de camadas, 27 modos de mesclagem, curva de velocidade, chroma key | Nível ibis, VN e PowerDirector | Depois dos anteriores; chroma key exige WebGL | M a G |

**Posicionamento possível:** as reclamações mais citadas do CapCut são recursos que viraram pagos e a mudança nos termos de uso. Um editor offline, sem marca d'água e com os arquivos no aparelho responde a isso.

### IA (Sprint 3): o que escolher

| Story | Recomendação | Dados | A validar |
|---|---|---|---|
| US-24 remover fundo | **ML Kit Subject Segmentation** pelo lado nativo; o resultado vira uma camada de imagem | Cerca de 200 KB no APK, modelo via Play services, API 24+, ainda em beta. Alternativas web: rembg com 40 a 50 MB; selfie multiclass com 16 MB, só pessoas | Precisa de Google Play services e o beta pode mudar |
| US-24 remover objeto | Começar por um preenchimento clássico sem modelo, e usar LaMa só se ficar ruim | LaMa quantizado: 37 MB, 512×512, cerca de 0,9 s num M1 com WebGPU | Se a WebView do Poco tem `navigator.gpu`; não achei documentação |
| US-29 legendas | **whisper.cpp** multilíngue, com modelo baixado sob demanda, fora do APK | tiny: 75 MiB e cerca de 273 MB de memória; base: 142 MiB e cerca de 388 MB | Velocidade e qualidade em português no Poco; não achei números |

### Desempenho

- **Não mover o desenho para um worker agora.** O Chrome recomenda esse caminho, mas o emulador tocou 4 vídeos sem atraso. Medir no Poco primeiro.
- **Limite de decodificadores:** o `liveLayerCap` usa a memória do aparelho, mas o limite real é de instâncias de decodificador. O Android exige 6 sessões em 720p em certas classes de desempenho (2 quando o aparelho tem VP9). Falta reduzir o limite sozinho quando um decodificador falhar, em vez de mostrar erro.

## Fontes

- [ML Kit Subject Segmentation](https://developers.google.com/ml-kit/vision/subject-segmentation/android)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
- [LaMa quantizado](https://huggingface.co/othytenk/lama-int4-int8)
- [rembg-webgpu](https://cdn.jsdelivr.net/npm/rembg-webgpu@0.2.1/README.md)
- [Selfie multiclass](https://pub.dev/documentation/face_detection_tflite/latest/face_detection_tflite_native/SelfieSegmentation-class.html)
- [WebGPU no Chrome para Android](https://developer.chrome.google.cn/blog/new-in-webgpu-121?hl=ja)
- [Conteúdo local em WebView](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [OWASP MASTG: WebView](https://mas.owasp.org/MASTG/best-practices/MASTG-BEST-0011/)
- [Limites do AsyncStorage](https://react-native-async-storage.github.io/async-storage/docs/limits)
- [WebCodecs no Chrome](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs?authuser=7)
- [Classe de desempenho do Android 17](https://source.android.com/docs/compatibility/17/mpc)
- [Keyframes no Premiere mobile](https://helpx.adobe.com/premiere/mobile/clip-effects-and-fill/keyframes-overview.html)
- [PowerDirector, notas de versão](https://www.apkmirror.com/?p=1262518)
- [Tutoriais do ibis Paint](https://ibispaint.com/lecture/index.jsp?no=23)
- [Avaliações do CapCut](https://www.eesel.ai/blog/capcut-reviews)
- [Alternativas ao CapCut](https://eesel.ai/blog/capcut-alternatives)
- [Express: projeto que não abre depois de um crash](https://community.adobe.com/bug-reports-328/when-i-hit-auto-enhance-button-for-an-image-in-express-mobile-app-on-android-it-crashes-that-app-and-i-can-t-go-back-to-the-same-project-1552150)
- [Lightroom: crashes no Android](https://community.adobe.com/questions-680/crashing-907983)
