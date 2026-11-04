# Hipóteses guardadas para testar no Poco

Escrito em 2026-11-04. Nada daqui está no código. Foram testadas e tiradas porque não ajudaram no A11 ou no emulador, mas o Poco é outro aparelho e pode dar outro resultado.

Regras no Poco (`T4PVUC79WGS4FE8T`): só `adb install -r`, nunca desinstalar nem limpar dados, não tocar nos projetos do dono, não conceder permissões. Só usar com o OK do dono, e medir no aparelho sem outro app compilando (`dex2oat` estraga a medição).

Uma hipótese só volta ao código se não piorar o A11: o app precisa continuar servindo nos dois.

## Testadas e tiradas

| Hipótese | Resultado até agora | O que medir no Poco | Como trazer de volta |
|---|---|---|---|
| Foto: `toDataURL` em vez de `toBlob` ao exportar | Emulador: 0,13 s contra 4,2 s. A11: 1,45 s com tela travada 1,4 s, contra 1,25 s e 0,5 s | Tempo de codificar e tempo de tela travada, com foto de 50 MP | `git revert ad2c69e` |
| Vídeo: `optimizeForLatency` no decodificador | A11: 317 a 385 ms contra 315 (a cada 30 quadros), 222 a 227 contra 219 (a cada 10) | Quadro exato depois de um salto, em cópia leve | Passar `optimizeForLatency: true` nas opções de decodificador do `VideoSampleSink` em `video-editor-web/src/engine/media.ts` e `engine.ts` |
| Vídeo: tag `<video>` para o salto | A11: mais de 6 s para abrir, quadro em cerca de 600 ms contra cerca de 300 ms | Abrir e quadro depois de `currentTime`, com `requestVideoFrameCallback` | Foi só teste pela depuração, sem mudança no código |
| Dados iniciais por `injectedJavaScriptObject` | Emulador: `injectedObjectJson` não chegou à página e o idioma se perdeu sem aviso. Não testado em celular | Se `ReactNativeWebView.injectedObjectJson` existe antes de `main.tsx` rodar | Trocar `injectedJavaScriptBeforeContentLoaded` nas duas telas de editor e ler o JSON no início de `main.tsx` |

## Nunca testadas

- **Mediabunny, `samplesAtTimestamps` com lista assíncrona:** um decodificador só para vários instantes, para arrastar para a frente.
- **Decodificador mantido aberto** entre saltos, em vez de um novo por `getSample`.
- **Chrome, Worker e `OffscreenCanvas`** para levar os quadros para fora da thread principal. Tocando, a thread fica 37% ociosa, então não é prioridade.

Detalhes das medições em [pesquisa-arrastar-timeline.md](pesquisa-arrastar-timeline.md) e [leitura-documentacao.md](leitura-documentacao.md).
