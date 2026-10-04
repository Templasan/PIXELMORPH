# US-15 — Edição de precisão (corte, quadro a quadro, congelamento): o que falta

Verificação feita em 04/10/2026 no emulador `Pixel_7` e lendo o código (`VideoEditorScreen.tsx`).

## Resumo

| Critério | Status |
|---|---|
| RF-035 Corte com precisão de quadro e loop de revisão | ✅ Existe (sem prévia real) |
| RF-013 Navegação quadro a quadro e correções pontuais; remover objetos | ⚠️ Parcial |
| RF-077 Congelamento de quadro | ✅ Existe (sem prévia real) |

## O que vi funcionando
- Aba Aparar: início e fim do clipe com timecode (`00:02:59:06`, `00:05:12:00`) e botões −/+ de um quadro. As alças de arrasto no clipe também aparam.
- Aba Quadro: botões "−1 quadro" e "+1 quadro", chave "Revisar em loop" e "Congelar por X s / ❄ Congelar aqui". A ferramenta "Congelar" também aparece na barra inferior.
- A lógica de cálculo (corte, divisão, congelamento) fica em `frameMath.ts` e `freezeFrame.ts`, fora da tela.

## Pendências
- ~~Sem player real, não dá para "ver" o quadro~~ **Resolvido:** a prévia agora mostra o quadro real do vídeo (ver US-14). Os botões −1/+1 quadro avançam o timecode e a prévia vai ao quadro exato; testado no emulador (4:21 → 4:23 depois de três toques). O congelamento e o corte continuam só validados no timecode e nos blocos.
- **Remover objetos indesejados (RF-013) não existe.** Procurei por remoção, "objeto" e inpainting em `VideoEditorScreen.tsx` e não há nada.
- **Correções pontuais de cor por quadro:** a aba Correção (Brilho etc.) age no clipe inteiro, não em um quadro específico.
- **Loop de revisão:** o código volta ao início (`if (loopReview) return 0`) ao chegar ao fim da timeline inteira. Não repete só o trecho entre os marcadores de início e fim, como o critério sugere.
- **Não testei ao vivo** os botões de quadro, o congelamento e o loop. Só confirmei que existem na tela e no código.
