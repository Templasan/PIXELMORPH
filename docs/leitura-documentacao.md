# O que as documentações dizem, comparado com o nosso código

Lido e conferido em 2026-11-04. Nada daqui foi implementado ainda. Só foram lidas as páginas listadas em "Fontes", não as documentações inteiras.

## Estamos fazendo diferente do recomendado

| # | A documentação diz | O nosso código | Prioridade |
|---|---|---|---|
| 1 | react-native-webview: `onRenderProcessGone` avisa quando "o processo do WebView trava ou é morto pelo sistema", para recuperar | Feito em `useEditorRecovery`: reabre o editor uma vez e avisa; se morrer de novo em 30 s, volta aos projetos | Feito |
| 2 | react-native-webview: `injectedJavaScriptBeforeContentLoaded` "no Android pode funcionar, mas não é 100% confiável"; recomenda `injectedJavaScriptObject` | É como passamos idioma, margens da tela e o ponto de partida do editor. **Testado e mantido:** com `injectedJavaScriptObject` a função `injectedObjectJson` não chegou à página no emulador, e o idioma se perdeu sem aviso | Fechado |
| 3 | react-native-webview: `webviewDebuggingEnabled` deve ficar desligado em produção; `allowUniversalAccessFromFileURLs` e `allowFileAccessFromFileURLs` são para deixar desligados se não forem necessários | Tudo ligado, sempre. A depuração nós usamos nos testes | Antes de publicar |
| 4 | Mediabunny: `StreamSource` é apelido obsoleto de `CustomSource` | Trocado por `CustomSource` | Feito |
| 5 | Mediabunny: `computeDuration` pode fazer bem mais trabalho; `getDurationFromMetadata` dá uma duração aproximada sem varrer o arquivo | Trocado na reserva de quadros. `previews.ts` e `probe.ts` seguem com `computeDuration`, porque ali a duração exata importa | Feito |
| 6 | Mediabunny: leitura parcial do arquivo mantém a memória baixa, e `BlobSource` guarda só um cache de 8 MiB | Carregamos o arquivo inteiro num Blob antes (`fetchBlob`, em XHR). **Medido no A11: um Blob de 164 MB não aumentou a RAM**, e essa suspeita caiu. Custa tempo: 9,8 s para ler esse arquivo, o que pesa ao abrir vídeo grande sem cópia leve | Não é memória |

## Ideias que a documentação traz para testar

- **Mediabunny, `samplesAtTimestamps` com lista assíncrona:** um único decodificador atende vários instantes e nunca decodifica o mesmo pacote duas vezes, se os instantes estiverem em ordem. Pode ajudar no arraste para a frente, em vez de `getSample` a cada salto. Para voltar, não ajuda.
- **WebCodecs, `optimizeForLatency`:** testado no A11, sem ganho. Fica de fora.
- **Chrome, Worker e `OffscreenCanvas`:** recomenda levar os quadros para fora da thread principal. Tocando, a nossa fica 37% ociosa, então não é prioridade.
- **Mediabunny, `CanvasSink` com `poolSize`:** reaproveita canvases. Nas miniaturas não serve, porque guardamos cada uma. Só valeria em usos passageiros.

## O que já fazemos como recomendado

- `hardwareAcceleration`: a Mediabunny diz que é melhor deixar no padrão, e o nosso decodificador não força nada. O codificador usa `prefer-hardware` só depois de conferir que há suporte.
- Consultar `isConfigSupported` antes de codificar, como pede o Chrome. A Mediabunny também tem `canEncodeVideo`, com o mesmo efeito.
- `canvasesAtTimestamps` em ordem para miniaturas e reserva, como a documentação indica.
- Fechar quadros decodificados (`close()`).
- Um sink por trilha, e descartar a `Input` ao terminar.

## O que as documentações não cobrem

Nenhuma das páginas lidas fala de arrastar na linha do tempo, de limite de decodificadores de hardware, nem do codificador só aceitar a dimensão maior na horizontal. Isso veio das nossas medições no A11. A página de Media3 lida não trouxe nada que mude o nosso uso nas cópias leves.

## Fontes

- [Mediabunny: Media sinks](https://mediabunny.dev/guide/media-sinks)
- [Mediabunny: Reading media files](https://mediabunny.dev/guide/reading-media-files)
- [Mediabunny: Supported formats and codecs](https://mediabunny.dev/guide/supported-formats-and-codecs)
- [Chrome: WebCodecs](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs)
- [MDN: VideoDecoder.configure](https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/configure)
- [react-native-webview: Reference](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md)
- [Media3: Transformer](https://developer.android.com/media/media3/transformer/transformations)
