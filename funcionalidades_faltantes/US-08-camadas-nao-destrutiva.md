# US-08 — Edição em camadas não destrutiva: situação

Verificado em 04/10/2026 no emulador `Pixel_7` e lendo o código. Atualizado depois das correções do mesmo dia.

## Resumo

| Critério | Status |
|---|---|
| RF-002 Edição não destrutiva | ✅ Funciona |
| RF-052 Duplicar, mesclar e ocultar camadas | ✅ Funciona para camadas de pintura (ver nota) |
| RF-033 Pintura com pincéis de formas/opacidades e stylus | ✅ Formas e opacidade; pressão implementada, não testada em aparelho |
| RNF-008 RAM abaixo de 800 MB (foto de 24 MP) | ✅ ~460 MB em build release |

## O que foi feito
- **Camadas agora são salvas com o projeto.** Antes, qualquer traço, texto ou forma sumia ao fechar o editor. Cada projeto guarda suas camadas (traços, visibilidade, opacidade) em `layers:<id>` (`layerStorage.ts`, com teste). Confirmado no emulador: desenhei, fechei o app de verdade e o traço voltou. Excluir um projeto apaga as camadas dele, e o espaço aparece em Armazenamento.
- **Pincéis:** três pontas (redonda, quadrada, reta) e opacidade do pincel de 10 a 100 %, além de cor e tamanho. A forma e a opacidade ficam gravadas em cada traço. Testado no emulador: ponta quadrada a 50 %.
- **Caneta (stylus):** a largura do traço acompanha a pressão média quando o aparelho a informa (`pressureWidth`, com teste). Dedo continua com a largura escolhida.
- **Barra do pincel** passou a quebrar linha e a ficar na parte visível do canvas (antes ficava escondida atrás do painel de camadas).
- **Cabeçalho do editor com dados reais:** dimensões da imagem decodificada, formato e tamanho do arquivo no lugar dos valores fixos "6000 × 4000 · Adobe RGB · 14 bits · RAM 412 MB". Isso revelou que os projetos de demonstração usam uma imagem de 1200 × 798.
- **Contador de traços:** o painel mostra "1 traço" (singular). O "0 traços" que eu tinha visto antes era a captura feita antes do re-render, e não um erro.
- **RNF-008:** importei uma foto de 24 MP (6000 × 4000, 7,6 MB) pela galeria. No build release: 410 MB de memória com a foto aberta, 457 MB com um ajuste e 462 MB com camadas e um traço (RSS 560 MB). No build de desenvolvimento o mesmo cenário passa de 870 MB, por causa do ambiente de depuração.

## Pendências
- **Duplicar e mesclar só valem para camadas de pintura.** "Ajustes de cor" e "Fundo" são camadas fixas únicas, então duplicá-las não faz sentido. Se o critério pedir duplicar camadas de texto ou forma, falta fazer.
- **Pressão da caneta:** o emulador não tem caneta, então só a lógica foi testada. A largura usa a média da pressão do traço, e não varia dentro do mesmo traço.
- **Cor de espaço e profundidade de bits** deixaram de aparecer no cabeçalho, pois nada neste build lê isso do arquivo.
- **RNF-008:** medido só no emulador, com uma foto e poucas camadas. Falta testar com muitas camadas de pintura e em aparelho real.
- **Camadas salvas antes desta mudança** não existem: projetos abertos antes da correção começam só com as camadas padrão.
