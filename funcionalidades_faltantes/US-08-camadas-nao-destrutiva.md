# US-08 — Edição em camadas não destrutiva: o que falta

Verificação feita em 04/10/2026 no emulador `Pixel_7` (build debug) e lendo o código.

## Resumo

| Critério | Status |
|---|---|
| RF-002 Edição não destrutiva | ✅ Funciona |
| RF-052 Duplicar, mesclar e ocultar camadas | ⚠️ Parcial |
| RF-033 Pintura em camadas com pincéis e stylus | ⚠️ Parcial |
| RNF-008 RAM abaixo de 800 MB (foto de 24 MP) | ❓ Não comprovado |

## O que está funcionando
- Painel Camadas com Pintura, Ajustes de cor e Fundo (travado). Cada camada tem olho de visibilidade e slider de opacidade.
- O histórico de operações guarda cada edição e o original é preservado (`originalUri`). Os ✓ de Ajustes e de Perspectiva gravam o resultado em `workingUri`, sem tocar no original.
- Selecionei "Pintura 1", arrastei o dedo no canvas e saiu um traço vermelho. A paleta tem 7 cores.

## Pendências
- **Duplicar só funciona para camadas de pintura** (`canDuplicate` exige `kind === 'paint'` em `LayersPanel.tsx`). Camadas de ajuste e o fundo não duplicam.
- **Mesclar só mescla camadas de pintura visíveis** (`mergeVisiblePaintLayers`), e não todas as camadas visíveis como o critério diz.
- **Ao pintar, o painel continuou mostrando "0 traços"** depois do traço desenhado. A contagem não atualiza (ou o traço não foi para a camada que o painel mostra). Precisa investigar.
- **O traço só aparece com a camada de pintura selecionada.** Sem seleção, arrastar no canvas não faz nada e não há aviso na tela.
- **Pincéis:** só há cor e tamanho (`BRUSH_COLORS`, `brushSize`). Não há formas diferentes nem opacidade do pincel, apenas a opacidade da camada.
- **Stylus:** não há leitura de pressão. O comentário no código diz que dedo e caneta funcionam igual.
- **Cabeçalho do editor com valores fixos:** "6000 × 4000 · Adobe RGB · 14 bits · RAM 412 MB" é texto fixo (`// TODO: pull real dimensions / color space / bit depth / RAM usage`).
- **RNF-008:** medi `dumpsys meminfo` com o editor aberto: PSS total de 643 MB e Native Heap de 445 MB, em build debug. Está abaixo de 800 MB, mas não sei qual era o tamanho real da imagem aberta (o cabeçalho é fixo), então não vale como prova para 24 MP com várias camadas. Falta testar com uma foto real de 24 MP.
