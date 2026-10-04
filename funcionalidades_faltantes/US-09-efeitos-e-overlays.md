# US-09 — Efeitos visuais e overlays decorativos: situação

Verificado em 04/10/2026 no emulador `Pixel_7` e lendo o código (`EffectsDrawer.tsx`). Atualizado depois das correções do mesmo dia.

## Resumo

| Critério | Status |
|---|---|
| RF-041 Retrô: envelhecimento, granulado, vinheta com intensidade e mesclagem | ✅ Funciona |
| RF-060 Molduras e bordas em estilos e espessuras | ✅ Existe (não testado ao vivo) |
| RF-068 Iluminação posicionável manualmente | ✅ Existe (não testado ao vivo) |
| RF-075 Dupla exposição com blend modes e transparência | ✅ Funciona (galeria do aparelho e outro projeto) |
| RF-028 Overlays do repositório interno ou da galeria | ✅ Funciona |

## O que foi feito
- **Overlay da galeria do aparelho (RF-028):** o botão "Importar overlay da galeria" substitui o aviso antigo ("requer o módulo de acesso à galeria") que não era mais verdade. A imagem escolhida é sobreposta à foto com modo de mesclagem (Multiplicar, Tela, Sobrepor) e intensidade. Testado no emulador.
- **Dupla exposição pela galeria (RF-075):** além de "Escolher imagem do projeto", há "Escolher da galeria do dispositivo". Testado no emulador, com modos de mesclagem e opacidade.
- **As imagens escolhidas são copiadas para a pasta privada do app** (`files/imports/`). A cópia do seletor fica no cache e some com "Limpar" cache. Assim os efeitos continuam funcionando.
- **As duas imagens são salvas por projeto** (`editorImages:<id>`, com teste) e voltam ao reabrir. Confirmado: fechei o app de verdade e o overlay continuou na foto. Excluir o projeto apaga a referência, e o espaço aparece em Armazenamento.
- **Erro ao importar** passa a mostrar um aviso ao usuário e a ser registrado no log, em vez de falhar em silêncio.

## Pendências
- **Os overlays do "repositório interno" são texturas geradas por código** (Luz, Poeira, Desgaste), e não fotos de luz ou poeira. Não há como baixar mais pacotes.
- **Molduras, iluminação posicionável:** os controles existem, mas não os usei no emulador nesta rodada.
- **O overlay e a dupla exposição ainda não aparecem na exportação testada:** não conferi o arquivo exportado com eles aplicados.
- **Observação sobre o teste:** com a foto de 24 MP, o editor no build de desenvolvimento responde com vários segundos de atraso (cada toque demora até uns 8 s para refletir na tela). Não é falha desta funcionalidade, mas fica anotado em US-08 como risco para RNF-008 ("sem comprometer o desempenho"). Falta medir o mesmo cenário no build release.
